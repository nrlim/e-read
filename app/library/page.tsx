import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LibraryClient from "./LibraryClient";

export const metadata = { title: "My Library" };

export default async function LibraryPage() {
    const user = await getSession();
    if (!user) redirect("/auth/login");

    const books = await prisma.book.findMany({
        orderBy: { updatedAt: "desc" },
    });

    return <LibraryClient user={user} books={books} />;
}
