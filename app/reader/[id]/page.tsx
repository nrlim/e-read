import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ReaderClient from "./ReaderClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const book = await prisma.book.findUnique({ where: { id } });
    return { title: book ? `Reading: ${book.title}` : "Reader" };
}

export default async function ReaderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getSession();
    if (!user) redirect("/auth/login");

    const book = await prisma.book.findFirst({
        where: { id, userId: user.id },
    });
    if (!book) notFound();

    return <ReaderClient book={book} />;
}
