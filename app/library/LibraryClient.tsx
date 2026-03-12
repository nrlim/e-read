"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Plus, LogOut, Search, Grid3X3, List, Cloud, FileText } from "lucide-react";
import type { Book, User } from "@/lib/types";
import { formatBytes, truncate } from "@/lib/utils";
import AddBookModal from "@/components/AddBookModal";

const providerLabel: Record<string, string> = {
    GDRIVE: "Google Drive",
    ONEDRIVE: "OneDrive",
    LOCAL: "Local",
};

const providerColor: Record<string, string> = {
    GDRIVE: "#4285F4",
    ONEDRIVE: "#0078D4",
    LOCAL: "var(--color-accent)",
};

export default function LibraryClient({
    user,
    books: initialBooks,
}: {
    user: Pick<User, "id" | "name" | "email">;
    books: Book[];
}) {
    const router = useRouter();
    const [books, setBooks] = useState(initialBooks);
    const [search, setSearch] = useState("");
    const [view, setView] = useState<"grid" | "list">("grid");
    const [showAdd, setShowAdd] = useState(false);
    const [signingOut, setSigningOut] = useState(false);

    const filtered = books.filter(
        b =>
            b.title.toLowerCase().includes(search.toLowerCase()) ||
            (b.author ?? "").toLowerCase().includes(search.toLowerCase())
    );

    async function handleSignOut() {
        setSigningOut(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
    }

    function onBookAdded(book: Book) {
        setBooks(prev => [book, ...prev]);
        setShowAdd(false);
    }

    return (
        <div
            style={{
                minHeight: "100dvh",
                background: "var(--color-bg)",
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* ── App Bar ─────────────────────────────────── */}
            <header
                style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 40,
                    background: "rgba(249,247,242,0.9)",
                    backdropFilter: "blur(12px)",
                    borderBottom: "1px solid var(--color-border)",
                }}
            >
                <div
                    style={{
                        maxWidth: 1200,
                        margin: "0 auto",
                        padding: "0 20px",
                        height: 60,
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                    }}
                >
                    {/* Logo */}
                    <Link
                        href="/"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            textDecoration: "none",
                            flexShrink: 0,
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                        </svg>
                        <span style={{ fontFamily: "var(--font-serif)", fontWeight: 700, fontSize: 18, color: "var(--color-ink)" }}>
                            e-Read
                        </span>
                    </Link>

                    {/* Search */}
                    <div style={{ flex: 1, maxWidth: 400, position: "relative" }}>
                        <Search size={15} strokeWidth={1.5} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-faint)" }} />
                        <input
                            id="library-search"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="input"
                            style={{ paddingLeft: 36, minHeight: 40, height: 40, fontSize: 14 }}
                            placeholder="Search by title or author..."
                        />
                    </div>

                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                        {/* View toggle */}
                        <div style={{ display: "flex", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)", padding: 3, border: "1px solid var(--color-border)", gap: 2 }}>
                            {(["grid", "list"] as const).map(v => (
                                <button
                                    key={v}
                                    onClick={() => setView(v)}
                                    style={{
                                        padding: "5px 8px",
                                        borderRadius: "var(--radius-sm)",
                                        border: "none",
                                        cursor: "pointer",
                                        background: view === v ? "var(--color-surface)" : "transparent",
                                        color: view === v ? "var(--color-accent)" : "var(--color-text-faint)",
                                        boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                                        transition: "all 0.15s ease",
                                        display: "flex",
                                        alignItems: "center",
                                    }}
                                    aria-label={`${v} view`}
                                    id={`view-${v}`}
                                >
                                    {v === "grid" ? <Grid3X3 size={15} strokeWidth={1.5} /> : <List size={15} strokeWidth={1.5} />}
                                </button>
                            ))}
                        </div>

                        {/* Add book */}
                        <button
                            onClick={() => setShowAdd(true)}
                            className="btn btn-primary"
                            style={{ padding: "8px 14px", fontSize: 13 }}
                            id="add-book-btn"
                        >
                            <Plus size={15} strokeWidth={2} />
                            Add book
                        </button>

                        {/* User menu */}
                        <button
                            onClick={handleSignOut}
                            disabled={signingOut}
                            className="btn btn-ghost"
                            style={{ padding: "8px 12px", fontSize: 13 }}
                            title={`Sign out (${user.email})`}
                            id="signout-btn"
                        >
                            <LogOut size={15} strokeWidth={1.5} />
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Content ──────────────────────────────────── */}
            <main
                style={{
                    flex: 1,
                    maxWidth: 1200,
                    margin: "0 auto",
                    padding: "32px 20px",
                    width: "100%",
                }}
            >


                {/* Empty state */}
                {filtered.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "80px 24px",
                            textAlign: "center",
                        }}
                    >
                        <div
                            style={{
                                width: 72,
                                height: 72,
                                borderRadius: "var(--radius-lg)",
                                background: "var(--color-accent-soft)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: 20,
                            }}
                        >
                            <BookOpen size={32} strokeWidth={1.5} color="var(--color-accent)" />
                        </div>
                        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--color-ink)", marginBottom: 8 }}>
                            {search ? "No books found" : "Your library is empty"}
                        </h2>
                        <p style={{ fontSize: 14, color: "var(--color-text-muted)", maxWidth: 320, lineHeight: 1.6 }}>
                            {search
                                ? "Try a different search term."
                                : "Connect your cloud storage or add a book to start reading."}
                        </p>
                        {!search && (
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowAdd(true)}
                                style={{ marginTop: 24 }}
                                id="empty-add-book-btn"
                            >
                                <Plus size={16} strokeWidth={2} />
                                Add your first book
                            </button>
                        )}
                    </motion.div>
                )}

                {/* Grid view */}
                {view === "grid" && filtered.length > 0 && (
                    <motion.div
                        layout
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                            gap: 20,
                        }}
                    >
                        <AnimatePresence mode="popLayout">
                            {filtered.map((book, i) => (
                                <BookCard key={book.id} book={book} index={i} />
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}

                {/* List view */}
                {view === "list" && filtered.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <AnimatePresence mode="popLayout">
                            {filtered.map((book, i) => (
                                <BookRow key={book.id} book={book} index={i} />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </main>

            {/* ── Add Book Modal ────────────────────────────── */}
            <AnimatePresence>
                {showAdd && (
                    <AddBookModal onClose={() => setShowAdd(false)} onAdded={onBookAdded} />
                )}
            </AnimatePresence>
        </div>
    );
}

/* ── Book Card (Grid) ───────────────────────────────── */
function BookCard({ book, index }: { book: Book; index: number }) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: index * 0.04, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
            <Link href={`/reader/${book.id}`} style={{ textDecoration: "none", display: "block" }}>
                <div className="card" style={{ cursor: "pointer" }}>
                    {/* Cover */}
                    <div
                        style={{
                            aspectRatio: "2/3",
                            background: `linear-gradient(135deg, ${providerColor[book.provider]}20 0%, var(--color-surface-2) 100%)`,
                            position: "relative",
                            overflow: "hidden",
                        }}
                    >
                        {book.coverUrl && (
                            <img
                                src={book.coverUrl}
                                alt={book.title}
                                referrerPolicy="no-referrer"
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    position: "absolute",
                                    inset: 0,
                                }}
                            />
                        )}
                        {!book.coverUrl && (
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <FileText size={32} strokeWidth={1.5} color="var(--color-text-faint)" />
                            </div>
                        )}

                        {/* Progress bar */}
                        {book.totalPages && book.currentPage > 0 && (
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(0,0,0,0.1)" }}>
                                <div
                                    style={{
                                        height: "100%",
                                        width: `${(book.currentPage / book.totalPages) * 100}%`,
                                        background: "var(--color-accent)",
                                        transition: "width 0.3s ease",
                                    }}
                                />
                            </div>
                        )}

                        {/* Provider badge */}
                        <div
                            style={{
                                position: "absolute",
                                top: 8,
                                right: 8,
                                padding: "2px 7px",
                                borderRadius: 99,
                                fontSize: 10,
                                fontWeight: 500,
                                background: "rgba(249,247,242,0.92)",
                                color: providerColor[book.provider],
                                border: "1px solid rgba(255,255,255,0.5)",
                            }}
                        >
                            {book.provider === "GDRIVE" ? "GDrive" : book.provider === "ONEDRIVE" ? "OneDrive" : "Local"}
                        </div>
                    </div>

                    {/* Meta */}
                    <div style={{ padding: "12px 12px 14px" }}>
                        <p
                            style={{
                                fontFamily: "var(--font-serif)",
                                fontSize: 14,
                                fontWeight: 600,
                                color: "var(--color-ink)",
                                lineHeight: 1.3,
                                marginBottom: 4,
                            }}
                        >
                            {truncate(book.title, 40)}
                        </p>
                        {book.author && (
                            <p style={{ fontSize: 12, color: "var(--color-text-faint)", lineHeight: 1.4 }}>
                                {truncate(book.author, 30)}
                            </p>
                        )}
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}

/* ── Book Row (List) ────────────────────────────────── */
function BookRow({ book, index }: { book: Book; index: number }) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ delay: index * 0.03, duration: 0.3 }}
        >
            <Link href={`/reader/${book.id}`} style={{ textDecoration: "none" }}>
                <div
                    style={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-md)",
                        padding: "14px 18px",
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                    }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = "var(--color-surface-2)";
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-2)";
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = "var(--color-surface)";
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                    }}
                >
                    {/* Thumbnail / Icon */}
                    <div
                        style={{
                            width: 40,
                            height: 56, // roughly 2:3 aspect ratio
                            borderRadius: "var(--radius-sm)",
                            background: `linear-gradient(135deg, ${providerColor[book.provider]}20 0%, var(--color-surface-2) 100%)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            overflow: "hidden",
                            position: "relative",
                        }}
                    >
                        {book.coverUrl ? (
                            <img
                                src={book.coverUrl}
                                alt={book.title}
                                referrerPolicy="no-referrer"
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    position: "absolute",
                                    inset: 0,
                                }}
                            />
                        ) : (
                            <FileText size={18} strokeWidth={1.5} color="var(--color-text-faint)" />
                        )}
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 600, color: "var(--color-ink)", marginBottom: 2 }}>
                            {book.title}
                        </p>
                        {book.author && (
                            <p style={{ fontSize: 13, color: "var(--color-text-faint)" }}>{book.author}</p>
                        )}
                    </div>

                    {/* Right meta */}
                    <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                        {book.fileSize && (
                            <span style={{ fontSize: 12, color: "var(--color-text-faint)" }}>
                                {formatBytes(book.fileSize)}
                            </span>
                        )}
                        {book.totalPages && book.currentPage > 0 && (
                            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                                p. {book.currentPage}/{book.totalPages}
                            </span>
                        )}
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}
