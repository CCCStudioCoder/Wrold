import {Project} from "@/app/util/db";
import {db} from "@/app/db";
import {projectTable} from "@/app/db/schema";
import {eq} from "drizzle-orm";
import HttpStatusCode from "@/app/util/status-code";

export function targetURL(project: Project) {
    return `https://github.com/${project.targetOwner}/${project.targetRepo}`;
}

export enum Role {
    OWNER = "Owner",
    ADMIN = "Administrator",
    CONTRIBUTOR = "Contributor",
    NONE = "None"
}

const ROLES = [Role.OWNER, Role.ADMIN, Role.CONTRIBUTOR, Role.NONE];

export function roleColumn(role: Role) {
    return role === Role.ADMIN ? "admins" : (role === Role.CONTRIBUTOR ? "contributors" : "owner"); // Nice "vibecoded" func
}

export function roleIn(userId: number, project: Project): Role {
    if (project.owner === userId) return Role.OWNER;
    if (project.admins && project.admins.includes(userId)) return Role.ADMIN;
    if (project.contributors && project.contributors.includes(userId)) return Role.CONTRIBUTOR;
    return Role.NONE;
}

export function hasPermissions(userId: number, project: Project): boolean {
    const role = roleIn(userId, project);
    return [Role.OWNER, Role.ADMIN].includes(role);
}

export async function getProject(id: number, user: number, permissionsNeeded: Role = Role.ADMIN): Promise<Response|Project> {
    const projectSearch = await db.select()
        .from(projectTable)
        .where(eq(projectTable.id, id))
        .limit(1);
    if(projectSearch.length === 0) {
        return PROJECT_NOT_FOUND;
    }
    const role = roleIn(user, projectSearch[0]);
    if(ROLES.indexOf(role) >= ROLES.indexOf(permissionsNeeded == Role.NONE ? (projectSearch[0].isPublic ? Role.NONE : Role.CONTRIBUTOR) : permissionsNeeded)) {
        return NO_PERMISSIONS;
    }

    return projectSearch[0];
}

export const INVALID_PROJECT = Response.json({error: "Invalid project request"}, {status: HttpStatusCode.BAD_REQUEST});
export const PROJECT_NOT_FOUND = Response.json({error: "No project found."}, {status: HttpStatusCode.NOT_FOUND});
export const NO_PERMISSIONS = Response.json({error: "You do not have permission to manage this project"}, {status: HttpStatusCode.FORBIDDEN})