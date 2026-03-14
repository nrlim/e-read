import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDeleteBook } from "@/lib/types";

/**
 * GET /api/books/[id]/progress
 * Returns the current user's reading progress for this book.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const user = await getSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const progress = await prisma.readingProgress.findUnique({
        where: { userId_bookId: { userId: user.id, bookId: id } },
    });

    // Fallback to the book's global lastPageRead if no per-user record exists yet
    if (!progress) {
        const book = await prisma.book.findFirst({ where: { id } });
        return NextResponse.json({
            lastPage: book?.lastPageRead ?? 1,
            totalPage: book?.totalPageCount ?? 0,
        });
    }

    return NextResponse.json({
        lastPage: progress.lastPage,
        totalPage: progress.totalPage,
        lastReadAt: progress.lastReadAt,
    });
}

/**
 * PATCH /api/books/[id]/progress
 * Body: { lastPageRead: number; totalPageCount?: number }
 * Updates reading progress for the current user.
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const user = await getSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { lastPageRead, totalPageCount } = await req.json();

    const book = await prisma.book.findFirst({ where: { id } });
    if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const lastPage = Number(lastPageRead);
    const totalPage = totalPageCount !== undefined ? Number(totalPageCount) : undefined;

    // Upsert per-user progress record
    const progress = await prisma.readingProgress.upsert({
        where: { userId_bookId: { userId: user.id, bookId: id } },
        create: {
            userId: user.id,
            bookId: id,
            lastPage,
            totalPage: totalPage ?? 0,
        },
        update: {
            lastPage,
            ...(totalPage !== undefined && { totalPage }),
        },
    });

    // Also update the Book's global lastPageRead for backward compatibility
    await prisma.book.update({
        where: { id },
        data: {
            lastPageRead: lastPage,
            ...(totalPage !== undefined && { totalPageCount: totalPage }),
        },
    });

    return NextResponse.json({ progress });
}

/**
 * DELETE /api/books/[id]/progress  (actually deletes the book)
 */
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const user = await getSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Role guard: only HEAD and LEAD can delete books
    if (!canDeleteBook(user.role)) {
        return NextResponse.json(
            { error: "You don't have permission to delete books." },
            { status: 403 }
        );
    }

    const book = await prisma.book.findFirst({ where: { id, userId: user.id } });
    if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.book.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
