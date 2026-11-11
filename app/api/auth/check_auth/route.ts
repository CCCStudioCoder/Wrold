import {db} from "@/app/db";
import {userTable} from "@/app/db/schema";
import {eq} from "drizzle-orm";
import {dbError} from "@/app/util/db";
import {cookies} from "next/headers";
import {hash, verify} from "argon2";
import {checkExpire, createSession} from "@/app/util/session";
import HttpStatusCode from "@/app/util/status-code";

export async function POST(req: Request) {
    try{
        const { user, password } = await req.json();

        if(typeof user != "string" || typeof password != "string") {
            return Response.json({error: "Bad request"}, {status: HttpStatusCode.BAD_REQUEST});
        }

        const userSearch = await db.select()
            .from(userTable)
            .where(eq(userTable.pseudo, user))
            .limit(1);

        if(userSearch.length == 0) {
            return Response.json({error: "Cannot find such user"}, {status: HttpStatusCode.NOT_FOUND});
        }

        if(!await verify(userSearch[0].password, password)) {
            return Response.json({error: "Invalid password"}, {status: HttpStatusCode.UNAUTHORIZED});
        }

        const sessionValid = !checkExpire(userSearch[0].sessionKeyCreation);
        const oldSession = sessionValid && userSearch[0].sessionKey;

        const session = oldSession || createSession();
        await db.update(userTable)
            .set({sessionKey: session, sessionKeyCreation: Date.now()})
            .where(eq(userTable.pseudo, user));

        const store = await cookies();
        store.set("session", await hash(session), {
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 30
        });
        store.set("user", String(userSearch[0].id), {
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 30,
            path: "/"
        });

        return Response.json({...userSearch[0]}, {status: HttpStatusCode.OK});
    } catch (e) {
        return dbError(e);
    }
}