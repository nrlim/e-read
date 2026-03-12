"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [form, setForm] = useState({ email: "", password: "" });
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Invalid credentials");
            } else {
                router.push("/library");
                router.refresh();
            }
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthLayout
            title="Welcome back"
            subtitle="Sign in to continue reading"
        >
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
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
                    </motion.div>
                )}

                {/* Email */}
                <div>
                    <label htmlFor="email" style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
                        Email address
                    </label>
                    <div style={{ position: "relative" }}>
                        <Mail size={18} strokeWidth={1.5} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-faint)" }} />
                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={form.email}
                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            className="input"
                            style={{ paddingLeft: 44 }}
                            placeholder="you@example.com"
                        />
                    </div>
                </div>

                {/* Password */}
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <label htmlFor="password" style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)" }}>
                            Password
                        </label>
                        <Link href="/auth/forgot" style={{ fontSize: 12, color: "var(--color-accent)", textDecoration: "none" }}>
                            Forgot password?
                        </Link>
                    </div>
                    <div style={{ position: "relative" }}>
                        <Lock size={18} strokeWidth={1.5} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-faint)" }} />
                        <input
                            id="password"
                            type={showPass ? "text" : "password"}
                            autoComplete="current-password"
                            required
                            value={form.password}
                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            className="input"
                            style={{ paddingLeft: 44, paddingRight: 48 }}
                            placeholder="Enter your password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPass(v => !v)}
                            style={{
                                position: "absolute",
                                right: 12,
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--color-text-faint)",
                                display: "flex",
                                padding: 4,
                            }}
                            aria-label={showPass ? "Hide password" : "Show password"}
                        >
                            {showPass ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ width: "100%", marginTop: 8, height: 50 }}
                    id="login-submit"
                >
                    {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : "Sign in"}
                </button>
            </form>

            <p style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-muted)", marginTop: 24 }}>
                Don&apos;t have an account?{" "}
                <Link href="/auth/register" style={{ color: "var(--color-accent)", fontWeight: 500, textDecoration: "none" }}>
                    Create one
                </Link>
            </p>
        </AuthLayout>
    );
}

/* ── Shared Auth Layout ─────────────────────────────── */
export function AuthLayout({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
}) {
    return (
        <div
            style={{
                minHeight: "100dvh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px 16px",
                background: "var(--color-bg)",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Ambient glow */}
            <div
                aria-hidden
                style={{
                    position: "absolute",
                    top: "-20%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 500,
                    height: 500,
                    borderRadius: "50%",
                    background: "radial-gradient(ellipse, rgba(139,105,20,0.08) 0%, transparent 70%)",
                    pointerEvents: "none",
                }}
            />

            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{ width: "100%", maxWidth: 400, position: "relative" }}
            >
                {/* Wordmark */}
                <Link
                    href="/"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 32,
                        textDecoration: "none",
                        justifyContent: "center",
                    }}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                    <span style={{ fontFamily: "var(--font-serif)", fontWeight: 700, fontSize: 20, color: "var(--color-ink)" }}>
                        e-Read
                    </span>
                </Link>

                {/* Card */}
                <div
                    className="paper-bg shadow-warm-lg"
                    style={{
                        borderRadius: "var(--radius-xl)",
                        padding: "36px 32px",
                        border: "1px solid var(--color-border)",
                    }}
                >
                    <h1
                        style={{
                            fontFamily: "var(--font-serif)",
                            fontSize: 26,
                            fontWeight: 700,
                            color: "var(--color-ink)",
                            marginBottom: 4,
                        }}
                    >
                        {title}
                    </h1>
                    <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 28 }}>
                        {subtitle}
                    </p>

                    {children}
                </div>

                {/* Decorative rule */}
                <div className="divider" style={{ marginTop: 32 }} />
                <p style={{ textAlign: "center", fontSize: 11, color: "var(--color-text-faint)", marginTop: 16 }}>
                    Secure — your data is encrypted and private
                </p>
            </motion.div>
        </div>
    );
}
