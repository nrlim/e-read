import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
    const url = new URL("/auth/login", request.url);
    const from = request.nextUrl.searchParams.get("from");
    if (from) {
        url.searchParams.set("from", from);
    }
    
    const response = NextResponse.redirect(url);
    response.cookies.delete("e-read-session");
    
    return response;
}
