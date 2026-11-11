'use client'

import {useContext, useEffect, useMemo, useReducer, useRef, useState} from "react";
import {Project} from "@/app/util/db";
import {ToolboxModifier} from "@/app/util/components";

const languages: {[key: string]: string} = {
    en: "English",
    fr: "Français",
    es: "Español",
    it: "Italiano",
    nl: "Nederlands",
    de: "Deutsch",
    pt: "Português",
    ja: "日本語",
    ko: "한국어",
    zh: "中文",
    ru: "Русский",
    ar: "العربية",
    hi: "हिन्दी",
    tr: "Türkçe",
    pl: "Polski",
    cs: "Čeština",
    sv: "Svenska",
    da: "Dansk",
    fi: "Suomi",
    no: "Norsk",
    el: "Ελληνικά",
    he: "עברית",
};

const locales: {[key: string]: string} = {
    US: "United States",
    GB: "United Kingdom",
    CA: "Canada",
    AU: "Australia",
    FR: "France",
    DE: "Germany",
    ES: "Spain",
    IT: "Italy",
    PT: "Portugal",
    BR: "Brazil",
    NL: "Netherlands",
    BE: "Belgium",
    CH: "Switzerland",
    JP: "Japan",
    KR: "South Korea",
    CN: "China",
    TW: "Taiwan",
    IN: "India",
    RU: "Russia",
    SA: "Saudi Arabia",
    AE: "United Arab Emirates",
    MX: "Mexico",
    AR: "Argentina",
    CL: "Chile",
    CO: "Colombia",
    PE: "Peru",
    VE: "Venezuela",
    PL: "Poland",
    CZ: "Czech Republic",
    SE: "Sweden",
    DK: "Denmark",
    FI: "Finland",
    NO: "Norway",
    GR: "Greece",
    IL: "Israel",
};

export function languageText(language: string) {
    if(!language) return "";

    const clean = language.trim();
    const lang = clean.slice(0, 2).toLowerCase();
    const locale = clean.length > 3 && /[-_]/.test(clean[2]) ? clean.slice(3) : "";
    const localeCode = locale.toUpperCase();
    const languageName = languages[lang] ?? clean.toUpperCase();
    const localeName = localeCode in locales ? locales[localeCode] : locale;

    return localeName && localeName !== locale
        ? `${languageName} (${localeName})`
        : languageName;
}

export function Editor(
    { content, src, project, path }:
    { content: string, src: string, project: Project, path: string[] }
) {
    const isSrc = content === src;
    const [isMd, setIsMd] = useState(false);

    const parts: [string, string][] = useMemo(() => {
        try {
            const json = JSON.parse(content);
            const entries: [string, string][] = [];
            for(const key of json) {
                entries.push([key, json[key]]);
            }
            return entries;
        } catch(e) {
            setIsMd(true);
            return [[isSrc ? "" : src, content]];
        }
    }, [content, src]);

    const [tempContent, updateContent] = useReducer(() => edited.current, parts);
    const edited = useRef(parts);
    const [savePopup, setSavePopup] = useState(false);

    const addButtons = useContext(ToolboxModifier);
    useEffect(() => {
        addButtons(() => [
            <button onClick={() => loadSource()}>Fetch source content</button>,
            <button onClick={() => setSavePopup(true)}>Save translations</button>
        ])
    });

    return (
        <div>
            {savePopup && <SavePopup />}
            <div>
                {tempContent.map(([key, value], index) => (
                    <div key={index}>
                        {!isSrc && <div>{key}</div> /*TODO add cursor for Markdown translation*/}
                        <textarea
                            onChange={({target}) => edited.current[index][1] = target.value}
                        >{value}</textarea>
                        <button onClick={() => loadSource(index)}>Fetch</button>
                    </div>
                ))}
            </div>
        </div>
    );

    function loadSource(index?: number) {
        if(isMd) {
            edited.current[0][1] = edited.current[0][1];
        } else {
            index
                ? edited.current[index][1] = src[index][1]
                : edited.current.map(([key, value], i) => [key, value || src[i][1]])
        }
        updateContent();
    }

    function SavePopup() {
        const inputRef = useRef<HTMLInputElement>(null);
        const [processError, setError] = useState("");
        return (
            <section>
                <label htmlFor="description">Enter changes description (optional)</label>
                <input type="text" ref={inputRef} name="description" />
                <p>{processError}</p>
                <button onClick={() => setSavePopup(false)}>Cancel</button>
                <button onClick={save}>Save</button>
            </section>
        );

        async function save() {
            const { error } = await fetch("/github/content", {
                method: "PATCH",
                body: JSON.stringify({
                    id: project.id,
                    locale: path[0],
                    translation: path[1],
                    path: path.slice(2),
                    message: inputRef.current!.value,
                    content: JSON.stringify(inputRef.current!.value),
                })
            }).then((res) => res.json());

            if(error) {
                setError(error);
            } else {
                setSavePopup(false);
            }
        }
    }
}