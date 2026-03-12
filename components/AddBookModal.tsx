"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Link as LinkIcon, Upload, HardDrive } from "lucide-react";
import type { Book } from "@/lib/types";

const providers = [
    {
        id: "GDRIVE",
        name: "Google Drive",
        icon: () => (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 19h20L12 2z" />
                <line x1="9" y1="13" x2="15" y2="13" />
            </svg>
        ),
        placeholder: "https://drive.google.com/file/d/FILE_ID/view",
    },
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
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

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
                body: JSON.stringify({ ...form, provider }),
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
