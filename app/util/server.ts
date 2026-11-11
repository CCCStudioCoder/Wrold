import {Metadata} from "next";
import {Project, User} from "@/app/util/db";
import {SearchParams} from "@/app/projects/[project]/page";
import {validateSession} from "@/app/util/session";
import {getProject, Role} from "@/app/util/projects";
import {db} from "@/app/db";
import {userTable} from "@/app/db/schema";
import {eq, inArray} from "drizzle-orm";
import {cookies} from "next/headers";

export async function projectMetadata({ params }: SearchParams): Promise<Metadata> {
    const id = await params.then(p => Number(p.project));

    const req = await fromUser(id);
    if(req == "failed") return {};

    const [project] = req;

    const owner = await db.select()
        .from(userTable)
        .where(eq(userTable.id, project.owner))
        .limit(1)
        .then(data => {return{
            name: data[0].pseudo as string,
            url: data[0].githubAccount ? "https://github.com/" + data[0].githubAccount : undefined
        }});

    const members = [...project.admins, ...project.contributors];
    const authors = await db.select()
        .from(userTable)
        .where(inArray(userTable.id, members))
        .limit(members.length)
        .then(req =>
            req.map(user => {
                return {
                    name: user.pseudo as string,
                    url: user.githubAccount ? "https://github.com/" + user.githubAccount : undefined
                }
            })
        );

    return {
        title: project.name + " project's home",
        description: project.description,
        authors: [owner, ...(await Promise.all(authors))],
        publisher: owner.name
    };
}

export async function fromUser(id: number): Promise<[Project, User]|"failed"> {
    try {
        const [_, sessionValid, user] = await validateSession();
        if(!sessionValid) return "failed";

        const project = await getProject(id, user!.id, Role.NONE);
        if(project instanceof Response) return "failed";

        return [project, user!];
    } catch (_) {
        return "failed";
    }
}