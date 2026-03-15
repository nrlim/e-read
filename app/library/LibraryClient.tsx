"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, Plus, Search, Grid3X3, List, Bookmark, Heart, X, RefreshCw, MoreHorizontal } from "lucide-react";
import type { Book, BookCategory, User, UserRole } from "@/lib/types";
import { canAddBook } from "@/lib/types";
import { formatBytes, truncate } from "@/lib/utils";
import AddBookModal, { CATEGORY_OPTIONS } from "@/components/AddBookModal";
import { ProfileDrawer } from "@/components/ProfileDrawer";
import SyncEngineButton from "@/components/SyncEngineButton";

/* ── Cover Fallback Helpers ─────────────────────────── */

function titleToHue(title: string): number {
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
}

function titleInitials(title: string): string {
    const words = title.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
}

/** Extract bare file-ID from a Drive URL or return `null` if not a Drive url */
function driveFileId(url: string): string | null {
    const patterns = [
        /\/d\/([a-zA-Z0-9_-]+)/,
        /[?&]id=([a-zA-Z0-9_-]+)/,
        /^([a-zA-Z0-9_-]{25,})$/, // bare ID (how fileUrl is stored after sync)
    ];
    for (const re of patterns) {
        const m = url.match(re);
        if (m?.[1]) return m[1];
    }
    return null;
}

/**
 * Returns the best URL to use for a book cover:
 *  - GDrive books → /api/thumb/<fileId>  (authenticated server-side proxy)
 *  - Other covers → the raw coverUrl (e.g. OpenLibrary, local, etc.)
 *  - null if no cover exists
 */
function resolveCoverUrl(book: Book): string | null {
    if (!book.coverUrl) return null;

    // If the stored coverUrl already contains a Drive file ID, use the proxy
    if (
        book.provider === "GDRIVE" ||
        book.coverUrl.includes("drive.google.com") ||
        book.coverUrl.includes("lh3.googleusercontent.com")
    ) {
        // Prefer the fileUrl to extract the fileId (more stable than the thumbnail URL)
        const idFromFile = driveFileId(book.fileUrl);
        const idFromCover = driveFileId(book.coverUrl);
        const fileId = idFromFile ?? idFromCover;
        if (fileId) return `/api/thumb/${fileId}`;
    }

    return book.coverUrl;
}

function BookCover({
    book,
    fontSize = 28,
}: {
    book: Book;
    fontSize?: number;
}) {
    const resolvedUrl = resolveCoverUrl(book);
    const [imgError, setImgError] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(false);

    // Reset error + loaded states whenever the cover URL changes
    useEffect(() => {
        setImgError(false);
        setImgLoaded(false);
    }, [resolvedUrl]);

    const showFallback = !resolvedUrl || imgError;
    const hue = titleToHue(book.title);
    const initials = titleInitials(book.title);

    if (showFallback) {
        return (
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    background: `linear-gradient(145deg, hsl(${hue},55%,52%) 0%, hsl(${hue + 30},45%,38%) 100%)`,
                    gap: 6,
                    padding: 6,
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: `hsl(${hue},70%,80%)`,
                        opacity: 0.7,
                    }}
                />
                <span
                    style={{
                        fontSize,
                        fontWeight: 800,
                        color: "rgba(255,255,255,0.95)",
                        lineHeight: 1,
                        letterSpacing: "-0.03em",
                        textShadow: "0 2px 8px rgba(0,0,0,0.25)",
                        userSelect: "none",
                    }}
                >
                    {initials}
                </span>
                <span
                    style={{
                        fontSize: Math.max(7, fontSize * 0.32),
                        fontWeight: 500,
                        color: "rgba(255,255,255,0.75)",
                        textAlign: "center",
                        lineHeight: 1.25,
                        maxWidth: "90%",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical" as React.CSSProperties["WebkitBoxOrient"],
                        wordBreak: "break-word",
                        userSelect: "none",
                    }}
                >
                    {book.title}
                </span>
            </div>
        );
    }

    return (
        <>
            {/* Shimmer skeleton shown while the image is still fetching */}
            {!imgLoaded && (
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: `linear-gradient(90deg,
                            var(--color-surface-2) 25%,
                            var(--color-surface)   50%,
                            var(--color-surface-2) 75%)`,
                        backgroundSize: "200% 100%",
                        animation: "shimmer 1.4s infinite linear",
                    }}
                />
            )}
            <img
                src={resolvedUrl}
                alt={book.title}
                style={{
                    width: "100%",
                    height: "100%",
                    position: "absolute",
                    inset: 0,
                    objectFit: "cover",
                    opacity: imgLoaded ? 1 : 0,
                    transition: "opacity 0.3s ease",
                }}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
            />
        </>
    );
}

