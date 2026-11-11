import {db} from "@/app/db";
import {userTable} from "@/app/db/schema";
import {dbError} from "@/app/util/db";
import {cookies} from "next/headers";
import {hash} from "argon2";
import {eq, or} from "drizzle-orm";
import {createSession} from "@/app/util/session";
import HttpStatusCode from "@/app/util/status-code";
import {GITHUB_APP_REDIRECT} from "@/app/util/misc";

export async function POST(req: Request) {
    try {
        const { username, password } = await req.json();

        if(typeof username !== "string" || typeof password !== "string") {
            return Response.json({error: "User name and password are required"}, {status: HttpStatusCode.BAD_REQUEST});
        }
        if(username.length > 25 || username.length < 6 || password.length > 25 || password.length < 6) {
            return Response.json({error: "Please provide username and password with between 6 and 25 characters."},
                {status: HttpStatusCode.BAD_REQUEST});
        }

        const forwardedFor = req.headers.get("x-forwarded-for");

        if(!forwardedFor) {
            return Response.json({error: "Cannot find user's IP"}, {status: HttpStatusCode.UNAUTHORIZED});
        }

        const ip = forwardedFor.split(",")[0].trim();

        const usersWithIPOrPseudo = await db.select()
            .from(userTable)
            .where(or(
                eq(userTable.ip, ip),
                eq(userTable.pseudo, username)
            ))
            .limit(1);

        if(usersWithIPOrPseudo.length > 0) {
            return Response.json({error: "IP or username already used"}, {status: HttpStatusCode.UNAUTHORIZED})
        }

        const session = createSession();

        const [createdUser] = await db.insert(userTable).values({
            pseudo: username,
            password: await hash(password),
            ip: ip,
            sessionKey: session,
            sessionKeyCreation: Date.now(),
            accountCreation: Date.now()
        }).returning({id: userTable.id});

        const store = await cookies();
        store.set("session", await hash(session), {
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 30
        });
        store.set("user", String(createdUser.id), {
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 30,
            path: "/"
        });

        return Response.redirect(GITHUB_APP_REDIRECT, HttpStatusCode.FOUND);
    } catch(e) {
        return dbError(e);
    }
}