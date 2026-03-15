"use client";

import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

export default function SyncEngineButton({ userRole }: { userRole: string }) {
    const [isSyncing, setIsSyncing] = useState(false);
    const [progress, setProgress] = useState({ total: 0, processed: 0, currentFileName: "" });
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const router = useRouter();

    if (userRole !== "HEAD") return null;

    const startSync = () => {
        if (isSyncing) return;
        setIsSyncing(true);
        setProgress({ total: 0, processed: 0, currentFileName: "Initializing..." });

        const eventSource = new EventSource("/api/sync");

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === "progress") {
                    setProgress({
                        total: data.totalFiles,
                        processed: data.processedFiles,
                        currentFileName: data.currentFileName,
                    });
                } else if (data.type === "complete") {
                    setToastMessage(`Library updated. ${data.newBooksAdded ?? 0} new books added.`);
                    setShowToast(true);
                    setIsSyncing(false);
                    eventSource.close();
                    router.refresh(); // Refresh page data

                    // Hide toast after 4s
                    setTimeout(() => setShowToast(false), 4000);
                } else if (data.type === "error") {
                    if (process.env.NODE_ENV !== "production") {
                        console.error("Sync Error:", data.message);
                    }
                    setToastMessage(`Sync failed: ${data.message}`);
                    setShowToast(true);
                    setIsSyncing(false);
                    eventSource.close();
                    
                    setTimeout(() => setShowToast(false), 4000);
                }
            } catch (err) {
                if (process.env.NODE_ENV !== "production") {
                    console.error("Failed to parse SSE data:", err);
                }
            }
        };

        eventSource.onerror = (err) => {
            if (process.env.NODE_ENV !== "production") {
                console.error("EventSource failed:", err);
            }
            setToastMessage("Connection lost during sync.");
            setShowToast(true);
            setIsSyncing(false);
            eventSource.close();
            
            setTimeout(() => setShowToast(false), 4000);
        };
    };

    return (
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <button
                onClick={startSync}
                disabled={isSyncing}
                className="btn"
                style={{
                    backgroundColor: "#F9F7F2", // Paper White
                    border: "1px solid #1A1A1A", // Deep Charcoal border
                    color: "#1A1A1A",
                    padding: "8px 14px",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: isSyncing ? "not-allowed" : "pointer",
                    opacity: isSyncing ? 0.6 : 1,
                    transition: "all 0.2s ease"
                }}
            >
                <motion.div
                    animate={isSyncing ? { rotate: 360 } : { rotate: 0 }}
                    transition={isSyncing ? { repeat: Infinity, duration: 1.5, ease: "linear" } : {}}
                    style={{ display: "flex", alignItems: "center" }}
                >
                    <RefreshCw size={15} strokeWidth={1.5} />
                </motion.div>
                Sync Now
            </button>

            {/* Sync Progress UI */}
            <AnimatePresence>
                {isSyncing && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        style={{
                            position: "absolute",
                            top: "120%",
                            right: 0,
                            width: "260px",
                            backgroundColor: "#F9F7F2",
                            border: "1px solid #1A1A1A",
                            borderRadius: "var(--radius-md)",
                            padding: "10px 14px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                            zIndex: 50
                        }}
                    >
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                            color: "var(--color-ink)",
                            marginBottom: 6,
                            fontFamily: "var(--font-sans)",
                            fontWeight: 500,
                        }}>
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "180px" }}>
                                Syncing: {progress.currentFileName || "..."}
                            </span>
                            <span>({progress.processed}/{progress.total || "?"})</span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div style={{
                            width: "100%",
                            height: "5px",
                            backgroundColor: "var(--color-surface-2)",
                            borderRadius: "3px",
                            overflow: "hidden"
                        }}>
                            <motion.div
                                initial={{ width: "0%" }}
                                animate={{ width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%` }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                style={{
                                    height: "100%",
                                    backgroundColor: "#1A1A1A", // Deep Charcoal
                                    borderRadius: "3px"
                                }}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Success/Error Toast */}
            <AnimatePresence>
                {showToast && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        style={{
                            position: "fixed",
                            bottom: "24px",
                            right: "24px",
                            backgroundColor: "rgba(249,247,242,0.95)",
                            backdropFilter: "blur(8px)",
                            border: "1px solid #1A1A1A",
                            color: "#1A1A1A",
                            padding: "12px 20px",
                            borderRadius: "var(--radius-md)",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                            fontSize: 14,
                            fontWeight: 500,
                            zIndex: 100,
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                        }}
                    >
                        {toastMessage.startsWith("Sync failed") ? (
                            <span style={{ color: "var(--color-warm-red)" }}>•</span>
                        ) : (
                            <span style={{ color: "var(--color-accent)" }}>•</span>
                        )}
                        {toastMessage}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
