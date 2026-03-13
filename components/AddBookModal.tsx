"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Link as LinkIcon, Upload, ChevronDown, FileText, Download } from "lucide-react";
import type { Book, BookCategory } from "@/lib/types";
import Papa from "papaparse";

const providers = [
    {
        id: "GDRIVE",
        name: "Google Drive",
        placeholder: "https://drive.google.com/file/d/FILE_ID/view",
    },
];

export const CATEGORY_OPTIONS: { value: BookCategory; label: string; subtitle: string }[] = [
    { value: "SELF_DEVELOPMENT",   label: "Self Development",      subtitle: "Motivation, Psychology, Mindset" },
    { value: "FINANCE_INVESTMENT", label: "Finance & Investment",  subtitle: "Business, Forex, Crypto" },
    { value: "TECHNOLOGY_AI",      label: "Technology & AI",       subtitle: "AI, Programming" },
    { value: "LANGUAGE_SKILLS",    label: "Language & Skills",     subtitle: "English, Foreign Languages" },
    { value: "LITERATURE_FICTION", label: "Literature & Fiction",  subtitle: "Novels, Literature" },
    { value: "SPIRITUALITY",       label: "Spirituality",          subtitle: "Religious / Muslim content" },
    { value: "OTHERS",             label: "Others",                subtitle: "Random / Uncategorized" },
];

interface AddBookModalProps {
    onClose: () => void;
    onAdded: (book: Book) => void;
}

