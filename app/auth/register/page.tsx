"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react";
import { AuthLayout } from "../login/page";

export default function RegisterPage() {
    const router = useRouter();
    const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        if (form.password !== form.confirm) {
            setError("Passwords do not match");
            return;
        }
        if (form.password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Registration failed");
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

    const strength = getPasswordStrength(form.password);

    return (
        <AuthLayout title="Create your library" subtitle="Start reading beautifully today">
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

                {/* Name */}
                <div>
                    <label htmlFor="reg-name" style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
                        Full name
                    </label>
                    <div style={{ position: "relative" }}>
                        <User size={18} strokeWidth={1.5} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-faint)" }} />
                        <input
                            id="reg-name"
                            type="text"
                            autoComplete="name"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="input"
                            style={{ paddingLeft: 44 }}
                            placeholder="Your name"
                        />
                    </div>
                </div>

                {/* Email */}
                <div>
                    <label htmlFor="reg-email" style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
                        Email address
                    </label>
                    <div style={{ position: "relative" }}>
                        <Mail size={18} strokeWidth={1.5} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-faint)" }} />
                        <input
                            id="reg-email"
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
                    <label htmlFor="reg-password" style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
                        Password
                    </label>
                    <div style={{ position: "relative" }}>
                        <Lock size={18} strokeWidth={1.5} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-faint)" }} />
                        <input
                            id="reg-password"
                            type={showPass ? "text" : "password"}
                            required
                            value={form.password}
                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            className="input"
                            style={{ paddingLeft: 44, paddingRight: 48 }}
                            placeholder="Min. 8 characters"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPass(v => !v)}
                            style={{
                                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                                background: "none", border: "none", cursor: "pointer",
                                color: "var(--color-text-faint)", display: "flex", padding: 4,
                            }}
                            aria-label={showPass ? "Hide password" : "Show password"}
                        >
                            {showPass ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                        </button>
                    </div>
                    {/* Password strength */}
                    {form.password.length > 0 && (
                        <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
                            {[1, 2, 3, 4].map(i => (
                                <div
                                    key={i}
                                    style={{
                                        flex: 1,
                                        height: 3,
                                        borderRadius: 99,
                                        background: i <= strength.score ? strength.color : "var(--color-border)",
                                        transition: "background 0.2s ease",
                                    }}
                                />
                            ))}
                            <span style={{ fontSize: 11, color: strength.color, marginLeft: 6, whiteSpace: "nowrap" }}>
                                {strength.label}
                            </span>
                        </div>
                    )}
                </div>

                {/* Confirm */}
                <div>
                    <label htmlFor="reg-confirm" style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
                        Confirm password
                    </label>
                    <div style={{ position: "relative" }}>
                        <Lock size={18} strokeWidth={1.5} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-faint)" }} />
                        <input
                            id="reg-confirm"
                            type={showPass ? "text" : "password"}
                            required
                            value={form.confirm}
                            onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                            className="input"
                            style={{
                                paddingLeft: 44,
                                borderColor: form.confirm && form.confirm !== form.password ? "var(--color-warm-red)" : undefined,
                            }}
                            placeholder="Repeat your password"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ width: "100%", marginTop: 8, height: 50 }}
                    id="register-submit"
                >
                    {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : "Create library"}
                </button>
            </form>

            <p style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-muted)", marginTop: 24 }}>
                Already have an account?{" "}
                <Link href="/auth/login" style={{ color: "var(--color-accent)", fontWeight: 500, textDecoration: "none" }}>
                    Sign in
                </Link>
            </p>
        </AuthLayout>
    );
}

function getPasswordStrength(pass: string) {
    let score = 0;
    if (pass.length >= 8) score++;
    if (pass.length >= 12) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/[0-9!@#$%^&*]/.test(pass)) score++;
    score = Math.max(1, Math.min(4, score));
    const labels = ["", "Weak", "Fair", "Good", "Strong"];
    const colors = ["", "#C2553A", "#D4A017", "#8B6914", "#4A7C59"];
    return { score, label: labels[score], color: colors[score] };
}
