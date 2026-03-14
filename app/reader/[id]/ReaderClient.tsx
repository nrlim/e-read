"use client";

/**
 * ReaderClient.tsx
 * ─────────────────────────────────────────────────────────────────────────
 * Premium PDF reader built on PDF.js (pdfjs-dist).
 *
 * Features:
 *  • Full-viewport canvas rendering — maximum page real-estate
 *  • Zoom in / out / fit controls (50 – 200%)
 *  • Keyboard navigation: ← → ArrowLeft ArrowRight, Space / Shift+Space
 *  • Swipe gesture support (mobile)
 *  • Smooth animated page transitions
 *  • Auto-saves lastPageRead via debounced PATCH to /api/books/[id]/progress
 *  • Reading Mode (hides chrome, auto-hides UI)
 *  • Brightness slider & fullscreen toggle
 *  • Settings panel: zoom, brightness, theme
 *  • Warm-light, Sepia, and Night themes
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import Link from "next/link";
import {
    ChevronLeft,
    ChevronRight,
    Library,
    Sun,
    Maximize,
    Minimize,
    EyeOff,
    Eye,
    BookOpen,
    Loader2,
    AlertTriangle,
    ZoomIn,
    ZoomOut,
    Settings,
    X,
    Moon,
    Coffee,
} from "lucide-react";
import type { Book } from "@/lib/types";
import { extractDriveFileId } from "@/lib/gdrive-client";

// ─── PDF.js worker ───────────────────────────────────────────────────────────
let pdfjs: typeof import("pdfjs-dist") | null = null;

async function getPdfjs() {
    if (pdfjs) return pdfjs;
    pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return pdfjs;
}

// ─── Debounce helper ─────────────────────────────────────────────────────────
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number) {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

// ─── Theme definitions ───────────────────────────────────────────────────────
const THEMES = {
    warm: {
        label: "Warm",
        bg: "#F5EDD8",
        pageBg: "#FFFDF6",
        icon: Coffee,
    },
    sepia: {
        label: "Sepia",
        bg: "#E8DCC8",
        pageBg: "#F5EDDB",
        icon: BookOpen,
    },
    night: {
        label: "Night",
        bg: "#1A1714",
        pageBg: "#252220",
        icon: Moon,
    },
    white: {
        label: "Light",
        bg: "#F0F0F0",
        pageBg: "#FFFFFF",
        icon: Sun,
    },
} as const;

type ThemeKey = keyof typeof THEMES;

// ─── Component ───────────────────────────────────────────────────────────────
export default function ReaderClient({ book }: { book: Book }) {
    const [currentPage, setCurrentPage] = useState(Math.max(1, book.lastPageRead));
    const [totalPages, setTotalPages] = useState(book.totalPageCount ?? 0);
    const [brightness, setBrightness] = useState(100);
    const [uiVisible, setUiVisible] = useState(true);
    const [readingMode, setReadingMode] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [pageInput, setPageInput] = useState(String(Math.max(1, book.lastPageRead)));
    const [saving, setSaving] = useState(false);
    const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">("loading");
    const [errorMsg, setErrorMsg] = useState("");
    const [zoom, setZoom] = useState(100); // percentage, 50-200
    const [showSettings, setShowSettings] = useState(false);
    const [theme, setTheme] = useState<ThemeKey>("warm");
    const [resumeToast, setResumeToast] = useState<{ page: number } | null>(null);
    const initialPageRef = useRef(Math.max(1, book.lastPageRead));

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pdfDocRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
    const renderTaskRef = useRef<import("pdfjs-dist").RenderTask | null>(null);
    const isRenderingRef = useRef(false);
    const renderPendingRef = useRef<{ isPending: boolean; isResize: boolean }>({ isPending: false, isResize: false });
    const pageDirectionRef = useRef<1 | -1>(1); // tracks direction without stale closure
    const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef<number | null>(null);
    const pageControls = useAnimation();

    const proxyUrl = buildProxyUrl(book.fileUrl, book.provider);
    const currentTheme = THEMES[theme];

    // ── Auto-hide UI in reading mode ──────────────────────────────────────────
    const resetHideTimer = useCallback(() => {
        if (readingMode) {
            setUiVisible(true);
            if (hideTimeout.current) clearTimeout(hideTimeout.current);
            hideTimeout.current = setTimeout(() => setUiVisible(false), 3500);
        } else {
            setUiVisible(true);
            if (hideTimeout.current) clearTimeout(hideTimeout.current);
        }
    }, [readingMode]);

    useEffect(() => {
        resetHideTimer();
        return () => {
            if (hideTimeout.current) clearTimeout(hideTimeout.current);
        };
    }, [resetHideTimer]);

    // ── Keyboard navigation ───────────────────────────────────────────────────
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            // Don't interfere with input fields
            if ((e.target as HTMLElement).tagName === "INPUT") return;
            if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
                e.preventDefault();
                goToPage(currentPage + 1, 1);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                goToPage(currentPage - 1, -1);
            } else if (e.key === "+" || e.key === "=") {
                setZoom(z => Math.min(200, z + 10));
            } else if (e.key === "-") {
                setZoom(z => Math.max(50, z - 10));
            } else if (e.key === "0") {
                setZoom(100);
            }
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, totalPages]);

    // ── Load PDF document (with Smart Resume) ────────────────────────────────
    useEffect(() => {
        let cancelled = false;

        async function loadPdf() {
            setLoadStatus("loading");
            setErrorMsg("");
            try {
                // Fetch per-user reading progress first
                const progressRes = await fetch(`/api/books/${book.id}/progress`);
                let resumePage = Math.max(1, book.lastPageRead);
                if (progressRes.ok) {
                    const progressData = await progressRes.json();
                    if (progressData.lastPage && progressData.lastPage > 1) {
                        resumePage = progressData.lastPage;
                    }
                }

                if (cancelled) return;

                // Jump to saved page
                if (resumePage > 1) {
                    setCurrentPage(resumePage);
                    setPageInput(String(resumePage));
                    initialPageRef.current = resumePage;
                    setResumeToast({ page: resumePage });
                    // Auto-dismiss toast
                    setTimeout(() => setResumeToast(null), 3500);
                }

                const lib = await getPdfjs();
                const loadingTask = lib.getDocument({ url: proxyUrl, withCredentials: true });
                const doc = await loadingTask.promise;
                if (cancelled) return;

                pdfDocRef.current = doc;
                const numPages = doc.numPages;
                setTotalPages(numPages);

                // Update total page count if changed
                if (!book.totalPageCount || book.totalPageCount !== numPages) {
                    await fetch(`/api/books/${book.id}/progress`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            lastPageRead: resumePage,
                            totalPageCount: numPages,
                        }),
                    });
                }

                setLoadStatus("ready");
            } catch (err) {
                if (cancelled) return;
                const msg = err instanceof Error ? err.message : "Failed to load PDF";
                console.error("[ReaderClient] PDF load error:", err);
                setErrorMsg(msg);
                setLoadStatus("error");
            }
        }

        loadPdf();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [proxyUrl]);

    // ── Render current page ───────────────────────────────────────────────────
    // Double-buffer strategy:
    //   1. Render new page to an OffscreenCanvas (invisible)
    //   2. Slide current canvas out (skipped if resizing)
    //   3. Atomically blit the complete new page onto the visible canvas
    //   4. Slide the canvas back in from the opposite direction (skipped if resizing)
    const renderCurrentPage = useCallback(async (isResize = false) => {
        if (loadStatus !== "ready" || !pdfDocRef.current || !canvasRef.current) return;

        if (isRenderingRef.current) {
            const alreadyPendingNormal = renderPendingRef.current.isPending && !renderPendingRef.current.isResize;
            renderPendingRef.current = {
                isPending: true,
                isResize: isResize && !alreadyPendingNormal
            };
            return;
        }
        isRenderingRef.current = true;
        renderPendingRef.current = { isPending: false, isResize: false };

        try {
            // Cancel any in-flight task and yield one tick so PDF.js clears its internal state
            if (renderTaskRef.current) {
                try { renderTaskRef.current.cancel(); } catch { /* ignore */ }
                await new Promise<void>(r => setTimeout(r, 0));
                renderTaskRef.current = null;
            }

            const doc = pdfDocRef.current;
            const canvas = canvasRef.current;
            if (!doc || !canvas) return;

            const page = await doc.getPage(currentPage);
            const dpr  = window.devicePixelRatio || 1;

            const area = scrollAreaRef.current;
            const containerWidth  = area ? Math.max(area.clientWidth  - 40,  200) : window.innerWidth  - 40;
            const containerHeight = area ? Math.max(area.clientHeight - 124, 200) : window.innerHeight - 180;

            const baseViewport = page.getViewport({ scale: 1 });
            const scaleW   = containerWidth  / baseViewport.width;
            const scaleH   = containerHeight / baseViewport.height;
            const fitScale = Math.min(scaleW, scaleH);
            const scale    = fitScale * (zoom / 100) * dpr;
            const viewport = page.getViewport({ scale });

            const w = Math.round(viewport.width);
            const h = Math.round(viewport.height);

            // ── Step 1: Render onto an off-screen canvas (invisible) ──────────
            let offCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
            let offCanvas: HTMLCanvasElement | OffscreenCanvas;

            if (typeof OffscreenCanvas !== "undefined") {
                const oc = new OffscreenCanvas(w, h);
                offCtx   = oc.getContext("2d");
                offCanvas = oc;
            } else {
                // Fallback: a detached regular canvas
                const oc = document.createElement("canvas");
                oc.width  = w;
                oc.height = h;
                offCtx    = oc.getContext("2d");
                offCanvas = oc;
            }

            if (!offCtx) return;

            const renderTask = page.render({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                canvas: offCanvas as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                canvasContext: offCtx as any,
                viewport,
            });
            renderTaskRef.current = renderTask;
            await renderTask.promise;     // ← new page fully painted off-screen
            renderTaskRef.current = null;

            // ── Step 2: Slide OLD content out ────────────────────────────────
            const dir = pageDirectionRef.current;
            if (!isResize) {
                await pageControls.start({
                    opacity: 0,
                    x: dir * -32,
                    transition: { duration: 0.14, ease: [0.4, 0, 1, 1] },
                });
            }

            // ── Step 3: Atomically blit new page onto the visible canvas ─────
            canvas.width  = w;
            canvas.height = h;
            canvas.style.width  = `${w / dpr}px`;
            canvas.style.height = `${h / dpr}px`;
            const ctx = canvas.getContext("2d");
            if (ctx) ctx.drawImage(offCanvas as CanvasImageSource, 0, 0);

            // ── Step 4: Slide NEW content in ─────────────────────────────────
            if (!isResize) {
                // Reset position to the incoming side instantly
                pageControls.set({ x: dir * 32, opacity: 0 });
                await pageControls.start({
                    opacity: 1,
                    x: 0,
                    transition: { duration: 0.2, ease: [0, 0, 0.2, 1] },
                });
            } else {
                // If resize, just make sure it's fully visible and centered
                pageControls.set({ opacity: 1, x: 0 });
            }

            if (area && !isResize) area.scrollTop = 0;

        } catch (err: unknown) {
            renderTaskRef.current = null;
            if ((err as { name?: string })?.name === "RenderingCancelledException") return;
            console.error("[ReaderClient] Render error:", err);
        } finally {
            isRenderingRef.current = false;
            if (renderPendingRef.current.isPending) {
                const pendingIsResize = renderPendingRef.current.isResize;
                renderPendingRef.current = { isPending: false, isResize: false };
                renderCurrentPage(pendingIsResize);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, loadStatus, zoom, pageControls]);

    useEffect(() => {
        renderCurrentPage();
    }, [renderCurrentPage]);

    // ── Re-render on container resize (debounced, no slide animation) ───────────
    useEffect(() => {
        let resizeTimer: ReturnType<typeof setTimeout>;
        const obs = new ResizeObserver(() => {
            clearTimeout(resizeTimer);
            // On resize we skip the slide animation — just re-blit at new size
            resizeTimer = setTimeout(() => {
                renderCurrentPage(true); // true = isResize
            }, 120);
        });
        if (scrollAreaRef.current) obs.observe(scrollAreaRef.current);
        return () => { obs.disconnect(); clearTimeout(resizeTimer); };
    }, [renderCurrentPage]);

    // ── Debounced progress save (500ms) ──────────────────────────────────────
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedSave = useCallback(
        debounce(async (page: number, total: number) => {
            setSaving(true);
            try {
                await fetch(`/api/books/${book.id}/progress`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ lastPageRead: page, totalPageCount: total || undefined }),
                });
            } finally {
                setSaving(false);
            }
        }, 500),
        [book.id]
    );

    // ── Page navigation ───────────────────────────────────────────────────────
    function goToPage(p: number, direction?: 1 | -1) {
        const clamped = Math.max(1, totalPages ? Math.min(totalPages, p) : p);
        if (clamped === currentPage) return;
        pageDirectionRef.current = direction ?? (p > currentPage ? 1 : -1);
        setCurrentPage(clamped);
        setPageInput(String(clamped));
        debouncedSave(clamped, totalPages);
    }

    function handlePageInputSubmit() {
        const n = parseInt(pageInput, 10);
        if (!isNaN(n)) goToPage(n);
    }

    // ── Zoom helpers ──────────────────────────────────────────────────────────
    function zoomIn() { setZoom(z => Math.min(200, z + 15)); }
    function zoomOut() { setZoom(z => Math.max(50, z - 15)); }
    function zoomReset() { setZoom(100); }

    // ── Touch/swipe ───────────────────────────────────────────────────────────
    function handleTouchStart(e: React.TouchEvent) {
        touchStartX.current = e.touches[0].clientX;
        resetHideTimer();
    }

    function handleTouchEnd(e: React.TouchEvent) {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 50) {
            if (dx < 0) goToPage(currentPage + 1, 1);   // swipe left = next
            else goToPage(currentPage - 1, -1);           // swipe right = prev
        }
        touchStartX.current = null;
    }

    // ── Fullscreen ────────────────────────────────────────────────────────────
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setFullscreen(true);
        } else {
            document.exitFullscreen();
            setFullscreen(false);
        }
    }

    // ── Reading mode toggle ───────────────────────────────────────────────────
    function toggleReadingMode() {
        setReadingMode(prev => {
            const next = !prev;
            if (!next) setUiVisible(true);
            return next;
        });
    }

    const progress = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;
    const canPrev = currentPage > 1 && loadStatus === "ready";
    const canNext = totalPages > 0 ? currentPage < totalPages && loadStatus === "ready" : loadStatus === "ready";

    // ── Night mode text color adjustments ─────────────────────────────────────
    const isNight = theme === "night";
    const headerBg = isNight
        ? "rgba(26,23,20,0.95)"
        : "rgba(249,247,242,0.92)";
    const headerBorder = isNight
        ? "rgba(255,255,255,0.06)"
        : "rgba(180,160,110,0.2)";
    const textColor = isNight ? "#D4CCBF" : "var(--color-ink)";
    const mutedColor = isNight ? "#7A7068" : "var(--color-text-faint)";

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div
            onMouseMove={resetHideTimer}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{
                position: "fixed",
                inset: 0,
                background: currentTheme.bg,
                display: "flex",
                flexDirection: "column",
                userSelect: "none",
                overflow: "hidden",
                transition: "background 0.4s ease",
            }}
        >
            {/* ── Resume Toast ──────────────────────────────────────────────── */}
            <AnimatePresence>
                {resumeToast && (
                    <motion.div
                        key="resume-toast"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
                        style={{
                            position: "absolute",
                            bottom: 88,
                            left: "50%",
                            transform: "translateX(-50%)",
                            zIndex: 50,
                            background: isNight
                                ? "rgba(30,26,22,0.97)"
                                : "rgba(253,251,246,0.97)",
                            backdropFilter: "blur(18px)",
                            border: `1px solid ${isNight ? "rgba(255,255,255,0.1)" : "rgba(180,160,110,0.3)"}`,
                            borderRadius: 14,
                            padding: "10px 18px",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            boxShadow: isNight
                                ? "0 6px 32px rgba(0,0,0,0.5)"
                                : "0 6px 32px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)",
                            pointerEvents: "none",
                            whiteSpace: "nowrap",
                        }}
                        role="status"
                        aria-live="polite"
                    >
                        <div
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                background: "var(--color-accent-soft)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <BookOpen size={14} strokeWidth={1.5} color="var(--color-accent)" />
                        </div>
                        <div>
                            <p style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: isNight ? "#D4CCBF" : "var(--color-ink)",
                                lineHeight: 1.3,
                                fontFamily: "var(--font-serif)",
                            }}>
                                Resuming from page {resumeToast.page}
                            </p>
                            <p style={{
                                fontSize: 11,
                                color: isNight ? "#6B6258" : "var(--color-text-faint)",
                                marginTop: 1,
                            }}>
                                Picking up where you left off
                            </p>
                        </div>
                        <button
                            onClick={() => setResumeToast(null)}
                            style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: isNight ? "#6B6258" : "var(--color-text-faint)",
                                display: "flex",
                                padding: 2,
                                pointerEvents: "auto",
                            }}
                            aria-label="Dismiss"
                        >
                            <X size={12} strokeWidth={1.5} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Warm paper overlay */}
            {!isNight && (
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: `radial-gradient(ellipse at 50% 0%, rgba(255,220,120,0.1) 0%, transparent 60%)`,
                        pointerEvents: "none",
                        zIndex: 1,
                    }}
                />
            )}

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

            {/* ── Top Bar ──────────────────────────────────────────────────── */}
            <AnimatePresence>
                {(!readingMode || uiVisible) && (
                    <motion.header
                        key="topbar"
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.2 }}
                        style={{
                            position: "relative",
                            zIndex: 10,
                            background: headerBg,
                            backdropFilter: "blur(14px)",
                            borderBottom: `1px solid ${headerBorder}`,
                            padding: "0 16px",
                            height: 56,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            flexShrink: 0,
                        }}
                    >
                        {/* Back to library */}
                        <Link
                            href="/library"
                            className="btn btn-ghost"
                            style={{ padding: "6px 10px", fontSize: 13, gap: 5, color: textColor, borderColor: isNight ? "rgba(255,255,255,0.1)" : undefined }}
                            id="reader-back-btn"
                        >
                            <Library size={14} strokeWidth={1.5} />
                            Library
                        </Link>

                        {/* Book title */}
                        <div style={{ flex: 1, textAlign: "center", minWidth: 0, padding: "0 8px" }}>
                            <p
                                style={{
                                    fontFamily: "var(--font-serif)",
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: textColor,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    lineHeight: 1.3,
                                }}
                            >
                                {book.title}
                            </p>
                            {book.author && (
                                <p style={{ fontSize: 11, color: mutedColor, marginTop: 1, letterSpacing: "0.01em" }}>
                                    {book.author}
                                </p>
                            )}
                        </div>

                        {/* Right controls */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                            {/* Settings panel toggle */}
                            <button
                                onClick={() => setShowSettings(s => !s)}
                                className="btn btn-ghost"
                                style={{
                                    padding: 7,
                                    width: 32,
                                    height: 32,
                                    color: showSettings ? "var(--color-accent)" : textColor,
                                    borderColor: showSettings ? "var(--color-accent)" : (isNight ? "rgba(255,255,255,0.1)" : undefined),
                                    background: showSettings ? "var(--color-accent-soft)" : undefined,
                                }}
                                title="Display settings"
                                id="settings-btn"
                            >
                                <Settings size={14} strokeWidth={1.5} />
                            </button>

                            {/* Reading Mode */}
                            <button
                                onClick={toggleReadingMode}
                                className="btn btn-ghost"
                                style={{
                                    padding: 7,
                                    width: 32,
                                    height: 32,
                                    color: readingMode ? "var(--color-accent)" : textColor,
                                    borderColor: readingMode ? "var(--color-accent)" : (isNight ? "rgba(255,255,255,0.1)" : undefined),
                                    background: readingMode ? "var(--color-accent-soft)" : undefined,
                                }}
                                aria-label={readingMode ? "Exit reading mode" : "Enter reading mode"}
                                id="reading-mode-btn"
                                title={readingMode ? "Exit Reading Mode" : "Focus Mode"}
                            >
                                {readingMode
                                    ? <Eye size={14} strokeWidth={1.5} />
                                    : <EyeOff size={14} strokeWidth={1.5} />
                                }
                            </button>

                            {/* Fullscreen */}
                            <button
                                onClick={toggleFullscreen}
                                className="btn btn-ghost"
                                style={{
                                    padding: 7,
                                    width: 32,
                                    height: 32,
                                    color: textColor,
                                    borderColor: isNight ? "rgba(255,255,255,0.1)" : undefined,
                                }}
                                aria-label="Toggle fullscreen"
                                id="fullscreen-btn"
                                title="Fullscreen"
                            >
                                {fullscreen
                                    ? <Minimize size={14} strokeWidth={1.5} />
                                    : <Maximize size={14} strokeWidth={1.5} />
                                }
                            </button>

                            {/* Save indicator dot */}
                            {saving && (
                                <span
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: "50%",
                                        background: "var(--color-accent)",
                                        flexShrink: 0,
                                    }}
                                    title="Saving…"
                                />
                            )}
                        </div>
                    </motion.header>
                )}
            </AnimatePresence>

            {/* ── Settings Panel ──────────────────────────────────────────── */}
            <AnimatePresence>
                {showSettings && (!readingMode || uiVisible) && (
                    <motion.div
                        key="settings"
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.18 }}
                        style={{
                            position: "absolute",
                            top: 64,
                            right: 12,
                            zIndex: 20,
                            background: isNight ? "rgba(30,26,22,0.98)" : "rgba(253,251,246,0.98)",
                            backdropFilter: "blur(20px)",
                            border: `1px solid ${isNight ? "rgba(255,255,255,0.08)" : "rgba(180,160,110,0.25)"}`,
                            borderRadius: 16,
                            padding: "18px 20px",
                            minWidth: 260,
                            boxShadow: "0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)",
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: textColor, letterSpacing: "0.02em" }}>
                                Display Settings
                            </span>
                            <button
                                onClick={() => setShowSettings(false)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: mutedColor, display: "flex", padding: 2 }}
                            >
                                <X size={14} strokeWidth={1.5} />
                            </button>
                        </div>

                        {/* Zoom */}
                        <div style={{ marginBottom: 18 }}>
                            <label style={{ fontSize: 11, fontWeight: 500, color: mutedColor, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8, display: "block" }}>
                                Zoom — {zoom}%
                            </label>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <button
                                    onClick={zoomOut}
                                    disabled={zoom <= 50}
                                    style={settingsBtnStyle(isNight, zoom <= 50)}
                                    title="Zoom out"
                                >
                                    <ZoomOut size={13} strokeWidth={1.5} />
                                </button>
                                <input
                                    type="range"
                                    min={50}
                                    max={200}
                                    step={5}
                                    value={zoom}
                                    onChange={e => setZoom(Number(e.target.value))}
                                    style={{ flex: 1, accentColor: "var(--color-accent)", cursor: "pointer" }}
                                    aria-label="Zoom level"
                                />
                                <button
                                    onClick={zoomIn}
                                    disabled={zoom >= 200}
                                    style={settingsBtnStyle(isNight, zoom >= 200)}
                                    title="Zoom in"
                                >
                                    <ZoomIn size={13} strokeWidth={1.5} />
                                </button>
                                <button
                                    onClick={zoomReset}
                                    style={{ ...settingsBtnStyle(isNight, false), fontSize: 11, fontWeight: 600, padding: "4px 8px", width: "auto" }}
                                    title="Reset zoom"
                                >
                                    FIT
                                </button>
                            </div>
                        </div>

                        {/* Brightness */}
                        <div style={{ marginBottom: 18 }}>
                            <label style={{ fontSize: 11, fontWeight: 500, color: mutedColor, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8, display: "block" }}>
                                Brightness — {brightness}%
                            </label>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Sun size={12} strokeWidth={1.5} color={mutedColor} style={{ opacity: 0.5 }} />
                                <input
                                    type="range"
                                    min={30}
                                    max={100}
                                    value={brightness}
                                    onChange={e => setBrightness(Number(e.target.value))}
                                    style={{ flex: 1, accentColor: "var(--color-accent)", cursor: "pointer" }}
                                    aria-label="Brightness"
                                    id="brightness-slider"
                                />
                                <Sun size={15} strokeWidth={1.5} color={mutedColor} />
                            </div>
                        </div>

                        {/* Theme */}
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 500, color: mutedColor, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10, display: "block" }}>
                                Background Theme
                            </label>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                {(Object.keys(THEMES) as ThemeKey[]).map(key => {
                                    const t = THEMES[key];
                                    const Icon = t.icon;
                                    const active = theme === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setTheme(key)}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 7,
                                                padding: "8px 10px",
                                                borderRadius: 10,
                                                border: `1.5px solid ${active ? "var(--color-accent)" : (isNight ? "rgba(255,255,255,0.1)" : "var(--color-border)")}`,
                                                background: active
                                                    ? "var(--color-accent-soft)"
                                                    : t.bg,
                                                cursor: "pointer",
                                                fontSize: 12,
                                                fontWeight: active ? 600 : 400,
                                                color: active ? "var(--color-accent)" : (key === "night" ? "#D4CCBF" : "#3D2E14"),
                                                transition: "all 0.15s ease",
                                            }}
                                        >
                                            <Icon size={12} strokeWidth={1.5} />
                                            {t.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Keyboard shortcuts hint */}
                        <div style={{
                            marginTop: 16,
                            paddingTop: 14,
                            borderTop: `1px solid ${isNight ? "rgba(255,255,255,0.06)" : "var(--color-border)"}`,
                        }}>
                            <p style={{ fontSize: 10.5, color: mutedColor, lineHeight: 1.8 }}>
                                <strong>←→</strong> Navigate pages &nbsp;·&nbsp;
                                <strong>+−</strong> Zoom &nbsp;·&nbsp;
                                <strong>Space</strong> Next page
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Progress bar ─────────────────────────────────────────────── */}
            <div
                style={{
                    position: "absolute",
                    top: (!readingMode || uiVisible) ? 56 : 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: isNight ? "rgba(255,255,255,0.05)" : "rgba(180,160,110,0.15)",
                    zIndex: 9,
                    transition: "top 0.2s ease",
                }}
            >
                <div
                    style={{
                        height: "100%",
                        width: `${progress}%`,
                        background: "var(--color-accent)",
                        transition: "width 0.4s ease",
                        borderRadius: "0 2px 2px 0",
                    }}
                />
            </div>

            {/* ── PDF Canvas Area ───────────────────────────────────────────── */}
            <div
                ref={scrollAreaRef}
                style={{
                    flex: 1,
                    position: "relative",
                    zIndex: 3,
                    overflow: "auto",
                    display: "flex",
                    alignItems: zoom <= 100 ? "center" : "flex-start",
                    justifyContent: "center",
                    padding: "28px 20px 96px",
                }}
            >
                {/* Loading state */}
                {loadStatus === "loading" && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 16,
                            height: "100%",
                            minHeight: 300,
                            color: "var(--color-text-muted)",
                        }}
                    >
                        <Loader2
                            size={36}
                            strokeWidth={1.5}
                            style={{ animation: "spin 1s linear infinite", color: "var(--color-accent)" }}
                        />
                        <p style={{ fontSize: 14, fontFamily: "var(--font-sans)", color: isNight ? "#7A7068" : undefined }}>
                            Loading PDF…
                        </p>
                    </div>
                )}

                {/* Error state */}
                {loadStatus === "error" && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 16,
                            height: "100%",
                            minHeight: 300,
                            padding: "0 24px",
                            textAlign: "center",
                        }}
                    >
                        <div
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: "var(--radius-lg)",
                                background: "#FDE8E3",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <AlertTriangle size={28} strokeWidth={1.5} color="#C2553A" />
                        </div>
                        <div>
                            <p
                                style={{
                                    fontFamily: "var(--font-serif)",
                                    fontSize: 18,
                                    fontWeight: 600,
                                    color: "var(--color-ink)",
                                    marginBottom: 8,
                                }}
                            >
                                Could not load the PDF
                            </p>
                            <p style={{ fontSize: 13, color: "var(--color-text-muted)", maxWidth: 360, lineHeight: 1.6 }}>
                                {errorMsg || "An unexpected error occurred."}
                            </p>
                        </div>
                        <Link href="/library" className="btn btn-ghost" style={{ marginTop: 8 }}>
                            <Library size={15} strokeWidth={1.5} />
                            Back to Library
                        </Link>
                    </div>
                )}

                {/* Canvas — single persistent element, never remounted */}
                {loadStatus === "ready" && (
                    <motion.div
                        animate={pageControls}
                        initial={{ opacity: 1, x: 0 }}
                        style={{
                            display: "inline-block",
                            flexShrink: 0,
                            boxShadow: isNight
                                ? "0 12px 60px rgba(0,0,0,0.55), 0 2px 12px rgba(0,0,0,0.4)"
                                : "0 8px 48px rgba(0,0,0,0.16), 0 2px 10px rgba(0,0,0,0.08), 0 0 0 1px rgba(180,160,110,0.15)",
                            borderRadius: 3,
                            overflow: "hidden",
                        }}
                    >
                        <canvas
                            ref={canvasRef}
                            style={{ display: "block", background: currentTheme.pageBg }}
                        />
                    </motion.div>
                )}
            </div>

            {/* ── Side Navigation Arrows (large, accessible) ───────────────── */}
            {loadStatus === "ready" && (!readingMode || uiVisible) && (
                <>
                    <motion.button
                        key="prev-side"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => goToPage(currentPage - 1, -1)}
                        disabled={!canPrev}
                        id="prev-page-side-btn"
                        aria-label="Previous page"
                        style={sideNavBtnStyle("left", canPrev, isNight)}
                    >
                        <ChevronLeft size={20} strokeWidth={1.5} />
                    </motion.button>

                    <motion.button
                        key="next-side"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => goToPage(currentPage + 1, 1)}
                        disabled={!canNext}
                        id="next-page-side-btn"
                        aria-label="Next page"
                        style={sideNavBtnStyle("right", canNext, isNight)}
                    >
                        <ChevronRight size={20} strokeWidth={1.5} />
                    </motion.button>
                </>
            )}

            {/* ── Bottom Navigation Bar ────────────────────────────────────── */}
            <AnimatePresence>
                {(!readingMode || uiVisible) && (
                    <motion.div
                        key="bottomnav"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 16 }}
                        transition={{ duration: 0.2 }}
                        style={{
                            position: "absolute",
                            bottom: 20,
                            left: "50%",
                            transform: "translateX(-50%)",
                            zIndex: 10,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            background: isNight
                                ? "rgba(26,23,20,0.96)"
                                : "rgba(253,251,246,0.96)",
                            backdropFilter: "blur(20px)",
                            border: `1px solid ${isNight ? "rgba(255,255,255,0.07)" : "rgba(180,160,110,0.2)"}`,
                            borderRadius: 99,
                            padding: "8px 16px",
                            boxShadow: isNight
                                ? "0 4px 32px rgba(0,0,0,0.5)"
                                : "0 4px 24px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06)",
                        }}
                    >
                        {/* Prev */}
                        <button
                            onClick={() => goToPage(currentPage - 1, -1)}
                            disabled={!canPrev}
                            style={navBtnStyle(!canPrev, isNight)}
                            aria-label="Previous page"
                            id="prev-page-btn"
                        >
                            <ChevronLeft size={15} strokeWidth={1.5} />
                        </button>

                        <div style={{ width: 1, height: 18, background: isNight ? "rgba(255,255,255,0.08)" : "var(--color-border)" }} />

                        {/* Page form */}
                        <form
                            onSubmit={e => { e.preventDefault(); handlePageInputSubmit(); }}
                            style={{ display: "flex", alignItems: "center", gap: 5 }}
                        >
                            <BookOpen
                                size={12}
                                strokeWidth={1.5}
                                color={mutedColor}
                                style={{ flexShrink: 0 }}
                            />
                            <input
                                type="text"
                                inputMode="numeric"
                                value={pageInput}
                                onChange={e => setPageInput(e.target.value)}
                                onBlur={handlePageInputSubmit}
                                style={{
                                    width: 38,
                                    height: 28,
                                    textAlign: "center",
                                    fontFamily: "var(--font-sans)",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: textColor,
                                    background: isNight ? "rgba(255,255,255,0.06)" : "var(--color-surface-2)",
                                    border: `1px solid ${isNight ? "rgba(255,255,255,0.1)" : "var(--color-border)"}`,
                                    borderRadius: "var(--radius-sm)",
                                    outline: "none",
                                    padding: "0 4px",
                                }}
                                aria-label="Current page"
                                id="page-input"
                            />
                            {totalPages > 0 && (
                                <span style={{ fontSize: 12, color: mutedColor, fontFamily: "var(--font-sans)", whiteSpace: "nowrap" }}>
                                    / {totalPages}
                                </span>
                            )}
                        </form>

                        <div style={{ width: 1, height: 18, background: isNight ? "rgba(255,255,255,0.08)" : "var(--color-border)" }} />

                        {/* Next */}
                        <button
                            onClick={() => goToPage(currentPage + 1, 1)}
                            disabled={!canNext}
                            style={navBtnStyle(!canNext, isNight)}
                            aria-label="Next page"
                            id="next-page-btn"
                        >
                            <ChevronRight size={15} strokeWidth={1.5} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Style helpers ────────────────────────────────────────────────────────────
