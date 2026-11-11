import {NextRequest, NextResponse} from "next/server";

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const session = request.cookies.get("session")?.value;
    const user = request.cookies.get("user")?.value;

    if (pathname !== "/" && !session) {
        return Response.redirect(
            new URL(`/auth/login?url=${request.url}`, request.url)
        );
    }

    const response = NextResponse.next();
    if(session && user && /^[1-9]\d*$/.test(user) && Number.isSafeInteger(Number(user))) {
        response.cookies.set("user", user, {
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 30,
            path: "/"
        });
    }
    return response;
}

const noLogin = [
    "auth",
    "_next",
    "favicon.ico"
];

export const config = {
    matcher: [`/((?!${noLogin.join("|")}).*)`]
};
