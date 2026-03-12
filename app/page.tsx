"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { BookOpen, Cloud, Shield, Feather } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const features = [
  {
    icon: Cloud,
    title: "Cloud Connected",
    description:
      "Link your Google Drive or OneDrive. Your entire PDF library, always at hand.",
  },
  {
    icon: BookOpen,
    title: "Immersive Reader",
    description:
      "A warm-light, distraction-free reading mode that respects your eyes and focus.",
  },
  {
    icon: Shield,
    title: "Private & Secure",
    description:
      "Your library stays yours. Hashed credentials, server-side sessions, no tracking.",
  },
  {
    icon: Feather,
    title: "Crafted for Reading",
    description:
      "Serif typography, parchment tones, and fluid transitions that invite you to stay.",
  },
];

export default function LandingPage() {
  return (
    <main
      style={{
        background: "var(--color-bg)",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Navigation ───────────────────────────────── */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(249,247,242,0.88)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--color-border)",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            height: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontWeight: 700,
                fontSize: 20,
                color: "var(--color-ink)",
                letterSpacing: "-0.02em",
              }}
            >
              e-Read
            </span>
          </div>

          {/* Nav links */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/auth/login" className="btn btn-ghost" style={{ padding: "8px 16px" }}>
              Sign in
            </Link>
            <Link href="/auth/register" className="btn btn-primary" style={{ padding: "8px 16px" }}>
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────── */}
      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "80px 24px 60px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative background circles */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "-10%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse, rgba(139,105,20,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Badge */}
        <motion.div
          variants={fadeUp}
          custom={0}
          initial="hidden"
          animate="visible"
          style={{ marginBottom: 28 }}
        >
          <span className="badge badge-accent">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            Personal Digital Library
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={fadeUp}
          custom={1}
          initial="hidden"
          animate="visible"
          className="text-balance"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(2.4rem, 6vw, 4.5rem)",
            fontWeight: 800,
            color: "var(--color-ink)",
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
            maxWidth: 760,
            marginBottom: 24,
          }}
        >
          Your library,
          <br />
          <em style={{ fontStyle: "italic", color: "var(--color-accent)" }}>beautifully</em>{" "}
          organised.
        </motion.h1>

        {/* Subheading */}
        <motion.p
          variants={fadeUp}
          custom={2}
          initial="hidden"
          animate="visible"
          style={{
            fontSize: "clamp(1rem, 2vw, 1.2rem)",
            color: "var(--color-text-muted)",
            maxWidth: 520,
            lineHeight: 1.7,
            marginBottom: 40,
          }}
        >
          Connect your cloud storage and rediscover your PDF collection in an
          immersive, warm-light reading environment crafted for focus.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          variants={fadeUp}
          custom={3}
          initial="hidden"
          animate="visible"
          style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}
        >
          <Link href="/auth/register" className="btn btn-primary" style={{ fontSize: 15, padding: "12px 28px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            Create your library
          </Link>
          <Link href="/auth/login" className="btn btn-ghost" style={{ fontSize: 15, padding: "12px 28px" }}>
            Sign in
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </motion.div>

        {/* Hero book visual */}
        <motion.div
          variants={fadeUp}
          custom={4}
          initial="hidden"
          animate="visible"
          style={{ marginTop: 64, position: "relative" }}
        >
          <HeroBookStack />
        </motion.div>
      </section>

      {/* ── Features ─────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "60px 24px 80px",
          width: "100%",
        }}
      >
        <div className="divider" style={{ marginBottom: 56 }} />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 24,
          }}
        >
          {features.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                variants={fadeUp}
                custom={i}
                className="card"
                style={{ padding: "28px 24px" }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "var(--radius-md)",
                    background: "var(--color-accent-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <Icon size={20} strokeWidth={1.5} color="var(--color-accent)" />
                </div>
                <h3
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 18,
                    fontWeight: 600,
                    color: "var(--color-ink)",
                    marginBottom: 8,
                  }}
                >
                  {feat.title}
                </h3>
                <p style={{ fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.65 }}>
                  {feat.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid var(--color-border)",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 13, color: "var(--color-text-faint)" }}>
          &copy; {new Date().getFullYear()} e-Read. Crafted for readers.
        </p>
      </footer>
    </main>
  );
}

/* ── Decorative Book Stack SVG ──────────────────────── */
function HeroBookStack() {
  return (
    <svg
      width="320"
      height="200"
      viewBox="0 0 320 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Book 3 (back) */}
      <rect x="60" y="60" width="110" height="150" rx="4" fill="#D4CEBE" stroke="#C4BDB3" strokeWidth="1" />
      <rect x="60" y="60" width="12" height="150" rx="2" fill="#C4BDB3" />
      <line x1="80" y1="90" x2="160" y2="90" stroke="#B8B0A4" strokeWidth="1" />
      <line x1="80" y1="105" x2="155" y2="105" stroke="#B8B0A4" strokeWidth="1" />
      <line x1="80" y1="120" x2="145" y2="120" stroke="#B8B0A4" strokeWidth="1" />

      {/* Book 2 (middle) */}
      <rect x="95" y="40" width="110" height="150" rx="4" fill="#E5E1D8" stroke="#D4CEBE" strokeWidth="1" />
      <rect x="95" y="40" width="12" height="150" rx="2" fill="#D4CEBE" />
      <line x1="115" y1="70" x2="195" y2="70" stroke="#C4BDB3" strokeWidth="1" />
      <line x1="115" y1="85" x2="190" y2="85" stroke="#C4BDB3" strokeWidth="1" />
      <line x1="115" y1="100" x2="180" y2="100" stroke="#C4BDB3" strokeWidth="1" />

      {/* Book 1 (front — accent) */}
      <rect x="130" y="20" width="122" height="162" rx="4" fill="#FFFDF9" stroke="#E5E1D8" strokeWidth="1.5" />
      <rect x="130" y="20" width="14" height="162" rx="2" fill="#F0E8D6" />
      {/* Book spine stripe */}
      <rect x="133" y="20" width="8" height="162" rx="1" fill="rgba(139,105,20,0.15)" />
      {/* Title lines */}
      <line x1="155" y1="55" x2="242" y2="55" stroke="#D4CEBE" strokeWidth="1.5" />
      <line x1="155" y1="68" x2="235" y2="68" stroke="#D4CEBE" strokeWidth="1" />
      <line x1="155" y1="95" x2="238" y2="95" stroke="#E5E1D8" strokeWidth="1" />
      <line x1="155" y1="108" x2="230" y2="108" stroke="#E5E1D8" strokeWidth="1" />
      <line x1="155" y1="121" x2="240" y2="121" stroke="#E5E1D8" strokeWidth="1" />
      <line x1="155" y1="134" x2="225" y2="134" stroke="#E5E1D8" strokeWidth="1" />
      <line x1="155" y1="147" x2="235" y2="147" stroke="#E5E1D8" strokeWidth="1" />

      {/* Gold bookmark ribbon */}
      <path d="M242 20 L242 52 L236 46 L230 52 L230 20 Z" fill="rgba(139,105,20,0.6)" />

      {/* Subtle shadow under stack */}
      <ellipse cx="180" cy="190" rx="100" ry="8" fill="rgba(139,105,20,0.06)" />
    </svg>
  );
}
