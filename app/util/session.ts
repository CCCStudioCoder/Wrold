import {randomBytes} from "node:crypto";
import {cookies} from "next/headers";
import {db} from "@/app/db";
import {userTable} from "@/app/db/schema";
import {verify} from "argon2";
import {dbError, User} from "@/app/util/db";
import {eq} from "drizzle-orm";

export function createSession() {
    return randomBytes(32).toString("hex");
}

export function checkExpire(creation: number) {
    return creation + 1000 * 60 * 60 * 24 * 30 < Date.now();
}

export async function validateSession(): Promise<[Response, boolean, User?]> {
    try {
        const store = await cookies();
        const session = store.get("session");

        if(!session?.value) {
            return [Response.json({error: "Session required"}, {status: 400}), false];
        }

        let sessionUser: User | undefined;

        const userId = Number(store.get("user")?.value);
        if(Number.isSafeInteger(userId) && userId > 0) {
            const users: User[] = await db.select()
                .from(userTable)
                .where(eq(userTable.id, userId))
                .limit(1);
            if(users.length > 0 && await verify(session.value, users[0].sessionKey)) {
                sessionUser = users[0];
            }
        }

        if(!sessionUser) {
            const users: User[] = await db.select().from(userTable);
            for(const user of users) {
                if(await verify(session.value, user.sessionKey)) {
                    sessionUser = user;
                    break;
                }
            }
        }

        if(!sessionUser) {
            return [Response.json({error: "Invalid session"}, {status: 401}), false];
        }
        if(checkExpire(sessionUser.sessionKeyCreation)) {
            return [Response.json({error: "Old session"}, {status: 401}), false];
        }

        return [Response.json({...sessionUser}, {status: 200}), true, sessionUser];
    }

    catch(e) {
        return [dbError(e), false];
    }
}