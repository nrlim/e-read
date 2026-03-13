import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAddBook, BookCategory } from "@/lib/types";

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

        const validProviders = ["GDRIVE", "ONEDRIVE", "LOCAL"];

        const booksToCreate: any[] = [];

        for (const b of books) {
            const { title, author, fileUrl, coverUrl, provider, category } = b;

            if (!title || !fileUrl) {
                continue; // Skip invalid rows
            }

            const activeProvider = validProviders.includes(provider) ? provider : "GDRIVE";

            let finalCoverUrl = coverUrl || null;

            if (activeProvider === "GDRIVE") {
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

            // Simple check to ensure category is valid, if we care. 
            // The enum in db handles whether it's valid, but we must make sure it matches.
            // If it doesn't match an expected BookingCategory, Prisma might throw.
            // So we'll pass the category as-is if it's there.

            booksToCreate.push({
                title,
                author: author || null,
                fileUrl,
                coverUrl: finalCoverUrl,
                provider: activeProvider,
                category: category || null,
                userId: user.id
            });
        }

        if (booksToCreate.length === 0) {
            return NextResponse.json({ error: "No valid books found in the provided data." }, { status: 400 });
        }

        const incomingUrls = Array.from(new Set(booksToCreate.map(b => b.fileUrl)));
        
        const existingBooks = await prisma.book.findMany({
            where: {
                fileUrl: { in: incomingUrls }
            },
            select: { id: true, fileUrl: true }
        });

        const existingMap = new Map();
        for (const eb of existingBooks) {
            existingMap.set(eb.fileUrl, eb.id);
        }

        const updates = [];
        const creates = [];

        for (const b of booksToCreate) {
            const existingId = existingMap.get(b.fileUrl);
            if (existingId) {
                updates.push(prisma.book.update({
                    where: { id: existingId },
                    data: b
                }));
            } else {
                creates.push(b);
            }
        }
        
        const txOperations: any[] = [...updates];
        if (creates.length > 0) {
            txOperations.push(prisma.book.createMany({
                data: creates,
                skipDuplicates: true
            }));
        }

        await prisma.$transaction(txOperations);

        return NextResponse.json({ success: true, count: booksToCreate.length }, { status: 201 });
    } catch (err) {
        console.error("[BOOKS_BULK_POST]", err);
        return NextResponse.json({ error: "Failed to upload books in bulk" }, { status: 500 });
    }
}
