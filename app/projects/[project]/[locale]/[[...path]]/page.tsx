import {SearchParams} from "@/app/projects/[project]/page";
import {Suspense} from "react";
import {Loading} from "@/app/util/components";
import {Project} from "@/app/util/db";
import {Metadata} from "next";
import {projectMetadata} from "@/app/util/server";
import {EditorCapsule} from "@/app/util/client";

type PathAndLocaleSlug = {locale: string, path?: string[]};

export async function generateMetadata(slug: SearchParams): Promise<Metadata> {
    return projectMetadata(slug)
}

export default function EditorPage(slug: SearchParams<PathAndLocaleSlug>) {
    return (
        <main>
            <Suspense fallback={<Loading width={500} height={500} />}>
                <Content/>
            </Suspense>
        </main>
    );

    async function Content() {
        const { project: id, locale, path } = await slug.params;

        const project: Project = await fetch("/api/projects", {
            method: "POST",
            body: JSON.stringify({id})
        }).then(res => res.json());

        const { readonly, source, target } = path ?
            await fetch("/api/github/content", {
                method: "POST",
                body: JSON.stringify({
                    project: id,
                    path, locale
                })
        }).then(res => res.json()) : {};

        return (
            <EditorCapsule
                path={path}
                project={project}
                id={id}
                locale={locale}
                source={source}
                target={target}
                readonly={readonly}
            />
        );
    }
}