/* ── Save Toggle Button ─────────────────────────────── */
function SaveButton({ book, onToggle }: { book: Book; onToggle: (bookId: string, saved: boolean) => void }) {
    const [saved, setSaved] = useState(book.savedByUser ?? false);
    const [loading, setLoading] = useState(false);

    async function toggle(e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (loading) return;
        setLoading(true);
        const nextSaved = !saved;
        try {
            await fetch(`/api/books/${book.id}/save`, {
                method: nextSaved ? "POST" : "DELETE",
            });
            setSaved(nextSaved);
            onToggle(book.id, nextSaved);
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            onClick={toggle}
            disabled={loading}
            id={`save-btn-${book.id}`}
            aria-label={saved ? "Remove from My List" : "Save to My List"}
            title={saved ? "Remove from My List" : "Save to My List"}
            style={{
                position: "absolute",
                top: 8,
                left: 8,
                /* 44×44 touch target */
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "none",
                background: saved
                    ? "rgba(139,105,20,0.90)"
                    : "rgba(249,247,242,0.88)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: loading ? "wait" : "pointer",
                boxShadow: "0 1px 6px rgba(0,0,0,0.18)",
                transition: "all 0.18s ease",
                backdropFilter: "blur(6px)",
                zIndex: 2,
                transform: loading ? "scale(0.9)" : "scale(1)",
            }}
        >
            <Bookmark
                size={13}
                strokeWidth={1.5}
                fill={saved ? "rgba(255,255,255,0.9)" : "none"}
                color={saved ? "rgba(255,255,255,0.9)" : "var(--color-accent)"}
            />
        </button>
    );
}

/* ── Mobile Search Overlay ──────────────────────────── */
function MobileSearchOverlay({
    value,
    onChange,
    onClose,
}: {
    value: string;
    onChange: (v: string) => void;
    onClose: () => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 80);
    }, []);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 60,
                    background: "rgba(249,247,242,0.96)",
                    backdropFilter: "blur(12px)",
                    display: "flex",
                    alignItems: "flex-start",
                    padding: "16px",
                    paddingTop: "20px",
                    gap: 12,
                }}
            >
                <div style={{ flex: 1, position: "relative" }}>
                    <Search
                        size={16}
                        strokeWidth={1.5}
                        style={{
                            position: "absolute",
                            left: 14,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "var(--color-text-faint)",
                        }}
                    />
                    <input
                        ref={inputRef}
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        className="input"
                        style={{ paddingLeft: 42, minHeight: 48, height: 48, fontSize: 16 }}
                        placeholder="Search by title or author..."
                    />
                </div>
                <button
                    onClick={onClose}
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--color-border)",
                        background: "var(--color-surface)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        flexShrink: 0,
                        color: "var(--color-text-muted)",
                    }}
                    aria-label="Close search"
                >
                    <X size={18} strokeWidth={2} />
                </button>
            </motion.div>
        </AnimatePresence>
    );
}

