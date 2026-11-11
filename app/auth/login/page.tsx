'use client'

import {useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";

export type AwaitingRedirect = {
    searchParams: Promise<{
        url?: string;
        error?: string;
    }>;
};

export default function Login({searchParams}: AwaitingRedirect) {
    const userRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);

    const [statusInfo, setStatusInfo] = useState("");

    const router = useRouter();

    const [{url}, setParams] = useState<Awaited<AwaitingRedirect["searchParams"]>>({url: undefined});
    const redirect = url ?? "/";

    useEffect(() => {
        searchParams.then(res => setParams(res));
    }, [searchParams]);

    useEffect(() => {
        document.title = "Login to Wrold";
    });

    return (
        <main>
            <h1>Creating an OverTranslated account</h1>
            <section>
                <label>Username</label>
                <input type="text" ref={userRef} />
            </section>
            <section>
                <label>Password</label>
                <input type="password" ref={passwordRef} />
            </section>
            <p style={{color: "red"}}>{statusInfo}</p>
            <button onClick={handle}>Submit</button>
            <Link href={'./signin?url=' + redirect}>Create an account</Link>
        </main>
    );

    function handle() {
        setTimeout(submit, 2000); // Avoid brute-force
    }

    async function submit() {
        const user = userRef.current!.value;
        const pw = passwordRef.current!.value;

        const request = await (await fetch("/api/auth/check_auth", {
            method: "POST",
            body: JSON.stringify({
                user: user,
                password: pw,
            })
        })).json();

        if(request.error) {
            setStatusInfo(request.error);
        } else {
            router.replace(redirect);
            router.refresh();
        }
    }
}