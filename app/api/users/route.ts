import {validateSession} from "@/app/util/session";
import {dbError} from "@/app/util/db";
import {db} from "@/app/db";
import {projectTable, userTable} from "@/app/db/schema";
import HttpStatusCode from "@/app/util/status-code";
import {and, eq, inArray, sql} from "drizzle-orm";
import {hash, verify} from "argon2";
import {cookies} from "next/headers";
import {NextRequest} from "next/server";

export async function GET(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id");

    if(!id) return await validateSession().then(s => s[0]);
    else {
        const userSearch = await db.select()
            .from(userTable)
            .where(eq(userTable.id, Number(id)))
            .limit(1);
        if(userSearch.length === 0) {
            return Response.json({error: "No such user found"}, {status: HttpStatusCode.NOT_FOUND});
        }

        const projects = await db.select()
            .from(projectTable)
            .where(and(
                inArray(projectTable.id, userSearch[0].projects),
                eq(projectTable.isPublic, true)
            ));

        return Response.json({
            info: "User not authenticated, giving only base information.",
            pseudo: userSearch[0].pseudo,
            githubAccount: userSearch[0].githubAccount,
            projects: projects
        }, {status: HttpStatusCode.OK})
    }
}

export async function PATCH(req: Request) {
    try {
        const { pseudo, oldPassword, newPassword, ghAPI: ghAppId } = await req.json();

        const [error, validAuth, userData] = await validateSession();
        if(!validAuth) {
            return error;
        }

        if(Boolean(oldPassword) !== Boolean(newPassword)) { // Check if (not) both of neither exist
            return Response.json({error: "To change your password, please provide old and new password"}, {status: HttpStatusCode.BAD_REQUEST});
        }

        const update: any = {};

        if(oldPassword) {
            const pwHash = userData!.password;
            if(!await verify(pwHash, oldPassword)) {
                return Response.json({error: "Wrong password"}, {status: HttpStatusCode.UNAUTHORIZED});
            }
            update.password = await hash(newPassword);
        }

        if(pseudo) update.pseudo = pseudo;
        if(ghAppId) update.githubAppId = ghAppId;

        await db.update(userTable)
            .set(update)
            .where(eq(userTable.id, userData!.id));

        return Response.json({...update}, {status: HttpStatusCode.OK});
    } catch(e) {
        return dbError(e);
    }
}

export async function PUT(req: Request) {
    try {
        const { project } = await req.json();

        if(typeof project !== "number") {
            return Response.json({error: "Invalid project id"}, {status: HttpStatusCode.BAD_REQUEST});
        }

        const [error, validAuth] = await validateSession();
        if(!validAuth) {
            return error;
        }

        await db.update(userTable).set({
            projects: sql`array_append(${userTable.projects}, ${project})`
        })
    } catch(e) {
        return dbError(e);
    }
}

export async function DELETE(req: Request) {
    try {
        const { project, password } = await req.json();

        const [error, validAuth, userData] = await validateSession();
        if(!validAuth) {
            return error;
        }

        if(typeof password === "string") { // So it's the user you want to delete
            if(await verify(userData!.password, password)) {
                await db.delete(userTable).where(eq(userTable.id, userData!.id));

                const store = await cookies();
                store.delete("session");
                store.delete("user");

                return Response.json({}, {status: HttpStatusCode.OK})
            }
            return Response.json({error: "Wrong password"}, {status: HttpStatusCode.UNAUTHORIZED});
        }

        if(typeof project !== "number") {
            return Response.json({error: "Invalid project id"}, {status: HttpStatusCode.BAD_REQUEST});
        }

        await db.update(userTable).set({
            projects: sql`array_remove(${userTable.projects}, ${project})`
        })
    } catch(e) {
        return dbError(e);
    }
}