import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LibraryClient from "./LibraryClient";
import { Prisma, BookCategory } from "@prisma/client";
import type { Book } from "@/lib/types";

export const metadata = { title: "My Library" };

export default async function LibraryPage(
    props: {
        searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
    }
) {
    const user = await getSession();
    if (!user) {
        redirect("/api/auth/clear-session?from=/library");
    }

    const searchParams = await props.searchParams;
    const page = typeof searchParams?.page === "string" ? parseInt(searchParams.page) : 1;
    const q = typeof searchParams?.q === "string" ? searchParams.q : "";
    const category = typeof searchParams?.category === "string" ? searchParams.category : "ALL";
    const userLimit = typeof searchParams?.limit === "string" ? parseInt(searchParams.limit) : 25;
    const limit = [10, 25, 50, 100].includes(userLimit) ? userLimit : 25;
    const savedOnly = searchParams?.saved === "true";
    const sort = typeof searchParams?.sort === "string" && searchParams.sort === "asc" ? "asc" : "desc";

    const where: Prisma.BookWhereInput = {
        AND: [
            q ? {
                OR: [
                    { title: { contains: q, mode: "insensitive" } },
                    { author: { contains: q, mode: "insensitive" } }
                ]
            } : {},
            category !== "ALL" ? { category: category as BookCategory } : {},
            savedOnly ? { personalList: { some: { userId: user.id } } } : {},
        ]
    };

    const totalBooks = await prisma.book.count({ where });
    const totalPages = Math.ceil(totalBooks / limit) || 1;
    const validPage = Math.max(1, Math.min(page, totalPages));

    const rawBooks = await prisma.book.findMany({
        where,
        orderBy: { title: sort },
        skip: (validPage - 1) * limit,
        take: limit,
        include: {
            personalList: {
                where: { userId: user.id },
                select: { id: true },
            },
            readingProgress: {
                where: { userId: user.id },
                select: { lastPage: true, totalPage: true, lastReadAt: true },
            },
        },
    });

    // Enrich books with per-user data
    const books: Book[] = rawBooks.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        coverUrl: b.coverUrl,
        fileUrl: b.fileUrl,
        provider: b.provider as Book["provider"],
        lastPageRead: b.lastPageRead,
        totalPageCount: b.totalPageCount,
        fileSize: b.fileSize,
        mimeType: b.mimeType,
        tags: b.tags,
        category: b.category as Book["category"],
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        userId: b.userId,
        savedByUser: b.personalList.length > 0,
        userProgress: b.readingProgress[0]
            ? {
                  lastPage: b.readingProgress[0].lastPage,
                  totalPage: b.readingProgress[0].totalPage,
                  lastReadAt: b.readingProgress[0].lastReadAt,
              }
            : null,
    }));

    return (
        <LibraryClient
            user={user}
            books={books}
            currentPage={validPage}
            totalPages={totalPages}
            totalBooks={totalBooks}
            initialSearch={q}
            initialLimit={limit}
            initialSavedOnly={savedOnly}
            initialSort={sort}
        />
    );
}
