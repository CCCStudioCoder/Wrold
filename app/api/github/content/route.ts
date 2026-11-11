import {dbError, SUCCESSFUL} from "@/app/util/db";
import HttpStatusCode from "@/app/util/status-code";
import {db} from "@/app/db";
import {projectTable, userTable} from "@/app/db/schema";
import {eq, sql} from "drizzle-orm";
import github, {createBranchIfNotExists, resourceJSON} from "@/app/util/github";
import {validateSession} from "@/app/util/session";
import {getProject, INVALID_PROJECT, PROJECT_NOT_FOUND, Role, roleIn} from "@/app/util/projects";
import {NextRequest} from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { project, path, locale } = await req.json();

        if(typeof project !== "number" || typeof path !== "string") {
            return INVALID_PROJECT;
        }

        const projectSearch = await db.select()
            .from(projectTable)
            .where(eq(projectTable.id, project));
        if(projectSearch.length == 0) {
            return PROJECT_NOT_FOUND;
        }

        const [error, sessionValid, userData] = await validateSession();
        if(!sessionValid) {
            return error;
        }
        const hasPermissions = roleIn(userData!.id, projectSearch[0]) !== Role.NONE;

        if(!(projectSearch[0].isPublic || hasPermissions)) {
            return PROJECT_NOT_FOUND; // Guess why
        }
        if(!projectSearch[0].translationBranch) {
            // Avoid letting users write unsavable code if there is no translation branch
            return Response.json({error: "Please provide a translation branch before updating it."}, {status: HttpStatusCode.NOT_FOUND});
        }

        const translationPos = projectSearch[0].translationNames.indexOf(path)
        if(!translationPos) {
            return Response.json({error: "Translation not found."}, {status: HttpStatusCode.NOT_FOUND});
        }

        const sourcePath = projectSearch[0].translationSources[translationPos];
        const targetPath = projectSearch[0].translationTargets[translationPos];
        const isSource = locale === projectSearch[0].defaultLanguage || !locale;

        const octokit = await github.getInstallationOctokit(
            projectSearch[0].isPublic ? userData!.id : projectSearch[0].owner
        );

        const { data: srcContent } = await octokit.rest.repos.getContent({
            owner: projectSearch[0].targetOwner,
            repo: projectSearch[0].targetRepo,
            path: sourcePath
        });

        let srcJSON = resourceJSON(srcContent);
        const srcResult = resourceJSON(srcContent);
        if(srcResult instanceof Response) {
            return srcResult;
        }
        srcJSON = srcResult;

        let targetJSON = undefined;

        if(!isSource) {
            const { data: targetContent } = await octokit.rest.repos.getContent({
                owner: projectSearch[0].targetOwner,
                repo: projectSearch[0].targetRepo,
                path: targetPath
            });

            const targetResult = resourceJSON(targetContent);
            if(targetResult instanceof Response) {
                return targetResult;
            }
            targetJSON = targetResult;
        }

        return Response.json({
            readonly: hasPermissions,
            source: srcJSON,
            target: targetJSON,
        }, {status: HttpStatusCode.OK});
    } catch (e) {
        return dbError(e);
    }
}

export async function PUT(req: Request) {
    try {
        const { id, name, source, target } = await req.json();

        const [error, sessionValid, userData] = await validateSession();
        if(!sessionValid) {
            return error;
        }

        const projectError = await getProject(id, userData!.id);
        if(projectError instanceof Response) {
            return projectError;
        }

        await db.update(projectTable).set({
            translationNames: sql`array_append(${projectTable.translationNames}, ${name})`,
            translationSources: sql`array_append(${projectTable.translationSources}, ${source})`,
            translationTargets: sql`array_append(${projectTable.translationTargets}, ${target})`,
        }).where(eq(projectTable.id, id));
    } catch(e) {
        return dbError(e);
    }
}

export async function PATCH(req: Request) {
    try {
        const { id, translation, locale, path: target, message, content } = await req.json();

        const [error, sessionValid, userData] = await validateSession();
        if(!sessionValid) {
            return error;
        }

        const project = await getProject(id, userData!.id, Role.CONTRIBUTOR);
        if(project instanceof Response) {
            return project;
        }
        if(!project.translationBranch) {
            return Response.json({error: "Please provide a translation branch before updating it."}, {status: HttpStatusCode.NOT_FOUND});
        }

        const translationPos = project.translationNames.indexOf(translation);
        if(!translationPos) {
            return Response.json({error: "Translation not found."}, {status: HttpStatusCode.NOT_FOUND});
        }

        const { appId } = await db.select({appId: userTable.githubAppId})
            .from(userTable)
            .where(eq(userTable.id, project.owner))
            .limit(1).then(res => res[0]);

        const owner = project.targetOwner;
        const repo = project.targetRepo;
        const branch = project.translationBranch;

        const octokit = await github.getInstallationOctokit(appId!);
        await createBranchIfNotExists(owner, repo, branch, octokit);

        const basePath = locale === project.defaultLanguage
            ? project.translationSources[translationPos]
            : project.translationTargets[translationPos];
        const path = `${basePath}/${locale}/${target}`;

        try {
            await octokit.rest.repos.createOrUpdateFileContents({
                owner, repo, branch, message, path,
                content: Buffer.from(content, 'utf8').toString('base64'),
            });
        } catch(e) {
            return dbError(e);
        }

        return SUCCESSFUL;
    } catch(e) {
        return dbError(e);
    }
}

export async function DELETE(req: Request) {
    try {
        const { id, name } = await req.json();

        const [error, sessionValid, userData] = await validateSession();
        if(!sessionValid) {
            return error;
        }

        const project = await getProject(id, userData!.id);
        if(project instanceof Response) {
            return project;
        }

        const index = project.translationNames.indexOf(name);
        if(index == -1) {
            return Response.json({error: "Cannot find such translation name"}, {status: HttpStatusCode.NOT_FOUND});
        }

        const source = project.translationSources[index];
        const target = project.translationTargets[index];

        await db.update(projectTable).set({
            translationNames: sql`array_remove(${projectTable.translationNames}, ${name})`,
            translationSources: sql`array_remove(${projectTable.translationSources}, ${source})`,
            translationTargets: sql`array_remove(${projectTable.translationTargets}, ${target})`,
        }).where(eq(projectTable.id, id));
    } catch(e) {
        return dbError(e);
    }
}