import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAddBook } from "@/lib/types";
import { extractDriveFileId } from "@/lib/gdrive-client";
import { getDriveClient } from "@/lib/gdrive";

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

        // ── Normalise fileUrl for GDrive → bare file ID ──────────────
        let normalizedFileUrl = fileUrl;
        let finalCoverUrl = coverUrl || null;

        if (provider === "GDRIVE") {
            const fileId = extractDriveFileId(fileUrl);
            if (!fileId) {
                return NextResponse.json(
                    { error: "Could not extract a valid Google Drive file ID from the provided URL." },
                    { status: 400 }
                );
            }
            normalizedFileUrl = fileId;

            // Auto-generate thumbnail from file ID unless a custom cover was provided
            const isValidCustomCover = finalCoverUrl && !finalCoverUrl.includes("drive.google.com");
            if (!isValidCustomCover) {
                finalCoverUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w600`;
                try {
                    const drive = getDriveClient();
                    const res: any = await drive.files.get({
                        fileId: fileId,
                        fields: "id, thumbnailLink, hasThumbnail"
                    });
                    if (res.data && res.data.hasThumbnail && res.data.thumbnailLink) {
                        finalCoverUrl = res.data.thumbnailLink.replace(/=s\d+/, "=s600");
                    }
                } catch (err) {
                    console.error("[BOOKS_POST] Failed to fetch thumbnailLink", err);
                }
            }
        }

        const existingBook = await prisma.book.findFirst({
            where: { fileUrl: normalizedFileUrl }
        });

        const bookData = {
            title,
            author: author || null,
            fileUrl: normalizedFileUrl,
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
