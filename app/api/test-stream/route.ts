import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    const books = await prisma.book.findMany();
    return NextResponse.json({ books });
}
