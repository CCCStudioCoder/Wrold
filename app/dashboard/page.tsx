'use client'

import {useAPI} from "@/app/util/client";
import {Suspense, useEffect, useRef, useState} from "react";
import {Loading} from "@/app/util/components";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ProjectDiv} from "@/app/util/bridges";

export default function Dashboard() {
    const [UserProvider, user, refreshUserData] = useAPI();

    const [joinPopup, setJoinPopup] = useState(false);

    useEffect(() => {
        if(user) document.title = user.pseudo + "'s dashboard";
    }, [user]);

    return (
        <main>
            <UserProvider width={500} height={500}>
                {user =>
                    <>
                        <h1>{user!.pseudo}'s projects</h1>
                        <button onClick={refreshUserData}>Refresh</button>
                        <div>
                            {user!.projects ? user!.projects.map((project, index) => (
                                    <Suspense key={index} fallback={<Loading height={200} width={1000}/>}>
                                        <ProjectDiv id={project} user={user.id} />
                                    </Suspense>
                                )) :
                                <p>You don't have any projects for now</p>}
                        </div>
                    </>
                }
            </UserProvider>
            <Link href="/projects/new">Create a project</Link>
            <button onClick={() => setJoinPopup(true)}>Join an already existent project</button>
            {joinPopup && <JoinPopup />}
        </main>
    );

    function JoinPopup()  {
        const tokenRef = useRef<HTMLInputElement>(null);
        const [error, setError] = useState("");
        const router = useRouter();

        return (
            <div>
                <p>Enter an invite token</p>
                <input type="text" ref={tokenRef} />
                {error && <p>{error}</p>}
                <button onClick={() => setJoinPopup(false)}>Cancel</button>
                <button onClick={async () => {
                    const { project, error } = await fetch("/api/invite_tokens", {
                        method: "POST",
                        body: JSON.stringify({
                            token: Number(tokenRef.current!.value)
                        }),
                    }).then(res => res.json());

                    if(error) setError(error);
                    else {
                        router.replace("/projects/" + project);
                        router.refresh();
                    }
                }}>Join</button>
            </div>
        );
    }
}