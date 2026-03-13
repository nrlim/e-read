import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAddBook } from "@/lib/types";

export async function GET() {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const books = await prisma.book.findMany({
        orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ books });
}

export async function POST(req: NextRequest) {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Role guard: only HEAD and LEAD can add books
    if (!canAddBook(user.role)) {
        return NextResponse.json(
            { error: "You don't have permission to add books. Only Head and Lead can add books." },
            { status: 403 }
        );
    }

    try {
        const { title, author, fileUrl, coverUrl, provider, category } = await req.json();

        if (!title || !fileUrl) {
            return NextResponse.json({ error: "Title and fileUrl are required" }, { status: 400 });
        }

        const validProviders = ["GDRIVE", "ONEDRIVE", "LOCAL"];
        if (!validProviders.includes(provider)) {
            return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
        }

        let finalCoverUrl = coverUrl || null;

        // Auto-detect GDrive thumbnail
        if (provider === "GDRIVE") {
            const isValidImage = finalCoverUrl && !finalCoverUrl.includes("drive.google.com/file");

            if (!isValidImage) {
                const searchUrl = finalCoverUrl || fileUrl;
                const matchId = searchUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || searchUrl.match(/id=([a-zA-Z0-9_-]+)/);
                if (matchId && matchId[1]) {
                    finalCoverUrl = `https://drive.google.com/thumbnail?id=${matchId[1]}&sz=w600`;
                } else if (finalCoverUrl && finalCoverUrl.includes("drive.google.com/file")) {
                    finalCoverUrl = null;
                }
            }
        }

        const existingBook = await prisma.book.findFirst({
            where: { fileUrl }
        });

        const bookData = {
            title,
            author: author || null,
            fileUrl,
            coverUrl: finalCoverUrl,
            provider,
            category: category || null,
            userId: user.id,
        };

        let book;
        if (existingBook) {
            book = await prisma.book.update({
                where: { id: existingBook.id },
                data: bookData,
            });
        } else {
            book = await prisma.book.create({
                data: bookData,
            });
        }

        return NextResponse.json({ book }, { status: 201 });
    } catch (err) {
        console.error("[BOOKS_POST]", err);
        return NextResponse.json({ error: "Failed to add book" }, { status: 500 });
    }
}
