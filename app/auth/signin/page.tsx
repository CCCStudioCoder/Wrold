'use client'

import {useEffect, useRef, useState} from "react";
import {AwaitingRedirect} from "@/app/auth/login/page";
import {useRouter} from "next/navigation";
import Link from "next/link";

export default function Signing({ searchParams }: AwaitingRedirect) {
    const userRef = useRef<HTMLInputElement>(null);
    const pwRef = useRef<HTMLInputElement>(null);
    const cfPwRef = useRef<HTMLInputElement>(null);
    const [{url, error}, setParams] = useState<Awaited<AwaitingRedirect["searchParams"]>>({url: undefined, error: undefined});

    useEffect(() => {
        searchParams.then(res => setParams(res));
    }, [searchParams]);

    useEffect(() => {
        document.title = "Create an Wrold account";
    });

    const redirect = url ?? "/";

    const [statusInfo, setStatusInfo] = useState(error ?? "");

    const router = useRouter();

    return (
        <main>
            <h1>Logging in to OverTranslated</h1>
            <section>
                <label>Username</label>
                <input type="text" ref={userRef} />
            </section>
            <section>
                <label>Password</label>
                <input type="password" ref={pwRef} />
            </section>
            <section>
                <label>Confirm password</label>
                <input type="password" ref={cfPwRef} />
            </section>
            <p style={{color: "red"}} >{statusInfo}</p>
            <button onClick={handle}>Submit</button>
            <Link href={"./login?url=" + redirect}>Log in</Link>
        </main>
    );

    function handle() {
        setTimeout(submit, 2000);
    }

    async function submit() {
        const user = userRef.current!.value;
        const pw = pwRef.current!.value;
        const cfPw = cfPwRef.current!.value;

        if(pw !== cfPw) {
            return;
        }

        const request = await (await fetch("/api/auth/create_user", {
            method: "POST",
            body: JSON.stringify({
                username: user,
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