import {cookies} from "next/headers";
import {dbError, SUCCESSFUL} from "@/app/util/db";
import {createSession, validateSession} from "@/app/util/session";
import {db} from "@/app/db";
import {userTable} from "@/app/db/schema";
import {eq} from "drizzle-orm";
import {hash} from "argon2";

export async function DELETE(req: Request) {
    try {
        const { recreate } = await req.json();

        const [error, sessionValid, userData] = await validateSession();
        if(!sessionValid) {
            return error;
        }

        const newSession = recreate ? createSession() : "";
        const creation = recreate ? Date.now() : -1;

        await db.update(userTable).set({
            sessionKey: newSession,
            sessionKeyCreation: creation
        }).where(eq(userTable.id, userData!.id));

        const store = await cookies();
        store.set("session", await hash(newSession), {
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 30
        });
        if(recreate) {
            store.set("user", String(userData!.id), {
                httpOnly: true,
                maxAge: 60 * 60 * 24 * 30,
                path: "/"
            });
        } else {
            store.delete("user");
        }

        return SUCCESSFUL;
    } catch (e) {
        return dbError(e);
    }
}