export default function AddBookModal({ onClose, onAdded }: AddBookModalProps) {
    const [provider, setProvider] = useState("GDRIVE");
    const [form, setForm] = useState({
        title: "",
        author: "",
        fileUrl: "",
        category: "" as BookCategory | "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [tab, setTab] = useState<"single" | "bulk">("single");
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [uploadingCount, setUploadingCount] = useState<number | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        if (!form.title || !form.fileUrl) {
            setError("Title and file URL are required");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/books", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: form.title,
                    author: form.author,
                    fileUrl: form.fileUrl,
                    provider,
                    category: form.category || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to add book");
            } else {
                onAdded(data.book);
            }
        } catch {
            setError("Something went wrong.");
        } finally {
            setLoading(false);
        }
    }

    async function handleBulkSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        
        if (!csvFile) {
            setError("Please select a CSV file to upload.");
            return;
        }

        setLoading(true);

        Papa.parse(csvFile, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const parsedBooks = results.data.map((row: any) => ({
                        title: row.title || row.Title,
                        author: row.author || row.Author || "",
                        fileUrl: row.fileUrl || row.FileUrl || row.URL || "",
                        category: row.category || row.Category || "OTHERS",
                        provider,
                    })).filter((b) => b.title && b.fileUrl);

                    if (parsedBooks.length === 0) {
                        setError("No valid books found in the CSV. Make sure title and fileUrl columns exist and are filled.");
                        setLoading(false);
                        return;
                    }

                    setUploadingCount(parsedBooks.length);

                    const res = await fetch("/api/books/bulk", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ books: parsedBooks }),
                    });
                    
                    const data = await res.json();
                    if (!res.ok) {
                        setError(data.error || "Failed to upload books in bulk");
                    } else {
                        // For bulk, let's just trigger a reload or callback with the last book / null
                        // to notify the library client to refresh.
                        onAdded({ id: "bulk-refresh", ...parsedBooks[0] } as any); 
                    }
                } catch (err) {
                    setError("Error processing bulk upload.");
                } finally {
                    setLoading(false);
                    setUploadingCount(null);
                }
            },
            error: (err) => {
                setError("Failed to parse CSV file: " + err.message);
                setLoading(false);
                setUploadingCount(null);
            }
        });
    }

    const selectedProvider = providers.find(p => p.id === provider)!;

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(26,20,10,0.4)",
                    backdropFilter: "blur(4px)",
                    zIndex: 100,
                }}
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 16 }}
                transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{
                    position: "fixed",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 101,
                    padding: "24px",
                    pointerEvents: "none",
                }}
            >
                <div
                    className="paper-bg shadow-warm-lg"
                    style={{
                        width: "100%",
                        maxWidth: 520,
                        maxHeight: "90dvh",
                        overflowY: "auto",
                        borderRadius: "var(--radius-xl)",
                        border: "1px solid var(--color-border)",
                        padding: "32px 32px 40px",
                        pointerEvents: "auto",
                    }}
                >
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--color-ink)" }}>
                            Add a book
                        </h2>
                        <button
                            onClick={onClose}
                            style={{
                                width: 34, height: 34, borderRadius: "var(--radius-md)",
                                background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                color: "var(--color-text-muted)",
                            }}
                            aria-label="Close"
                            id="modal-close-btn"
                        >
                            <X size={16} strokeWidth={1.5} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 24, borderBottom: "1px solid var(--color-border)", paddingBottom: 16 }}>
                        <button
                            type="button"
                            onClick={() => { setTab("single"); setError(""); }}
                            style={{
                                padding: "8px 16px",
                                borderRadius: "var(--radius-sm)",
                                border: "none",
                                background: tab === "single" ? "var(--color-surface-2)" : "transparent",
                                color: tab === "single" ? "var(--color-ink)" : "var(--color-text-muted)",
                                fontWeight: tab === "single" ? 600 : 500,
                                fontSize: 14,
                                cursor: "pointer",
                                transition: "all 0.2s ease"
                            }}
                        >
                            Single Upload
                        </button>
                        <button
                            type="button"
                            onClick={() => { setTab("bulk"); setError(""); }}
                            style={{
                                padding: "8px 16px",
                                borderRadius: "var(--radius-sm)",
                                border: "none",
                                background: tab === "bulk" ? "var(--color-surface-2)" : "transparent",
                                color: tab === "bulk" ? "var(--color-ink)" : "var(--color-text-muted)",
                                fontWeight: tab === "bulk" ? 600 : 500,
                                fontSize: 14,
                                cursor: "pointer",
                                transition: "all 0.2s ease"
                            }}
                        >
                            Bulk Upload (CSV)
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {error && (
                            <div
                                style={{
                                    padding: "10px 14px",
                                    background: "rgba(194,85,58,0.08)",
                                    border: "1px solid rgba(194,85,58,0.2)",
                                    borderRadius: "var(--radius-md)",
                                    fontSize: 13,
                                    color: "var(--color-warm-red)",
                                }}
                            >
                                {error}
                            </div>
                        )}

                        {tab === "single" ? (
                            <>
                                <FieldGroup label="Book title" id="add-title">
                            <input
                                id="add-title"
                                className="input"
                                value={form.title}
                                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                placeholder="Enter book title"
                                required
                            />
                        </FieldGroup>

                        <FieldGroup label="Author" id="add-author">
                            <input
                                id="add-author"
                                className="input"
                                value={form.author}
                                onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                                placeholder="Author name (optional)"
                            />
                        </FieldGroup>

                        {/* Category */}
                        <FieldGroup label="Category" id="add-category">
                            <div style={{ position: "relative" }}>
                                <select
                                    id="add-category"
                                    value={form.category}
                                    onChange={e => setForm(f => ({ ...f, category: e.target.value as BookCategory | "" }))}
                                    style={{
                                        width: "100%",
                                        appearance: "none",
                                        background: "#FFFDF9",
                                        border: "1px solid var(--color-border)",
                                        borderRadius: "var(--radius-md)",
                                        padding: "0 42px 0 14px",
                                        height: 44,
                                        fontSize: 14,
                                        color: form.category ? "#1A1A1A" : "var(--color-text-faint)",
                                        cursor: "pointer",
                                        outline: "none",
                                        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                                    }}
                                    onFocus={e => {
                                        e.currentTarget.style.borderColor = "var(--color-accent)";
                                        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(var(--color-accent-rgb),0.12)";
                                    }}
                                    onBlur={e => {
                                        e.currentTarget.style.borderColor = "var(--color-border)";
                                        e.currentTarget.style.boxShadow = "none";
                                    }}
                                >
                                    <option value="">Select a category</option>
                                    {CATEGORY_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label} — {opt.subtitle}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown
                                    size={16}
                                    strokeWidth={1.5}
                                    style={{
                                        position: "absolute",
                                        right: 14,
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        color: "var(--color-text-faint)",
                                        pointerEvents: "none",
                                    }}
                                />
                            </div>
                        </FieldGroup>

                        <FieldGroup label={`File URL (${selectedProvider.name})`} id="add-fileurl">
                            <div style={{ position: "relative" }}>
                                <LinkIcon size={18} strokeWidth={1.5} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-faint)" }} />
                                <input
                                    id="add-fileurl"
                                    className="input"
                                    style={{ paddingLeft: 42 }}
                                    value={form.fileUrl}
                                    onChange={e => setForm(f => ({ ...f, fileUrl: e.target.value }))}
                                    placeholder={selectedProvider.placeholder}
                                    required
                                />
                            </div>
                        </FieldGroup>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary"
                            style={{ width: "100%", height: 50, marginTop: 8 }}
                            id="add-book-submit-btn"
                        >
                            {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : (
                                <>
                                    <Upload size={16} strokeWidth={1.5} />
                                    Add to library
                                </>
                            )}
                        </button>
                            </>
                        ) : loading && uploadingCount !== null ? (
                            <div style={{ textAlign: "center", padding: "32px 20px" }}>
                                <motion.div 
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                                    style={{ marginBottom: 24, display: "flex", justifyContent: "center" }}
                                >
                                    <div style={{ 
                                        width: 64, height: 64, 
                                        borderRadius: "50%", 
                                        background: "rgba(113, 93, 29, 0.1)", // accent with opacity 
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        color: "var(--color-accent)"
                                    }}>
                                        <motion.div
                                            animate={{ y: [0, -6, 0] }}
                                            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                                        >
                                            <Upload size={32} strokeWidth={1.5} />
                                        </motion.div>
                                    </div>
                                </motion.div>
                                <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--color-ink)", marginBottom: 8 }}>
                                    Uploading {uploadingCount} books
                                </h3>
                                <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 32 }}>
                                    Please keep this window open while we process your file...
                                </p>
                                <div style={{ 
                                    width: "100%", height: 6, 
                                    background: "var(--color-border)", 
                                    borderRadius: 3, 
                                    overflow: "hidden",
                                    position: "relative"
                                }}>
                                    <motion.div 
                                        initial={{ x: "-100%" }}
                                        animate={{ x: "200%" }}
                                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                                        style={{ width: "50%", height: "100%", background: "var(--color-accent)", borderRadius: 3 }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div style={{ 
                                    padding: "16px 20px", 
                                    background: "#FFFDF9", 
                                    border: "1px solid var(--color-border)", 
                                    borderRadius: "var(--radius-md)",
                                    marginBottom: 8
                                }}>
                                    <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", marginBottom: 8 }}>
                                        How to bulk upload
                                    </h4>
                                    <p style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5, marginBottom: 12 }}>
                                        You can upload multiple books at once using a CSV file. The file must include columns for <strong>title</strong>, <strong>author</strong>, <strong>fileUrl</strong>, and <strong>category</strong>.
                                    </p>
                                    <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
                                        Accepted categories are: <br/>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                                            <code style={{ fontSize: 11, background: "var(--color-surface-2)", padding: "2px 6px", borderRadius: 4 }}>SELF_DEVELOPMENT</code>
                                            <code style={{ fontSize: 11, background: "var(--color-surface-2)", padding: "2px 6px", borderRadius: 4 }}>FINANCE_INVESTMENT</code>
                                            <code style={{ fontSize: 11, background: "var(--color-surface-2)", padding: "2px 6px", borderRadius: 4 }}>TECHNOLOGY_AI</code>
                                            <code style={{ fontSize: 11, background: "var(--color-surface-2)", padding: "2px 6px", borderRadius: 4 }}>LANGUAGE_SKILLS</code>
                                            <code style={{ fontSize: 11, background: "var(--color-surface-2)", padding: "2px 6px", borderRadius: 4 }}>LITERATURE_FICTION</code>
                                            <code style={{ fontSize: 11, background: "var(--color-surface-2)", padding: "2px 6px", borderRadius: 4 }}>SPIRITUALITY</code>
                                            <code style={{ fontSize: 11, background: "var(--color-surface-2)", padding: "2px 6px", borderRadius: 4 }}>OTHERS</code>
                                        </div>
                                    </div>
                                    <a
                                        href="/book_bulk_template.csv"
                                        download
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 6,
                                            fontSize: 13,
                                            fontWeight: 500,
                                            color: "var(--color-accent)",
                                            textDecoration: "none",
                                        }}
                                    >
                                        <Download size={14} strokeWidth={2} />
                                        Download CSV Template
                                    </a>
                                </div>

                                <FieldGroup label="Select CSV file" id="add-csv-file">
                                    <div style={{ position: "relative" }}>
                                        <FileText size={18} strokeWidth={1.5} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-faint)" }} />
                                        <input
                                            type="file"
                                            id="add-csv-file"
                                            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                            className="input"
                                            style={{ paddingLeft: 42, paddingTop: 12, cursor: "pointer" }}
                                            onChange={e => setCsvFile(e.target.files?.[0] || null)}
                                            required
                                        />
                                    </div>
                                    <p style={{ fontSize: 12, color: "var(--color-text-faint)", marginTop: 8 }}>
                                        All files will be uploaded using the {selectedProvider.name} provider.
                                    </p>
                                </FieldGroup>

                                <button
                                    type="button"
                                    onClick={handleBulkSubmit}
                                    disabled={loading || !csvFile}
                                    className="btn btn-primary"
                                    style={{ width: "100%", height: 50, marginTop: 8 }}
                                    id="bulk-book-submit-btn"
                                >
                                    {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : (
                                        <>
                                            <Upload size={16} strokeWidth={1.5} />
                                            Upload books in bulk
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                    </form>
                </div>
            </motion.div>
        </>
    );
}

function FieldGroup({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
    return (
        <div>
            <label htmlFor={id} style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
                {label}
            </label>
            {children}
        </div>
    );
}
