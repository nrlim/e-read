import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAddBook, CloudProvider, BookCategory } from "@/lib/types";
import { extractDriveFileId } from "@/lib/gdrive-client";

export async function POST(req: NextRequest) {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!canAddBook(user.role)) {
        return NextResponse.json(
            { error: "You don't have permission to add books. Only Head and Lead can add books." },
            { status: 403 }
        );
    }

    try {
        const { books } = await req.json();

        if (!Array.isArray(books) || books.length === 0) {
            return NextResponse.json({ error: "Invalid payload, expected array of books" }, { status: 400 });
        }

        const validProviders: CloudProvider[] = ["GDRIVE", "ONEDRIVE", "LOCAL"];

        const booksToCreate: {
            title: string;
            author: string | null;
            fileUrl: string;
            coverUrl: string | null;
            provider: CloudProvider;
            category: BookCategory | null;
            userId: string;
        }[] = [];

        for (const b of books) {
            const { title, author, fileUrl, coverUrl, provider, category } = b;
            if (!title || !fileUrl) continue;

            const activeProvider: CloudProvider = validProviders.includes(provider as CloudProvider)
                ? (provider as CloudProvider)
                : "GDRIVE";

            let normalizedFileUrl = fileUrl as string;
            let finalCoverUrl: string | null = coverUrl || null;

            if (activeProvider === "GDRIVE") {
                const fileId = extractDriveFileId(fileUrl as string);
                if (!fileId) continue;

                normalizedFileUrl = fileId;
                const isValidCustomCover = finalCoverUrl && !finalCoverUrl.includes("drive.google.com");
                if (!isValidCustomCover) {
                    finalCoverUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w600`;
                }
            }

            booksToCreate.push({
                title: title as string,
                author: author || null,
                fileUrl: normalizedFileUrl,
                coverUrl: finalCoverUrl,
                provider: activeProvider,
                category: (category as BookCategory) || null,
                userId: user.id,
            });
        }

        if (booksToCreate.length === 0) {
            return NextResponse.json({ error: "No valid books found in the provided data." }, { status: 400 });
        }

        const incomingUrls = Array.from(new Set(booksToCreate.map(b => b.fileUrl)));

        const existingBooks = await prisma.book.findMany({
            where: { fileUrl: { in: incomingUrls } },
            select: { id: true, fileUrl: true },
        });

        const existingMap = new Map(existingBooks.map(eb => [eb.fileUrl, eb.id]));

        // Separate into creates and updates, execute individually (avoids $transaction signature complexity)
        await prisma.$transaction(async (tx) => {
            for (const b of booksToCreate) {
                const existingId = existingMap.get(b.fileUrl);
                if (existingId) {
                    await tx.book.update({ where: { id: existingId }, data: b });
                }
            }
            const newBooks = booksToCreate.filter(b => !existingMap.has(b.fileUrl));
            if (newBooks.length > 0) {
                await tx.book.createMany({ data: newBooks, skipDuplicates: true });
            }
        });

        return NextResponse.json({ success: true, count: booksToCreate.length }, { status: 201 });
    } catch (err) {
        if (process.env.NODE_ENV !== "production") {
            console.error("[BOOKS_BULK_POST] Unexpected error:", err instanceof Error ? err.message : String(err));
        }
        return NextResponse.json({ error: "Failed to upload books in bulk" }, { status: 500 });
    }
}
