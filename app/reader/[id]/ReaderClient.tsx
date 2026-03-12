"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Library, Minus, Plus, Sun, Maximize, Minimize } from "lucide-react";
import type { Book } from "@/lib/types";

export default function ReaderClient({ book }: { book: Book }) {
    const [currentPage, setCurrentPage] = useState(book.currentPage || 1);
    const [totalPages, setTotalPages] = useState(book.totalPages || 0);
    const [fontSize, setFontSize] = useState(16); // px — for text-based rendering
    const [brightness, setBrightness] = useState(100); // %
    const [uiVisible, setUiVisible] = useState(true);
    const [fullscreen, setFullscreen] = useState(false);
    const [pageInput, setPageInput] = useState(String(currentPage));
    const [saving, setSaving] = useState(false);

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const hideTimeout = useRef<NodeJS.Timeout | null>(null);

    // Build embeddable URL for PDF
    const pdfUrl = buildEmbedUrl(book.fileUrl, book.provider);

    // Auto-hide UI after 3s of no mouse movement
    const resetHideTimer = useCallback(() => {
        setUiVisible(true);
        if (hideTimeout.current) clearTimeout(hideTimeout.current);
        hideTimeout.current = setTimeout(() => setUiVisible(false), 3500);
    }, []);

    useEffect(() => {
        resetHideTimer();
        return () => { if (hideTimeout.current) clearTimeout(hideTimeout.current); };
    }, [resetHideTimer]);

    // Persist page progress
    const saveProgress = useCallback(async (page: number) => {
        setSaving(true);
        try {
            await fetch(`/api/books/${book.id}/progress`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPage: page }),
            });
        } finally {
            setSaving(false);
        }
    }, [book.id]);

    function goToPage(p: number) {
        const clamped = Math.max(1, totalPages ? Math.min(totalPages, p) : p);
        setCurrentPage(clamped);
        setPageInput(String(clamped));
        saveProgress(clamped);
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setFullscreen(true);
        } else {
            document.exitFullscreen();
            setFullscreen(false);
        }
    }

    const progress = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;

    return (
        <div
            onMouseMove={resetHideTimer}
            onTouchStart={resetHideTimer}
            style={{
                position: "fixed",
                inset: 0,
                background: "#F5EDD8",
                display: "flex",
                flexDirection: "column",
                userSelect: "none",
            }}
        >
            {/* Warm paper overlay */}
            <div
                aria-hidden
                style={{
                    position: "absolute",
                    inset: 0,
                    background: `radial-gradient(ellipse at 50% 0%, rgba(255,220,120,0.12) 0%, transparent 60%)`,
                    pointerEvents: "none",
                    zIndex: 1,
                }}
            />

            {/* Brightness overlay */}
            <div
                aria-hidden
                style={{
                    position: "absolute",
                    inset: 0,
                    background: `rgba(0,0,0,${(100 - brightness) / 200})`,
                    pointerEvents: "none",
                    zIndex: 2,
                    transition: "background 0.2s ease",
                }}
            />

            {/* ── Top Bar ─────────────────────────────────── */}
            <AnimatePresence>
                {uiVisible && (
                    <motion.header
                        key="topbar"
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.2 }}
                        style={{
                            position: "relative",
                            zIndex: 10,
                            background: "rgba(245,237,216,0.9)",
                            backdropFilter: "blur(12px)",
                            borderBottom: "1px solid rgba(180,160,110,0.2)",
                            padding: "0 16px",
                            height: 54,
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                        }}
                    >
                        {/* Back */}
                        <Link
                            href="/library"
                            className="btn btn-ghost"
                            style={{ padding: "6px 12px", fontSize: 13, gap: 6 }}
                            id="reader-back-btn"
                        >
                            <Library size={15} strokeWidth={1.5} />
                            Library
                        </Link>

                        {/* Title */}
                        <div style={{ flex: 1, textAlign: "center" }}>
                            <p
                                style={{
                                    fontFamily: "var(--font-serif)",
                                    fontSize: 15,
                                    fontWeight: 600,
                                    color: "var(--color-ink)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {book.title}
                            </p>
                            {book.author && (
                                <p style={{ fontSize: 11, color: "var(--color-text-faint)", marginTop: 1 }}>{book.author}</p>
                            )}
                        </div>

                        {/* Controls */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            {/* Brightness */}
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <Sun size={14} strokeWidth={1.5} color="var(--color-text-faint)" />
                                <input
                                    type="range"
                                    min={40}
                                    max={100}
                                    value={brightness}
                                    onChange={e => setBrightness(Number(e.target.value))}
                                    style={{ width: 70, accentColor: "var(--color-accent)", cursor: "pointer" }}
                                    aria-label="Brightness"
                                    id="brightness-slider"
                                />
                            </div>

                            {/* Fullscreen */}
                            <button
                                onClick={toggleFullscreen}
                                className="btn btn-ghost"
                                style={{ padding: 6, width: 30, height: 30 }}
                                aria-label="Toggle fullscreen"
                                id="fullscreen-btn"
                            >
                                {fullscreen ? <Minimize size={14} strokeWidth={1.5} /> : <Maximize size={14} strokeWidth={1.5} />}
                            </button>

                            {/* Save indicator */}
                            {saving && (
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-accent)", opacity: 0.7 }} />
                            )}
                        </div>
                    </motion.header>
                )}
            </AnimatePresence>

            {/* ── PDF Viewer ──────────────────────────────── */}
            <div style={{ flex: 1, position: "relative", zIndex: 3, overflow: "hidden" }}>
                <iframe
                    ref={iframeRef}
                    src={pdfUrl}
                    title={book.title}
                    style={{
                        width: "100%",
                        height: "100%",
                        border: "none",
                        background: "transparent",
                    }}
                    allow="autoplay"
                    id="pdf-iframe"
                />

            </div>

        </div>
    );
}

/* ── Build embeddable PDF URL based on provider ─────── */
function buildEmbedUrl(fileUrl: string, provider: string): string {
    if (provider === "GDRIVE") {
        // Convert share URL to embed
        const match = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || fileUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://drive.google.com/file/d/${match[1]}/preview`;
        }
    }
    if (provider === "ONEDRIVE") {
        // Use OneDrive embed
        const encoded = encodeURIComponent(fileUrl.replace("1drv.ms", "").replace("https://", ""));
        return `https://onedrive.live.com/embed?resid=${encoded}&em=2`;
    }
    // For direct URLs, use Google Docs viewer as fallback
    return `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
}
