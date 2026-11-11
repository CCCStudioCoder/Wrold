import HttpStatusCode from "@/app/util/status-code";
import {db} from "@/app/db";
import {projectTable, userTable} from "@/app/db/schema";
import {eq, sql} from "drizzle-orm";
import {validateSession} from "@/app/util/session";
import {dbError, SUCCESSFUL} from "@/app/util/db";
import {verify} from "argon2";
import {
    getProject,
    hasPermissions, INVALID_PROJECT,
    NO_PERMISSIONS,
    PROJECT_NOT_FOUND,
    Role,
    roleColumn,
    roleIn
} from "@/app/util/projects";
import github, {createBranchIfNotExists} from "@/app/util/github";

export async function POST(req: Request) {
    try {
        const { id } = await req.json();

        if(typeof id !== "number") {
            return INVALID_PROJECT;
        }

        const projectSearch = await db.select()
            .from(projectTable)
            .where(eq(projectTable.id, id))
            .limit(1);

        if(projectSearch.length == 0) {
            return PROJECT_NOT_FOUND
        }

        const [sessionError, sessionValid] = await validateSession();

        return sessionValid ? Response.json({...projectSearch[0]}, {status: HttpStatusCode.OK}) : sessionError;
    } catch(e) {
        return dbError(e);
    }
}

export async function PUT(req: Request) {
    try {
        const { name, targetOwner, targetRepo, isPublic, defaultLanguage } = await req.json();

        if(
            typeof name !== "string"
            || typeof targetOwner !== "string"
            || typeof targetRepo !== "string"
            || typeof isPublic !== "boolean"
            || name === "new"
        ) {
            return INVALID_PROJECT;
        }

        const [error, sessionValid, userData] = await validateSession();
        if(!sessionValid) {
            return error;
        }
        if(userData!.githubAccount !== targetOwner) {
            return NO_PERMISSIONS;
        }

        const projectsOwned = await db.select()
            .from(projectTable)
            .where(eq(projectTable.owner, userData!.id));
        if(projectsOwned.length > 9) {
            return Response.json({error: "You may have up to 10 projects per user."}, {status: HttpStatusCode.FORBIDDEN});
        }

        const projectWithName = await db.select()
            .from(projectTable)
            .where(eq(projectTable.name, name));
        if(projectWithName.length > 0) {
            return Response.json({error: "There already exists a project with this name."}, {status: HttpStatusCode.FORBIDDEN});
        }

        const { id } = (await db.insert(projectTable).values({
            name: name,
            targetOwner: targetOwner,
            targetRepo: targetRepo,
            isPublic: isPublic,
            owner: userData!.id,
            defaultLanguage: defaultLanguage,
            projectCreation: Date.now(),
        }).returning({id: userTable.id}))[0];

        await db.update(userTable).set({
            projects: sql`array_append(${userTable.projects}, ${id})`
        });

        return SUCCESSFUL;
    } catch (e) {
        return dbError(e);
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json();

        if(typeof body.id !== "number") {
            return INVALID_PROJECT;
        }

        const [error, sessionValid, userData] = await validateSession();
        if(!sessionValid) {
            return error;
        }

        const project = await getProject(body.id, userData!.id, Role.ADMIN);
        if(project instanceof Response) {
            return project;
        }

        const update: any = {};

        for(const prop of ["name", "desc", "ghRepo", "isPublic", "defaultLanguage", "translationBranch"]) {
            if(body[prop]) update[prop] = body[prop];
        }

        if(typeof body.translationBranch === "string") {
            const appId = userData!.githubAppId;
            if(!appId) {
                return Response.json({error: "Cannot change default translation branch if the GitHub App is not configured"},
                    {status: HttpStatusCode.UNAUTHORIZED});
            }

            const octokit = await github.getInstallationOctokit(appId);

            const owner = project.targetOwner;
            const repo = project.targetRepo;

            if(
                await createBranchIfNotExists(owner, repo, body.translationBranch, octokit)
                && project.translationBranch
                && body.renameBranch
            ){
                await octokit.rest.repos.renameBranch({
                    owner,
                    repo,
                    branch: project.translationBranch,
                    new_name: body.translationBranch,
                });
            }
        }

        await db.update(projectTable).set(update).where(eq(projectTable.id, body.id));
        return SUCCESSFUL;
    } catch(e) {
        return dbError(e);
    }
}

export async function DELETE(req: Request) {
    try {
        const { id, password, user } = await req.json();

        if(typeof id !== "number") {
            return INVALID_PROJECT;
        }

        const [error, sessionValid, userData] = await validateSession();
        if(!sessionValid) {
            return error;
        }

        const projectSearch = await db.select()
            .from(projectTable)
            .where(eq(projectTable.id, id))
            .limit(1);

        if(projectSearch.length == 0) return PROJECT_NOT_FOUND;

        const role = roleIn(userData!.id, projectSearch[0]);

        if(typeof user === "number") {
            if(!(userData!.id === user || hasPermissions(user, projectSearch[0]))) {
                return NO_PERMISSIONS;
            }
            await db.update(userTable).set({
                projects: sql`array_remove(${userTable.projects}, ${id})`
            });

            const col = roleColumn(role);
            await db.update(projectTable).set({
                [col]: sql`array_remove(${projectTable[col]}, ${user})`
            });

            return SUCCESSFUL;
        }

        if(!(await verify(userData!.password, password) && role === Role.OWNER)) {
            return NO_PERMISSIONS;
        }

        await db.delete(projectTable).where(eq(projectTable.id, id));

        return SUCCESSFUL;
    } catch(e) {
        return dbError(e);
    }
}