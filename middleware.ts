import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = ["/library", "/reader"];
const AUTH_ONLY = ["/auth/login", "/auth/register"];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get("e-read-session")?.value;

    // Redirect authenticated users away from auth pages
    const isAuthPage = AUTH_ONLY.some(p => pathname.startsWith(p));
    if (isAuthPage && token) {
        return NextResponse.redirect(new URL("/library", request.url));
    }

    // Protect private routes
    const isProtected = PROTECTED.some(p => pathname.startsWith(p));
    if (isProtected && !token) {
        const url = new URL("/auth/login", request.url);
        url.searchParams.set("from", pathname);
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/library/:path*", "/reader/:path*", "/auth/:path*"],
};
