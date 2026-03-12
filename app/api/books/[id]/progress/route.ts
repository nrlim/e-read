import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDeleteBook } from "@/lib/types";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const user = await getSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { currentPage } = await req.json();

    const book = await prisma.book.findFirst({ where: { id, userId: user.id } });
    if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.book.update({
        where: { id },
        data: { currentPage: Number(currentPage) },
    });

    return NextResponse.json({ book: updated });
}

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