function navBtnStyle(disabled: boolean, night: boolean): React.CSSProperties {
    return {
        width: 30,
        height: 30,
        borderRadius: "50%",
        border: `1px solid ${night ? "rgba(255,255,255,0.1)" : "var(--color-border)"}`,
        background: "transparent",
        color: disabled
            ? (night ? "rgba(255,255,255,0.15)" : "var(--color-text-faint)")
            : (night ? "#D4CCBF" : "var(--color-ink)"),
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.15s ease",
        flexShrink: 0,
    };
}

function sideNavBtnStyle(side: "left" | "right", enabled: boolean, night: boolean): React.CSSProperties {
    return {
        position: "absolute",
        top: "50%",
        [side]: 12,
        transform: "translateY(-50%)",
        zIndex: 8,
        width: 44,
        height: 44,
        borderRadius: "50%",
        border: `1px solid ${night ? "rgba(255,255,255,0.08)" : "rgba(180,160,110,0.2)"}`,
        background: night ? "rgba(26,23,20,0.75)" : "rgba(253,251,246,0.82)",
        backdropFilter: "blur(10px)",
        color: enabled
            ? (night ? "#C5BDB0" : "var(--color-ink)")
            : (night ? "rgba(255,255,255,0.15)" : "var(--color-text-faint)"),
        cursor: enabled ? "pointer" : "not-allowed",
        opacity: enabled ? 1 : 0.3,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s ease",
        boxShadow: night
            ? "0 2px 12px rgba(0,0,0,0.4)"
            : "0 2px 12px rgba(0,0,0,0.08)",
    };
}

function settingsBtnStyle(night: boolean, disabled: boolean): React.CSSProperties {
    return {
        width: 30,
        height: 30,
        borderRadius: 8,
        border: `1px solid ${night ? "rgba(255,255,255,0.1)" : "var(--color-border)"}`,
        background: night ? "rgba(255,255,255,0.04)" : "var(--color-surface-2)",
        color: disabled
            ? (night ? "rgba(255,255,255,0.15)" : "var(--color-text-faint)")
            : (night ? "#C5BDB0" : "var(--color-ink)"),
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.15s ease",
        flexShrink: 0,
    };
}

// ─── Build proxy URL ──────────────────────────────────────────────────────────
function buildProxyUrl(fileUrl: string, provider: string): string {
    if (provider === "GDRIVE") {
        const fileId = extractDriveFileId(fileUrl);
        if (fileId) return `/api/read/${fileId}`;
    }
    return fileUrl;
}
