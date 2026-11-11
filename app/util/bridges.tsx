'use server'

import {getProject, Role, roleIn, targetURL} from "@/app/util/projects";

export async function ProjectDiv({ id, user }: {id: number, user: number}) {
    const project = await getProject(id, user, Role.NONE);
    if(project instanceof Response) {
        return <p>{await project.json().then(json => json.error)}</p>
    }

    return (
        <div>
            <div>
                <span>{project.name}</span>
                <span>{project.id}</span>
            </div>
            <p>{targetURL(project)}</p>
            <p>{roleIn(user, project)}</p>
            {/* TODO <Image src={poject.isPublic ? "" : ""} width={500} height={500} /> */}
        </div>
    );
}