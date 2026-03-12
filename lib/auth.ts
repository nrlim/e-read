import { cookies } from "next/headers";
import { prisma } from "./prisma";

export async function getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get("e-read-session")?.value;
    if (!token) return null;

    const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
        return null;
    }

    return session.user;
}

export async function requireAuth() {
    const user = await getSession();
    if (!user) {
        return null;
    }
    return user;
}
