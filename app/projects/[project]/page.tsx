import {Suspense} from "react";
import {DEFAULT_TOOLBOX, EditorToolbox, Loading, ToolboxProvider} from "@/app/util/components";
import {languageText} from "@/app/util/editor";
import {Metadata} from "next";
import {fromUser, projectMetadata} from "@/app/util/server";

type ProjectSlug = {project: string};
export type SearchParams<T = {}> = {
    params: Promise<T & ProjectSlug>
}

export async function generateMetadata(slug: SearchParams): Promise<Metadata> {
    return projectMetadata(slug)
}

export default function ProjectPage(slug: SearchParams) {
    return (
        <main>
            <Suspense fallback={<Loading width={500} height={500} />}>
                <Content />
            </Suspense>
        </main>
    );

    async function Content() {
        const { project: id } = await slug.params;

        const req = await fromUser(Number(id));
        if(req == "failed") return <main></main>;

        const [project] = req;

        return (
            <main>
                <div>
                    <p>{project.name}</p>
                    <ToolboxProvider value={DEFAULT_TOOLBOX()}>
                        <EditorToolbox project={project} />
                    </ToolboxProvider>
                </div>
                <ul>
                    {project.locale.map((loc, i) => (
                        <li key={i + 1}>{languageText(loc)}</li>
                    ))}
                    <li key={0}>{languageText(project.defaultLanguage)} (source)</li>
                </ul>
            </main>
        );
    }
}