/* ── Mobile Action Menu (bottom sheet-style) ─────────── */
function MobileActionMenu({
    canAdd,
    userRole,
    onAddBook,
    onClose,
}: {
    canAdd: boolean;
    userRole: string;
    onAddBook: () => void;
    onClose: () => void;
}) {
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 55,
                    background: "rgba(26,26,26,0.35)",
                    backdropFilter: "blur(4px)",
                }}
                onClick={onClose}
            >
                <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 30, stiffness: 280 }}
                    onClick={e => e.stopPropagation()}
                    style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: "var(--color-bg)",
                        borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
                        padding: "20px 20px 32px",
                        boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
                    }}
                >
                    {/* Handle */}
                    <div
                        style={{
                            width: 36,
                            height: 4,
                            borderRadius: 99,
                            background: "var(--color-border-2)",
                            margin: "0 auto 20px",
                        }}
                    />
                    <p
                        style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--color-text-faint)",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            marginBottom: 14,
                        }}
                    >
                        Actions
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {canAdd && (
                            <button
                                onClick={() => { onAddBook(); onClose(); }}
                                className="btn btn-primary"
                                style={{ width: "100%", padding: "14px 20px", fontSize: 15, justifyContent: "flex-start", gap: 12 }}
                                id="mobile-add-book-btn"
                            >
                                <Plus size={18} strokeWidth={2} />
                                Add Book
                            </button>
                        )}
                        {/* Sync is for HEAD role only — rendered inside here as a wrapper */}
                        {userRole === "HEAD" && (
                            <MobileSyncButton />
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

/* ── Inline Mobile Sync Button ──────────────────────── */
function MobileSyncButton() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [progress, setProgress] = useState({ total: 0, processed: 0, currentFileName: "" });
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const router = useRouter();

    const startSync = () => {
        if (isSyncing) return;
        setIsSyncing(true);
        setProgress({ total: 0, processed: 0, currentFileName: "Initializing..." });

        const eventSource = new EventSource("/api/sync");
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "progress") {
                    setProgress({ total: data.totalFiles, processed: data.processedFiles, currentFileName: data.currentFileName });
                } else if (data.type === "complete") {
                    setToastMessage(`Library updated. ${data.newBooksAdded ?? 0} new books added.`);
                    setShowToast(true);
                    setIsSyncing(false);
                    eventSource.close();
                    router.refresh();
                    setTimeout(() => setShowToast(false), 4000);
                } else if (data.type === "error") {
                    setToastMessage(`Sync failed: ${data.message}`);
                    setShowToast(true);
                    setIsSyncing(false);
                    eventSource.close();
                    setTimeout(() => setShowToast(false), 4000);
                }
            } catch { /* noop */ }
        };
        eventSource.onerror = () => {
            setToastMessage("Connection lost during sync.");
            setShowToast(true);
            setIsSyncing(false);
            eventSource.close();
            setTimeout(() => setShowToast(false), 4000);
        };
    };

    return (
        <>
            <button
                onClick={startSync}
                disabled={isSyncing}
                className="btn"
                style={{
                    width: "100%",
                    padding: "14px 20px",
                    fontSize: 15,
                    justifyContent: "flex-start",
                    gap: 12,
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-ink)",
                    opacity: isSyncing ? 0.6 : 1,
                    cursor: isSyncing ? "not-allowed" : "pointer",
                }}
            >
                <motion.div
                    animate={isSyncing ? { rotate: 360 } : { rotate: 0 }}
                    transition={isSyncing ? { repeat: Infinity, duration: 1.5, ease: "linear" } : {}}
                    style={{ display: "flex", alignItems: "center" }}
                >
                    <RefreshCw size={18} strokeWidth={1.5} />
                </motion.div>
                {isSyncing ? `Syncing... ${progress.processed}/${progress.total || "?"}` : "Sync Now"}
            </button>
            {showToast && (
                <p style={{ fontSize: 13, color: "var(--color-text-muted)", textAlign: "center", marginTop: 4 }}>
                    {toastMessage}
                </p>
            )}
        </>
    );
}

/* ── Constants ──────────────────────────────────────── */

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

type FilterValue = "ALL" | "SAVED" | BookCategory;

const CHIPS: { value: FilterValue; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "SAVED", label: "My List" },
    ...CATEGORY_OPTIONS.map(o => ({ value: o.value as FilterValue, label: o.label })),
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
    CATEGORY_OPTIONS.map(o => [o.value, o.label])
);

/* ── Component ──────────────────────────────────────── */

