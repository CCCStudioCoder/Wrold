'use client'

import {ReactNode, useEffect, useMemo, useReducer, useState} from "react";
import {
    DEFAULT_TOOLBOX,
    DimensionProps,
    EditorToolbox,
    Loading,
    ToolboxModifier,
    ToolboxProvider
} from "@/app/util/components";
import {useRouter} from "next/navigation";
import {Project, User} from "@/app/util/db";
import Link from "next/link";
import {Editor} from "@/app/util/editor";

const DEFAULT_REQUEST_INIT: RequestInit = {method: "GET"};

type Props<T> = {children: (value: T) => ReactNode};
export type APIProvider<T> = (params: Props<T> & DimensionProps) => ReactNode;

/**
 * WARNING <br/>
 * There are two ways `result` can be null:
 * - The request is not done yet. Avoid using it in `useMemo` or `useEffect` without checking nullity.
 * - The request came to an error. <br/>
 * For both reasons checks are already done in `APIProvider`
 */
export function useAPI<T = User>(
    redirect: string = "/",
    api: string = "users",
    init: RequestInit = DEFAULT_REQUEST_INIT,
    process: (res: any) => T = res => res
): [APIProvider<T>, T|null, () => void] {
    const [event, refresh] = useReducer(x => x+1, 0);
    const [content, setContent] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        const abortController = new AbortController();
        fetch("/api/" + api, { ...init, signal: abortController.signal })
            .then(response => response.json())
            .then(json => setContent(json));

        return () => abortController.abort("Aborted api fetch");
    }, [event, api, init]);

    const Error = () => {
        useEffect(() => {
            if(content.redirect) {
                router.replace("/auth/login?url=" + redirect);
                router.refresh();
            }
        }, []);
        return <p className="text-red-600">{content.error}</p>
    };

    function Provider<T>({ children, width, height }: Props<T> & DimensionProps): ReactNode {
        return content
            ? ( content.error
                ? <Error />
                : children(content))
            : <Loading width={width} height={height} />;
    }

    const result: T|null = useMemo(() => content && process(content), [content, process]);

    return [Provider, result, refresh];
}

type EditorCapsuleProps = {
    path?: string[];
    project: Project;
    id: string;
    locale: string;
    source: string;
    target: string;
    readonly: boolean;
};

export function EditorCapsule(
    { path, project, id, locale, target, source, readonly }: EditorCapsuleProps
) {
    const [toolbox, setToolbox] = useState(() => DEFAULT_TOOLBOX());

    const ContentList = () => {
        if(!path) {
            const isSrc = project.defaultLanguage === locale;
            return project.translationNames.map((tr, i) => (
                <Link href={`/projects/${id}/${locale}/${
                    isSrc ? project.translationSources[i] : project.translationTargets[i]
                }`}>{tr}</Link>
            ));
        }
        if(Array.isArray(source)) {
            return (<ul>{source.map((item, i) => (
                <Link key={i} href={`/projects/${id}/${locale}/${(path ?? []).join("/")}/${item}`}>{item}</Link>
            ))}</ul>);
        }

        return readonly
            ? <p>Your are not allowed to view and edit this project.</p>
            : (
                <ToolboxModifier value={buttons => setToolbox(DEFAULT_TOOLBOX(buttons))}>
                    <Editor content={target || source} src={source} project={project} path={[locale, ...path!]} />
                </ToolboxModifier>
            );
    }

    return (
        <main>
            <div>
                <Link href={`/projects/${id}/`}>${id}</Link>
                /
                <Link href={`/projects/${id}/${locale}/`}>${locale}</Link>
                /
                {(path ?? []).map((item, i, array) => (
                    <Link href={`/projects/${id}/${locale}/${array.slice(0, i).join("/")}`}>${item}</Link>
                )).join("/")}
                <ToolboxProvider value={toolbox}>
                    <EditorToolbox project={project} path={path} />
                </ToolboxProvider>
            </div>

            <ContentList />
        </main>
    );
}