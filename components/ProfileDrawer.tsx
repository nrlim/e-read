"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { 
  BookOpen, 
  BarChart2, 
  Settings, 
  LogOut, 
  UserCircle2,
  X,
  ChevronRight,
  Library
} from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { Sheet } from "@/components/ui/sheet";

import type { UserRole } from "@/lib/types";

interface ProfileDrawerProps {
  user: {
    name: string | null;
    email: string | null;
    role: UserRole;
  };
  onLogout: () => void;
  isLoggingOut?: boolean;
}

export function ProfileDrawer({ user, onLogout, isLoggingOut }: ProfileDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    // Listen for the PWA install prompt event
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
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
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  // Derive user initials for a truly custom, high-end feel
  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
    : "";

  const ROLE_STYLE: Record<UserRole, { label: string; bg: string; color: string }> = {
      HEAD:   { label: "Head",   bg: "rgba(168,85,247,0.12)", color: "#7c3aed" },
      LEAD:   { label: "Lead",   bg: "rgba(59,130,246,0.12)",  color: "#2563eb" },
      MEMBER: { label: "Member", bg: "rgba(107,114,128,0.10)", color: "#4b5563" },
  };
  const roleBadge = user.role ? ROLE_STYLE[user.role] : null;

  const menuGroups = [
    {
      title: "Reading",
      items: [
        { icon: Library, label: "Library Overview", href: "/" },
        { icon: BarChart2, label: "Reading Statistics", href: "#" },
      ]
    },
    {
      title: "Preferences",
      items: [
        { icon: Settings, label: "Account Settings", href: "#" },
      ]
    }
  ];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetPrimitive.Trigger asChild>
        <button 
            className="rounded-full overflow-hidden transition-all flex items-center justify-center shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{ 
                width: 38, 
                height: 38, 
                backgroundColor: "var(--color-surface)", 
                border: "2px solid var(--color-border)",
                outlineColor: "var(--color-accent)"
            }}
        >
          {initials ? (
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-sans)", color: "var(--color-ink)" }}>{initials}</span>
          ) : (
            <UserCircle2 style={{ width: 20, height: 20, color: "var(--color-text-muted)" }} />
          )}
        </button>
      </SheetPrimitive.Trigger>

      <AnimatePresence>
        {isOpen && (
          <SheetPrimitive.Portal forceMount>
            
            <SheetPrimitive.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[6px]"
              />
            </SheetPrimitive.Overlay>

            <SheetPrimitive.Content asChild forceMount>
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 32, stiffness: 300, mass: 0.8 }}
                className="fixed inset-y-0 right-0 z-50 flex flex-col font-sans"
                style={{ 
                    height: "100%", 
                    width: "100%", 
                    maxWidth: 420, 
                    backgroundColor: "var(--color-bg)", 
                    boxShadow: "0 0 40px var(--color-shadow)", 
                    borderLeft: "1px solid var(--color-border)"
                }}
              >
                {/* Header Actions */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 24px 8px 24px" }}>
                  <SheetPrimitive.Title style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", paddingLeft: 8 }}>
                    Profile Dashboard
                  </SheetPrimitive.Title>
                  <SheetPrimitive.Description className="sr-only">
                    Manage your profile and settings
                  </SheetPrimitive.Description>
                  <SheetPrimitive.Close asChild>
                    <button 
                        className="rounded-full transition-all focus:outline-none shadow-sm flex items-center justify-center btn-ghost"
                        style={{ padding: 10, backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                    >
                      <X style={{ width: 16, height: 16, color: "var(--color-text-muted)" }} strokeWidth={2.5} />
                      <span className="sr-only">Close</span>
                    </button>
                  </SheetPrimitive.Close>
                </div>

                <div className="overflow-y-auto flex-1" style={{ padding: "0 24px 32px 24px" }}>
                  {/* 1. User Profile Card */}
                  <div 
                    className="card shadow-warm" 
                    style={{ 
                        marginTop: 20, 
                        marginBottom: 32, 
                        padding: 24, 
                        display: "flex", 
                        flexDirection: "column", 
                        alignItems: "center", 
                        position: "relative" 
                    }}
                  >
                    <div className="relative z-10">
                      <div 
                        className="rounded-full shadow-sm flex items-center justify-center"
                        style={{ 
                            width: 80, 
                            height: 80, 
                            marginBottom: 16, 
                            border: "3px solid var(--color-surface)", 
                            backgroundColor: "var(--color-bg)",
                            boxShadow: "0 0 0 1px var(--color-border-2)" 
                        }}
                      >
                        {initials ? (
                          <span className="font-serif font-medium" style={{ fontSize: 28, color: "var(--color-ink)", letterSpacing: "-0.02em" }}>{initials}</span>
                        ) : (
                          <UserCircle2 style={{ width: 40, height: 40, color: "var(--color-text-muted)" }} strokeWidth={1.5} />
                        )}
                      </div>
                    </div>
                    
                    <h2 className="font-serif font-medium leading-snug text-center z-10" style={{ fontSize: 22, color: "var(--color-ink)", padding: "0 8px" }}>
                      {user.name || "Reader"}
                    </h2>
                    <p className="text-center truncate z-10 flex items-center justify-center gap-2" style={{ fontSize: 14, color: "var(--color-text-muted)", width: "100%", padding: "0 16px", marginTop: 4 }}>
                      {user.email}
                    </p>
                    {roleBadge && (
                        <div style={{ marginTop: 16, zIndex: 10 }}>
                            <span
                                style={{
                                    padding: "4px 12px",
                                    borderRadius: 99,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    background: roleBadge.bg,
                                    color: roleBadge.color,
                                    border: `1px solid ${roleBadge.color}30`,
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                }}
                            >
                                {roleBadge.label}
                            </span>
                        </div>
                    )}
                  </div>

                  {/* Optional: PWA Install Button */}
                  {isInstallable && (
                    <div style={{ marginBottom: 24 }}>
                      <button 
                        onClick={handleInstallClick}
                        className="btn w-full flex items-center justify-center gap-2 transition-all shadow-sm group"
                        style={{
                            padding: "14px 24px", 
                            backgroundColor: "var(--color-accent)", 
                            border: "none", 
                            color: "var(--color-bg)",
                            fontSize: 15,
                            fontWeight: 600,
                            borderRadius: 12
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span>Install e-Read App</span>
                      </button>
                    </div>
                  )}

                  {/* 2. Menu Groups */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    {menuGroups.map((group, idx) => (
                      <div key={idx}>
                        <h3 className="font-bold uppercase" style={{ fontSize: 11, color: "var(--color-text-faint)", letterSpacing: "0.1em", marginBottom: 12, paddingLeft: 12 }}>
                          {group.title}
                        </h3>
                        <div className="card shadow-warm flex flex-col">
                          {group.items.map((item, itemIdx) => {
                            const Icon = item.icon;
                            return (
                              <Link
                                key={itemIdx}
                                href={item.href}
                                className="flex items-center group btn-ghost"
                                style={{
                                    padding: "14px 16px",
                                    gap: 16,
                                    border: "none",
                                    borderBottom: itemIdx !== group.items.length - 1 ? "1px solid var(--color-border)" : "none",
                                    borderRadius: 0,
                                    justifyContent: "flex-start",
                                    width: "100%"
                                }}
                              >
                                <div 
                                    className="rounded-xl flex items-center justify-center transition-all"
                                    style={{ padding: 8, backgroundColor: "var(--color-bg)", color: "var(--color-text-muted)" }}
                                >
                                  <Icon style={{ width: 18, height: 18 }} strokeWidth={2} />
                                </div>
                                <span className="font-medium flex-1 text-left" style={{ fontSize: 15, color: "var(--color-text)" }}>{item.label}</span>
                                <ChevronRight style={{ width: 16, height: 16, color: "var(--color-border-2)" }} className="group-hover:text-[var(--color-text-muted)] transition-colors" />
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 3. Actions Group */}
                  <div style={{ marginTop: 32 }}>
                    <button 
                      onClick={onLogout}
                      disabled={isLoggingOut}
                      className="btn w-full shadow-warm flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
                      style={{ 
                          padding: "16px 24px", 
                          backgroundColor: "var(--color-surface)", 
                          border: "1px solid var(--color-border)", 
                          color: "var(--color-warm-red)",
                          fontSize: 15,
                          fontWeight: 600
                      }}
                    >
                      {isLoggingOut ? (
                        <div className="spinner" style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-warm-red)", width: 16, height: 16 }}></div>
                      ) : (
                        <LogOut style={{ width: 16, height: 16 }} strokeWidth={2.5} />
                      )}
                      <span>{isLoggingOut ? 'Signing out...' : 'Sign out'}</span>
                    </button>
                  </div>

                </div>
              </motion.div>
            </SheetPrimitive.Content>

          </SheetPrimitive.Portal>
        )}
      </AnimatePresence>
    </Sheet>
  );
}
