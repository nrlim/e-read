"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download } from "lucide-react";

export function GlobalInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if user previously dismissed the global prompt to avoid annoyance
    const hasDismissed = localStorage.getItem("pwa_install_dismissed");
    
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile (let's use our custom UI)
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      if (!hasDismissed) {
        // Show after a slight delay for a smooth and sophisticated entrance
        setTimeout(() => setShowPrompt(true), 1200);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa_install_dismissed", "true");
  };

  const [mounted, setMounted] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    setMounted(true);

    // iOS Detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
    
    // Check if running as standalone (already installed)
    const nav = window.navigator as any;
    const isStandalone = nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    
    // Check if dismissed
    const hasDismissed = localStorage.getItem("pwa_install_dismissed");

    if (isIosDevice && isSafari && !isStandalone && !hasDismissed) {
      setIsIos(true);
      setTimeout(() => setShowPrompt(true), 1200);
    }
  }, []);

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: "-50%", scale: 0.95 }}
          animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
          exit={{ opacity: 0, y: 20, x: "-50%", scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          style={{
            position: "fixed",
            bottom: 32,
            left: "50%",
            zIndex: 9999,
            width: "calc(100% - 48px)",
            maxWidth: 420,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 16,
            padding: "16px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px var(--color-border-2)",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div 
            style={{ 
              width: 44, 
              height: 44, 
              borderRadius: 10, 
              background: "var(--color-accent-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}
          >
            <Download size={20} color="var(--color-accent)" strokeWidth={2.5} />
          </div>
          
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--color-ink)", fontFamily: "var(--font-sans)" }}>
              Install e-Read App
            </h4>
            {isIos ? (
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                Tap <b>Share</b> <span style={{display: "inline-block", border: "1px solid currentColor", borderRadius: 4, width: 14, height: 16, textAlign: "center", lineHeight: "16px", fontSize: 10}}>↑</span> then <b>"Add to Home Screen"</b>
              </p>
            ) : (
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Add to your device for smooth access
              </p>
            )}
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, alignItems: "center" }}>
            {!isIos && (
              <button 
                onClick={handleInstallClick}
                className="btn btn-primary"
                style={{ padding: "0 14px", fontSize: 13, height: 30, borderRadius: 8, whiteSpace: "nowrap" }}
              >
                Install
              </button>
            )}
            <button 
              onClick={handleDismiss}
              style={{ padding: 0, fontSize: 11, color: "var(--color-text-faint)", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
            >
              {isIos ? "Got it" : "Maybe later"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
