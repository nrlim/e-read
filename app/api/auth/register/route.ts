import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/utils";

export async function POST(req: NextRequest) {
    try {
        const { name, email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
        }

        if (password.length < 8) {
            return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
        }

        const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (existing) {
            return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
        }

        const hashed = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                password: hashed,
                name: name || null,
            },
        });

        // Auto-login: create session
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await prisma.session.create({
            data: { userId: user.id, token, expiresAt },
        });

        const response = NextResponse.json({
            user: { id: user.id, email: user.email, name: user.name },
        }, { status: 201 });

        response.cookies.set("e-read-session", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            expires: expiresAt,
        });

        return response;
    } catch (err) {
        console.error("[REGISTER]", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
