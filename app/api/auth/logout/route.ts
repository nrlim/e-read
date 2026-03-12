import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function POST() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("e-read-session")?.value;

        if (token) {
            await prisma.session.deleteMany({ where: { token } });
        }

        const response = NextResponse.json({ success: true });
        response.cookies.delete("e-read-session");
        return response;
    } catch {
        return NextResponse.json({ error: "Failed to sign out" }, { status: 500 });
    }
}
