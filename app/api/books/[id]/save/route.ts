import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/books/[id]/save
 * Saves a book to the current user's personal list.
 */
export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const user = await getSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const book = await prisma.book.findFirst({ where: { id } });
    if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Upsert so it's idempotent
    await prisma.personalList.upsert({
        where: { userId_bookId: { userId: user.id, bookId: id } },
        create: { userId: user.id, bookId: id },
        update: {},
    });

    return NextResponse.json({ saved: true });
}

/**
 * DELETE /api/books/[id]/save
 * Removes a book from the current user's personal list.
 */
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const user = await getSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await prisma.personalList.deleteMany({
        where: { userId: user.id, bookId: id },
    });

    return NextResponse.json({ saved: false });
}

/**
 * GET /api/books/[id]/save
 * Returns whether this book is in the current user's personal list.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const user = await getSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const entry = await prisma.personalList.findUnique({
        where: { userId_bookId: { userId: user.id, bookId: id } },
    });

    return NextResponse.json({ saved: !!entry });
}
