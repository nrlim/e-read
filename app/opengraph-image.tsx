import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";
export const alt = "e-Read — Your Personal Digital Library";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logoData = readFileSync(join(process.cwd(), "public/icons/eread-logo.png"));
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #F9F7F2 0%, #E8E5D9 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255, 255, 255, 0.8)",
            padding: "80px 100px",
            borderRadius: 48,
            boxShadow: "0 30px 60px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 32, marginBottom: 24 }}>
            {/* App Logo */}
            <img src={logoSrc} width="80" height="80" style={{ objectFit: "contain" }} alt="e-Read Logo" />
            <span
              style={{
                fontSize: 96,
                fontWeight: 800,
                color: "#1A1A1A",
                letterSpacing: "-0.04em",
              }}
            >
              e-Read
            </span>
          </div>

          <p
            style={{
              fontSize: 36,
              color: "#4B5563",
              fontWeight: 500,
              marginTop: 0,
              marginBottom: 0,
              letterSpacing: "-0.01em",
              textAlign: "center",
            }}
          >
            Your Immersive Digital Library
          </p>

          <div
            style={{
              marginTop: 48,
              display: "flex",
              gap: 16,
            }}
          >
            <span
              style={{
                fontSize: 20,
                padding: "12px 24px",
                background: "#F3F4F6",
                color: "#6B7280",
                borderRadius: 99,
                fontWeight: 600,
              }}
            >
              Read Anywhere
            </span>
            <span
              style={{
                fontSize: 20,
                padding: "12px 24px",
                background: "#F3F4F6",
                color: "#6B7280",
                borderRadius: 99,
                fontWeight: 600,
              }}
            >
              Cloud Synchronized
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
