import {dbError, SUCCESSFUL} from "@/app/util/db";
import HttpStatusCode from "@/app/util/status-code";
import {db} from "@/app/db";
import {validateSession} from "@/app/util/session";
import {inviteTokenTable, projectTable, userTable} from "@/app/db/schema";
import {and, eq, sql} from "drizzle-orm";
import {hasPermissions, NO_PERMISSIONS, PROJECT_NOT_FOUND} from "@/app/util/projects";

const INVALID_TOKEN = Response.json({error: "Invalid token"}, {status: HttpStatusCode.BAD_REQUEST});
const TOKEN_NOT_FOUND = Response.json({error: "Token not found"}, {status: HttpStatusCode.NOT_FOUND});

export async function POST(req: Request) {
    try {
        const { token } = await req.json();
        if(typeof token !== "string") {
            return INVALID_TOKEN;
        }

        const [error, sessionValid, userData] = await validateSession();
        if(!sessionValid) {
            return error;
        }

        const tokenSearch = await db.select()
            .from(inviteTokenTable)
            .where(eq(inviteTokenTable.name, token))
            .limit(1); // Redundant because #name is unique()
        if(tokenSearch.length == 0) {
            return TOKEN_NOT_FOUND
        }

        // Add user to project roles
        const project = await db.update(projectTable).set({
                [tokenSearch[0].admin ? "admins" : "contributors"]: sql`array_append(${projectTable}, ${userData!.id})`
            }).where(eq(projectTable.id, tokenSearch[0].linksTo))
            .returning({id: projectTable.id});

        if(project.length == 0) return PROJECT_NOT_FOUND;

        // Retrieve one use
        await db.update(inviteTokenTable).set({
            leftUses: sql`${inviteTokenTable.leftUses} - 1`,
        }).where(eq(inviteTokenTable.id, tokenSearch[0].id))

        // Add project to user's list
        await db.update(userTable).set({
            projects: sql`array_append(${userTable}, ${tokenSearch[0].linksTo})`
        }).where(eq(userTable.id, userData!.id));

        return Response.json({project: project[0].id});
    } catch(e) {
        return dbError(e);
    }
}

export async function PUT(req: Request) {
    try {
        const { name, linksTo, admin, expireDate, leftUses } = await req.json();

        const [error, sessionValid, userData] = await validateSession();
        if(!sessionValid) {
            return error;
        }

        const alreadyPointing = await db.select()
            .from(inviteTokenTable)
            .where(eq(inviteTokenTable.linksTo, linksTo))
            .limit(5);
        if(alreadyPointing.length > 4) {
            return Response.json({error: "There already exist 5 invite tokens for this project."}, {status: HttpStatusCode.FORBIDDEN})
        }

        const projectSearch = await db.select()
            .from(projectTable)
            .where(eq(projectTable.id, linksTo))
            .limit(1);
        if(projectSearch.length == 0) {
            return PROJECT_NOT_FOUND;
        }
        if(!hasPermissions(userData!.id, projectSearch[0])) {
            return NO_PERMISSIONS;
        }

        await db.insert(inviteTokenTable)
            .values({name, linksTo, admin, expireDate, leftUses});

        return SUCCESSFUL;
    } catch(e) {
        return dbError(e);
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json();

        if(typeof body.id !== "number" || typeof body.project !== "number") {
            return INVALID_TOKEN;
        }

        const projectSearch = await db.select()
            .from(projectTable)
            .where(eq(projectTable.id, body.project))
            .limit(1);

        const [error, sessionValid, userData] = await validateSession();
        if(!sessionValid) {
            return error;
        }

        if(!hasPermissions(userData!.id, projectSearch[0])) {
            return NO_PERMISSIONS;
        }

        const update: any = {};
        for(const prop of ["name", "admin", "expireDate", "leftUses"]) {
            if(body[prop]) update[prop] = body[prop];
        }

        const result = await db.update(inviteTokenTable).set(update)
            .where(and(
                eq(inviteTokenTable.id, body.id),
                eq(inviteTokenTable.linksTo, body.project) // Check if the user don't lie
            )).returning({});

        if(result.length == 0) {
            return TOKEN_NOT_FOUND; // Or in facts NO_PERMISSION if the "hacker" gave a wrong project
        }

        return SUCCESSFUL;
    } catch(e) {
        return dbError(e);
    }
}

export async function DELETE(req: Request) {
    try {
        const { id, project } = await req.json();

        if(typeof id !== "number" || typeof id !== "number") {
            return INVALID_TOKEN;
        }

        const [error, sessionValid, userData] = await validateSession();
        if(!sessionValid) {
            return error;
        }

        const projectSearch = await db.select()
            .from(projectTable)
            .where(eq(projectTable.id, project))
            .limit(1);
        if(projectSearch.length == 0) {
            return PROJECT_NOT_FOUND;
        }

        if(!hasPermissions(userData!.id, projectSearch[0])) {
            return NO_PERMISSIONS;
        }

        const result = await db.delete(inviteTokenTable)
            .where(and(
                eq(inviteTokenTable.id, id),
                eq(inviteTokenTable.linksTo, project)
            )).returning({});

        if(result.length == 0) {
            return TOKEN_NOT_FOUND;
        }

        return SUCCESSFUL;
    } catch(e) {
        return dbError(e);
    }
}