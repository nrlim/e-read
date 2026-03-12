import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const books = await prisma.book.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ books });
}

export async function POST(req: NextRequest) {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { title, author, fileUrl, coverUrl, provider } = await req.json();

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
            // Check if the user pasted a non-image gdrive link into the coverUrl field
            const isValidImage = finalCoverUrl && !finalCoverUrl.includes("drive.google.com/file");

            if (!isValidImage) {
                const searchUrl = finalCoverUrl || fileUrl;
                const matchId = searchUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || searchUrl.match(/id=([a-zA-Z0-9_-]+)/);
                if (matchId && matchId[1]) {
                    finalCoverUrl = `https://drive.google.com/thumbnail?id=${matchId[1]}&sz=w600`;
                } else if (finalCoverUrl && finalCoverUrl.includes("drive.google.com/file")) {
                    finalCoverUrl = null; // Clear it if parsing failed instead of saving a bad link
                }
            }
        }

        const book = await prisma.book.create({
            data: {
                title,
                author: author || null,
                fileUrl,
                coverUrl: finalCoverUrl,
                provider,
                userId: user.id,
            },
        });

        return NextResponse.json({ book }, { status: 201 });
    } catch (err) {
        console.error("[BOOKS_POST]", err);
        return NextResponse.json({ error: "Failed to add book" }, { status: 500 });
    }
}
