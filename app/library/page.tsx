import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LibraryClient from "./LibraryClient";
import { Prisma, BookCategory } from "@prisma/client";

export const metadata = { title: "My Library" };

export default async function LibraryPage(
    props: {
        searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
    }
) {
    const user = await getSession();
    if (!user) redirect("/auth/login");

    const searchParams = await props.searchParams;
    const page = typeof searchParams?.page === "string" ? parseInt(searchParams.page) : 1;
    const q = typeof searchParams?.q === "string" ? searchParams.q : "";
    const category = typeof searchParams?.category === "string" ? searchParams.category : "ALL";
    const userLimit = typeof searchParams?.limit === "string" ? parseInt(searchParams.limit) : 25;
    const limit = [10, 25, 50, 100].includes(userLimit) ? userLimit : 25;

    const where: Prisma.BookWhereInput = {
        AND: [
            q ? {
                OR: [
                    { title: { contains: q, mode: "insensitive" } },
                    { author: { contains: q, mode: "insensitive" } }
                ]
            } : {},
            category !== "ALL" ? { category: category as BookCategory } : {}
        ]
    };

    const totalBooks = await prisma.book.count({ where });
    const totalPages = Math.ceil(totalBooks / limit) || 1;
    const validPage = Math.max(1, Math.min(page, totalPages));

    const books = await prisma.book.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (validPage - 1) * limit,
        take: limit,
    });

    return (
        <LibraryClient
            user={user}
            books={books}
            currentPage={validPage}
            totalPages={totalPages}
            totalBooks={totalBooks}
            initialSearch={q}
            initialCategory={category}
            initialLimit={limit}
        />
    );
}
