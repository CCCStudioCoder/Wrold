'use client'

import Link from "next/link";
import {Project, User} from "@/app/util/db";
import {hasPermissions} from "@/app/util/projects";
import {createContext, ReactNode, useContext, useEffect, useState} from "react";

export type DimensionProps = {width: number, height: number};

export function Loading({width, height}: DimensionProps) {
    return (
        <div style={{width, height, display: "flex", justifyContent: "center", alignItems: "center"}}></div>
    );
}

type ToolboxProps = { project: Project, path?: string[] };
type ToolProps = ToolboxProps & { perms: boolean; }

export const DEFAULT_TOOLBOX =
    (buttons: ((props: ToolProps) => ReactNode[]) = () => []) =>
    (props: ToolProps) => [
        ...buttons(props),
        <Link href={props.perms ? `/projects/${props.project.id}/settings` : "#" /*STYLES: gray if !perms*/}>Manage project</Link>,
        props.path && <Link href={props.path.slice(0, -1).join("/")}>Go back</Link>,
        <Link href="/dashboard">Return to your projects</Link>
    ];

export type ToolBoxConstructor = ReturnType<typeof DEFAULT_TOOLBOX>;

export const ToolboxProvider = createContext(DEFAULT_TOOLBOX());
export const ToolboxModifier = createContext<
    (buttons: (props: ToolProps) => ReactNode[]) => void
>(() => {});

export function EditorToolbox({ project, path }: ToolboxProps) {
    const [user, setUser] = useState<User | null>(null);
    const perms = user !== null && hasPermissions(user.id, project);

    const buttons = useContext(ToolboxProvider);

    useEffect(() => {
        fetch("/api/user_data", {
            method: "GET",
        })  .then(res => res.json())
            .then(data => setUser(data));
    }, []);

    return (
        <div>
            {buttons({ project, path, perms }).map(el => el as ReactNode)}
        </div>
    );
}