export default function LibraryClient({
    user,
    books: initialBooks,
    currentPage = 1,
    totalPages = 1,
    totalBooks = 0,
    initialSearch = "",
    initialCategory = "ALL",
    initialLimit = 25,
    initialSavedOnly = false,
}: {
    user: Pick<User, "id" | "name" | "email" | "role">;
    books: Book[];
    currentPage?: number;
    totalPages?: number;
    totalBooks?: number;
    initialSearch?: string;
    initialCategory?: string;
    initialLimit?: number;
    initialSavedOnly?: boolean;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [books, setBooks] = useState<Book[]>(initialBooks);
    const [search, setSearch] = useState(initialSearch);
    const [limit, setLimit] = useState(initialLimit);
    const [activeCategory, setActiveCategory] = useState<FilterValue>(
        initialSavedOnly ? "SAVED" : (initialCategory as FilterValue)
    );
    const [view, setView] = useState<"grid" | "list">("grid");
    const [showAdd, setShowAdd] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const [showMobileSearch, setShowMobileSearch] = useState(false);
    const [showMobileActions, setShowMobileActions] = useState(false);
    const prevPageRef = useRef(currentPage);

    const canAdd = canAddBook(user.role);

    useEffect(() => {
        setBooks(initialBooks);
    }, [initialBooks]);

    useEffect(() => {
        if (prevPageRef.current !== currentPage) {
            window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
            prevPageRef.current = currentPage;
        }
    }, [currentPage]);

    const handleSaveToggle = useCallback((bookId: string, saved: boolean) => {
        setBooks(prev =>
            prev.map(b => b.id === bookId ? { ...b, savedByUser: saved } : b)
        );
        if (activeCategory === "SAVED" && !saved) {
            setBooks(prev => prev.filter(b => b.id !== bookId));
        }
    }, [activeCategory]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            const currentQ = searchParams.get("q") || "";
            const currentC = searchParams.get("category") || "ALL";
            const currentL = parseInt(searchParams.get("limit") || "25");
            const currentSaved = searchParams.get("saved") === "true";
            const isSaved = activeCategory === "SAVED";
            const categoryParam = isSaved ? "ALL" : activeCategory;

            if (
                search !== currentQ ||
                categoryParam !== currentC ||
                limit !== currentL ||
                isSaved !== currentSaved
            ) {
                const u = new URLSearchParams(searchParams.toString());
                if (search) u.set("q", search); else u.delete("q");
                if (categoryParam !== "ALL") u.set("category", categoryParam); else u.delete("category");
                if (limit !== 25) u.set("limit", limit.toString()); else u.delete("limit");
                if (isSaved) u.set("saved", "true"); else u.delete("saved");
                u.delete("page");
                startTransition(() => {
                    router.push(`${pathname}?${u.toString()}`);
                });
            }
        }, 400);
        return () => clearTimeout(timeout);
    }, [search, activeCategory, limit, pathname, router, searchParams]);

    function goToPage(p: number) {
        const u = new URLSearchParams(searchParams.toString());
        u.set("page", p.toString());
        startTransition(() => {
            router.push(`${pathname}?${u.toString()}`, { scroll: false });
        });
    }

    async function handleSignOut() {
        setSigningOut(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
    }

    function onBookAdded(_book: Book) {
        setShowAdd(false);
        router.refresh();
    }

    /* ── Render ── */
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
                    background: "rgba(249,247,242,0.92)",
                    backdropFilter: "blur(14px)",
                    borderBottom: "1px solid var(--color-border)",
                }}
            >
                <div
                    style={{
                        maxWidth: 1200,
                        margin: "0 auto",
                        padding: "0 16px",
                        height: 60,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                    }}
                >
                    {/* Logo */}
                    <Link
                        href="/library"
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

                    {/* ── Desktop Search ── (hidden on mobile) */}
                    <div className="hidden sm:block" style={{ flex: 1, maxWidth: 420, position: "relative" }}>
                        <Search size={15} strokeWidth={1.5} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-faint)" }} />
                        <input
                            id="library-search"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="input"
                            style={{ paddingLeft: 38, minHeight: 40, height: 40, fontSize: 14 }}
                            placeholder="Search by title or author..."
                        />
                    </div>

                    {/* ── Right Side Actions ── */}
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>

                        {/* Book count — desktop only */}
                        <div
                            className="hidden sm:flex"
                            style={{
                                padding: "4px 10px",
                                background: "var(--color-surface-2)",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--color-border)",
                                fontSize: 13,
                                fontWeight: 500,
                                color: "var(--color-text-muted)",
                                whiteSpace: "nowrap",
                                alignItems: "center",
                                height: 32,
                                marginRight: 4,
                            }}
                        >
                            {totalBooks} {totalBooks === 1 ? "ebook" : "ebooks"}
                        </div>

                        {/* View toggle — desktop only */}
                        <div className="hidden sm:flex" style={{ background: "var(--color-surface-2)", borderRadius: "var(--radius-md)", padding: 3, border: "1px solid var(--color-border)", gap: 2 }}>
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

                        {/* Desktop: Add book */}
                        {canAdd && (
                            <button
                                onClick={() => setShowAdd(true)}
                                className="btn btn-primary hidden sm:inline-flex"
                                style={{ padding: "8px 14px", fontSize: 13 }}
                                id="add-book-btn"
                            >
                                <Plus size={15} strokeWidth={2} />
                                Add book
                            </button>
                        )}

                        {/* Desktop: Sync */}
                        <div className="hidden sm:block">
                            <SyncEngineButton userRole={user.role} />
                        </div>

                        {/* Mobile: Search icon */}
                        <button
                            className="sm:hidden"
                            onClick={() => setShowMobileSearch(true)}
                            aria-label="Search"
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: "var(--radius-md)",
                                border: "1px solid var(--color-border)",
                                background: search ? "var(--color-accent-soft)" : "var(--color-surface)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                flexShrink: 0,
                                color: search ? "var(--color-accent)" : "var(--color-text-muted)",
                                position: "relative",
                            }}
                        >
                            <Search size={17} strokeWidth={1.5} />
                            {search && (
                                <span
                                    style={{
                                        position: "absolute",
                                        top: 8,
                                        right: 8,
                                        width: 6,
                                        height: 6,
                                        borderRadius: "50%",
                                        background: "var(--color-accent)",
                                    }}
                                />
                            )}
                        </button>

                        {/* Mobile: Actions menu (Add + Sync) */}
                        {(canAdd || user.role === "HEAD") && (
                            <button
                                className="sm:hidden"
                                onClick={() => setShowMobileActions(true)}
                                aria-label="More actions"
                                id="mobile-actions-btn"
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: "var(--radius-md)",
                                    border: "1px solid var(--color-border)",
                                    background: "var(--color-surface)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    flexShrink: 0,
                                    color: "var(--color-text-muted)",
                                }}
                            >
                                <MoreHorizontal size={18} strokeWidth={1.5} />
                            </button>
                        )}

                        {/* User menu / Profile Drawer */}
                        <ProfileDrawer
                            user={user}
                            onLogout={handleSignOut}
                            isLoggingOut={signingOut}
                        />
                    </div>
                </div>

                {/* ── Category Filter Chips ───────────────────── */}
                <div
                    style={{
                        maxWidth: 1200,
                        margin: "0 auto",
                        overflowX: "auto",
                        display: "flex",
                        gap: 8,
                        scrollbarWidth: "none",
                        msOverflowStyle: "none",
                        padding: "0 0 10px",
                    }}
                    className="hide-scrollbar"
                    role="tablist"
                    aria-label="Filter books by category"
                >
                    {/* Left padding spacer – aligns first chip with content */}
                    <div style={{ flexShrink: 0, width: 16 }} />
                    {CHIPS.map(chip => {
                        const isActive = activeCategory === chip.value;
                        const isSavedChip = chip.value === "SAVED";
                        return (
                            <motion.button
                                key={chip.value}
                                id={`filter-chip-${chip.value}`}
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => setActiveCategory(chip.value)}
                                whileTap={{ scale: 0.95 }}
                                style={{
                                    flexShrink: 0,
                                    /* Minimum 44px touch target height */
                                    padding: "9px 16px",
                                    borderRadius: 99,
                                    border: isActive
                                        ? "1.5px solid #1A1A1A"
                                        : isSavedChip
                                            ? "1.5px solid var(--color-accent)"
                                            : "1.5px solid var(--color-border)",
                                    background: isActive
                                        ? "#1A1A1A"
                                        : isSavedChip
                                            ? "var(--color-accent-soft)"
                                            : "#FFFDF9",
                                    color: isActive
                                        ? "#FAFAF8"
                                        : isSavedChip
                                            ? "var(--color-accent)"
                                            : "var(--color-text-muted)",
                                    fontSize: 13,
                                    fontWeight: isActive ? 600 : isSavedChip ? 500 : 400,
                                    cursor: "pointer",
                                    transition: "all 0.18s ease",
                                    whiteSpace: "nowrap",
                                    letterSpacing: "0.01em",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 5,
                                    minHeight: 36,
                                }}
                            >
                                {isSavedChip && (
                                    <Heart
                                        size={11}
                                        strokeWidth={1.5}
                                        fill={isActive ? "#FAFAF8" : "none"}
                                        color={isActive ? "#FAFAF8" : "var(--color-accent)"}
                                    />
                                )}
                                {chip.label}
                            </motion.button>
                        );
                    })}
                    {/* Right spacer */}
                    <div style={{ flexShrink: 0, width: 8 }} />
                </div>
            </header>

            {/* ── Content ──────────────────────────────────── */}
            <main
                style={{
                    flex: 1,
                    maxWidth: 1200,
                    margin: "0 auto",
                    padding: "20px 16px 40px",
                    width: "100%",
                }}
            >
                {/* Empty state */}
                <AnimatePresence mode="wait">
                    {books.length === 0 && (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.3 }}
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
                                    background: activeCategory === "SAVED"
                                        ? "rgba(139,105,20,0.08)"
                                        : "var(--color-accent-soft)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginBottom: 20,
                                }}
                            >
                                {activeCategory === "SAVED"
                                    ? <Heart size={32} strokeWidth={1.5} color="var(--color-accent)" />
                                    : <BookOpen size={32} strokeWidth={1.5} color="var(--color-accent)" />
                                }
                            </div>
                            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--color-ink)", marginBottom: 8 }}>
                                {activeCategory === "SAVED"
                                    ? "Your reading list is empty"
                                    : search
                                        ? "No books found"
                                        : activeCategory !== "ALL"
                                            ? `No books in "${CATEGORY_LABEL[activeCategory]}"`
                                            : "Your library is empty"}
                            </h2>
                            <p style={{ fontSize: 14, color: "var(--color-text-muted)", maxWidth: 340, lineHeight: 1.6, fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
                                {activeCategory === "SAVED"
                                    ? "Tap the bookmark icon on any book to save it to your personal reading list."
                                    : search
                                        ? "Try a different search term or clear the filter."
                                        : activeCategory !== "ALL"
                                            ? "Add a book and assign it to this category, or choose a different filter."
                                            : "Connect your cloud storage or add a book to start reading."}
                            </p>
                            {activeCategory !== "ALL" && (
                                <button
                                    className="btn"
                                    onClick={() => setActiveCategory("ALL")}
                                    style={{
                                        marginTop: 20,
                                        padding: "10px 24px",
                                        background: "#FFFDF9",
                                        border: "1.5px solid var(--color-border)",
                                        borderRadius: 99,
                                        cursor: "pointer",
                                        fontSize: 13,
                                        color: "var(--color-text-muted)",
                                    }}
                                    id="empty-clear-filter-btn"
                                >
                                    Show all books
                                </button>
                            )}
                            {!search && activeCategory === "ALL" && canAdd && (
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
                </AnimatePresence>

                {/* Grid view — responsive columns via CSS grid */}
                {view === "grid" && books.length > 0 && (
                    <motion.div
                        layout
                        className="book-grid"
                    >
                        <AnimatePresence mode="popLayout">
                            {books.map((book, i) => (
                                <BookCard key={book.id} book={book} index={i} onSaveToggle={handleSaveToggle} />
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}

                {/* List view */}
                {view === "list" && books.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <AnimatePresence mode="popLayout">
                            {books.map((book, i) => (
                                <BookRow key={book.id} book={book} index={i} onSaveToggle={handleSaveToggle} />
                            ))}
                        </AnimatePresence>
                    </div>
                )}

                {/* Bottom Pagination */}
                {(totalPages > 1 || books.length > 0) && (
                    <div
                        style={{
                            marginTop: 32,
                            opacity: isPending ? 0.6 : 1,
                            transition: "opacity 0.2s",
                            background: "var(--color-surface)",
                            padding: "16px 20px",
                            borderRadius: "var(--radius-lg)",
                            border: "1px solid var(--color-border)",
                            boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 16,
                        }}
                    >
                        {/* Prev / Next — full-width, centered on mobile */}
                        {totalPages > 1 && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 12,
                                    width: "100%",
                                }}
                            >
                                <button
                                    className="btn-ghost"
                                    disabled={currentPage <= 1 || isPending}
                                    onClick={() => goToPage(currentPage - 1)}
                                    id="prev-page-btn"
                                    style={{
                                        padding: "10px 28px",
                                        borderRadius: "var(--radius-md)",
                                        cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                                        opacity: currentPage <= 1 ? 0.4 : 1,
                                        fontSize: 14,
                                        fontWeight: 600,
                                        minHeight: 44,
                                        flex: "1 1 0",
                                        maxWidth: 140,
                                        textAlign: "center",
                                    }}
                                >
                                    ← Prev
                                </button>

                                <div
                                    style={{
                                        padding: "10px 20px",
                                        borderRadius: "var(--radius-md)",
                                        background: "var(--color-surface-2)",
                                        border: "1px solid var(--color-border)",
                                        fontSize: 14,
                                        color: "var(--color-ink)",
                                        fontWeight: 600,
                                        minWidth: 90,
                                        textAlign: "center",
                                        whiteSpace: "nowrap",
                                        lineHeight: 1,
                                    }}
                                >
                                    {currentPage} / {totalPages}
                                </div>

                                <button
                                    className="btn-ghost"
                                    disabled={currentPage >= totalPages || isPending}
                                    onClick={() => goToPage(currentPage + 1)}
                                    id="next-page-btn"
                                    style={{
                                        padding: "10px 28px",
                                        borderRadius: "var(--radius-md)",
                                        cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                                        opacity: currentPage >= totalPages ? 0.4 : 1,
                                        fontSize: 14,
                                        fontWeight: 600,
                                        minHeight: 44,
                                        flex: "1 1 0",
                                        maxWidth: 140,
                                        textAlign: "center",
                                    }}
                                >
                                    Next →
                                </button>
                            </div>
                        )}

                        {/* Show X items — centered below nav on mobile */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                fontSize: 13,
                                color: "var(--color-text-faint)",
                            }}
                        >
                            <span>Show</span>
                            <select
                                value={limit}
                                onChange={(e) => setLimit(parseInt(e.target.value))}
                                disabled={isPending}
                                className="input"
                                style={{
                                    padding: "6px 12px",
                                    minHeight: 36,
                                    height: 36,
                                    borderRadius: "var(--radius-sm)",
                                    fontSize: 14,
                                    fontWeight: 500,
                                    width: "auto",
                                }}
                            >
                                <option value={10}>10 items</option>
                                <option value={25}>25 items</option>
                                <option value={50}>50 items</option>
                                <option value={100}>100 items</option>
                            </select>
                            <span style={{ color: "var(--color-text-faint)", fontSize: 12 }}>
                                · {totalBooks} total
                            </span>
                        </div>
                    </div>
                )}
            </main>

            {/* ── Add Book Modal ─────────────────────────────── */}
            <AnimatePresence>
                {showAdd && (
                    <AddBookModal onClose={() => setShowAdd(false)} onAdded={onBookAdded} />
                )}
            </AnimatePresence>

            {/* ── Mobile Search Overlay ─────────────────────── */}
            {showMobileSearch && (
                <MobileSearchOverlay
                    value={search}
                    onChange={setSearch}
                    onClose={() => setShowMobileSearch(false)}
                />
            )}

            {/* ── Mobile Actions Sheet ──────────────────────── */}
            {showMobileActions && (
                <MobileActionMenu
                    canAdd={canAdd}
                    userRole={user.role}
                    onAddBook={() => setShowAdd(true)}
                    onClose={() => setShowMobileActions(false)}
                />
            )}
        </div>
    );
}

/* ── Book Card (Grid) ──────────────────────────────── */
function BookCard({
    book,
    index,
    onSaveToggle,
}: {
    book: Book;
    index: number;
    onSaveToggle: (bookId: string, saved: boolean) => void;
}) {
    const progressLastPage = book.userProgress?.lastPage ?? book.lastPageRead;
    const progressTotalPage = book.userProgress?.totalPage ?? book.totalPageCount ?? 0;
    const progressPct = progressTotalPage > 0 && progressLastPage > 0
        ? Math.min(100, (progressLastPage / progressTotalPage) * 100)
        : 0;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: index * 0.04, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ height: "100%", width: "100%", minWidth: 0 }}
        >
            <Link href={`/reader/${book.id}`} style={{ textDecoration: "none", display: "block", height: "100%", width: "100%" }}>
                <div className="card" style={{ cursor: "pointer", display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
                    {/* Cover — enforced 2:3 book aspect ratio */}
                    <div
                        style={{
                            width: "100%",
                            aspectRatio: "2/3",
                            background: `linear-gradient(135deg, ${providerColor[book.provider] ?? "var(--color-accent)"}20 0%, var(--color-surface-2) 100%)`,
                            position: "relative",
                            overflow: "hidden",
                            flexShrink: 0,
                        }}
                    >
                        <BookCover book={book} fontSize={28} />

                        {/* Reading Progress bar */}
                        {progressPct > 0 && (
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(0,0,0,0.1)", zIndex: 1 }}>
                                <div
                                    style={{
                                        height: "100%",
                                        width: `${progressPct}%`,
                                        background: "var(--color-accent)",
                                        transition: "width 0.3s ease",
                                    }}
                                />
                            </div>
                        )}

                        {/* Save/Bookmark */}
                        <SaveButton book={book} onToggle={onSaveToggle} />

                        {/* Provider badge */}
                        <div
                            style={{
                                position: "absolute",
                                top: 8,
                                right: 8,
                                padding: "2px 7px",
                                borderRadius: 99,
                                fontSize: 9,
                                fontWeight: 500,
                                background: "rgba(249,247,242,0.92)",
                                color: providerColor[book.provider] ?? "var(--color-ink)",
                                border: "1px solid rgba(255,255,255,0.5)",
                            }}
                        >
                            {providerLabel[book.provider] ?? book.provider}
                        </div>

                        {/* Category badge */}
                        {book.category && (
                            <div
                                style={{
                                    position: "absolute",
                                    bottom: progressPct > 0 ? 7 : 8,
                                    left: 8,
                                    padding: "2px 7px",
                                    borderRadius: 99,
                                    fontSize: 9,
                                    fontWeight: 600,
                                    background: "rgba(26,26,26,0.78)",
                                    color: "#FAFAF8",
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                    backdropFilter: "blur(4px)",
                                    zIndex: 1,
                                    marginBottom: progressPct > 0 ? 3 : 0,
                                }}
                            >
                                {CATEGORY_LABEL[book.category] ?? book.category}
                            </div>
                        )}
                    </div>

                    {/* Meta */}
                    <div style={{ padding: "10px 10px 12px", display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "space-between" }}>
                        <div>
                            {/* line-clamp-2 and minHeight keeps heights uniform */}
                            <p
                                style={{
                                    fontFamily: "var(--font-serif)",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: "var(--color-ink)",
                                    lineHeight: 1.3,
                                    marginBottom: 4,
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical" as React.CSSProperties["WebkitBoxOrient"],
                                    overflow: "hidden",
                                    minHeight: "33.8px", /* 13px * 1.3 * 2 lines */
                                    wordBreak: "break-word",
                                }}
                            >
                                {book.title}
                            </p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
                            {book.author ? (
                                <p style={{ fontSize: 11, color: "var(--color-text-faint)", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {book.author}
                                </p>
                            ) : (
                                <div style={{ height: "15.4px" }} aria-hidden="true" />
                            )}
                            
                            {progressPct > 0 ? (
                                <p style={{ fontSize: 10, color: "var(--color-accent)", fontWeight: 500, letterSpacing: "0.01em" }}>
                                    p. {progressLastPage}/{progressTotalPage} · {Math.round(progressPct)}%
                                </p>
                            ) : (
                                <div style={{ height: "14px" }} aria-hidden="true" />
                            )}
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}

/* ── Book Row (List) ────────────────────────────────── */
function BookRow({
    book,
    index,
    onSaveToggle,
}: {
    book: Book;
    index: number;
    onSaveToggle: (bookId: string, saved: boolean) => void;
}) {
    const progressLastPage = book.userProgress?.lastPage ?? book.lastPageRead;
    const progressTotalPage = book.userProgress?.totalPage ?? book.totalPageCount ?? 0;
    const progressPct = progressTotalPage > 0 && progressLastPage > 0
        ? Math.min(100, (progressLastPage / progressTotalPage) * 100)
        : 0;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ delay: index * 0.03, duration: 0.3 }}
        >
            <div style={{ position: "relative" }}>
                <Link href={`/reader/${book.id}`} style={{ textDecoration: "none" }}>
                    <div
                        style={{
                            background: "var(--color-surface)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "var(--radius-md)",
                            padding: "12px 16px",
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            overflow: "hidden",
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
                        {/* Thumbnail */}
                        <div
                            style={{
                                width: 38,
                                height: 52,
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
                            <BookCover book={book} fontSize={14} />
                        </div>

                        {/* Text */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontFamily: "var(--font-serif)", fontSize: 14, fontWeight: 600, color: "var(--color-ink)", marginBottom: 2 }}>
                                {book.title}
                            </p>
                            {book.author && (
                                <p style={{ fontSize: 12, color: "var(--color-text-faint)" }}>{book.author}</p>
                            )}
                            {progressPct > 0 && (
                                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ flex: 1, height: 3, background: "var(--color-border)", borderRadius: 99, overflow: "hidden", maxWidth: 120 }}>
                                        <div
                                            style={{
                                                height: "100%",
                                                width: `${progressPct}%`,
                                                background: "var(--color-accent)",
                                                borderRadius: 99,
                                                transition: "width 0.3s ease",
                                            }}
                                        />
                                    </div>
                                    <span style={{ fontSize: 11, color: "var(--color-accent)", fontWeight: 500 }}>
                                        p. {progressLastPage}/{progressTotalPage}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Right meta */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                            {book.category && (
                                <span
                                    className="hidden sm:inline-flex"
                                    style={{
                                        padding: "3px 10px",
                                        borderRadius: 99,
                                        fontSize: 11,
                                        fontWeight: 500,
                                        background: "#FFFDF9",
                                        border: "1px solid var(--color-border)",
                                        color: "var(--color-text-muted)",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {CATEGORY_LABEL[book.category] ?? book.category}
                                </span>
                            )}
                            {book.fileSize && (
                                <span className="hidden sm:inline" style={{ fontSize: 12, color: "var(--color-text-faint)" }}>
                                    {formatBytes(book.fileSize)}
                                </span>
                            )}
                        </div>
                    </div>
                </Link>

                {/* Save button — outside the Link */}
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        right: 54,
                        transform: "translateY(-50%)",
                        zIndex: 2,
                    }}
                >
                    <SaveButton book={book} onToggle={onSaveToggle} />
                </div>
            </div>
        </motion.div>
    );
}
