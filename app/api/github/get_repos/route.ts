import {dbError} from "@/app/util/db";
import {validateSession} from "@/app/util/session";
import HttpStatusCode from "@/app/util/status-code";
import github from "@/app/util/github";

export async function GET() {
    try {
        const [error, sessionValid, userData] = await validateSession();
        if(!sessionValid) {
            return error;
        }

        if(!userData!.githubAppId) {
            return Response.json({error: "Please connect your account to GitHub to create a project.", redirect: true},
                {status: HttpStatusCode.UNAUTHORIZED});
        }

        const octokit = await github.getInstallationOctokit(Number(userData!.githubAppId));
        const repos = await octokit.rest.apps.listReposAccessibleToInstallation().then(req => req.data);

        return Response.json({repos: repos.repositories.map(repo => repo.full_name)}, {status: HttpStatusCode.OK})
    } catch (e) {
        return dbError(e);
    }
}