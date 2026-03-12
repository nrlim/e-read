import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "e-Read — Your Personal Digital Library",
    template: "%s | e-Read",
  },
  description:
    "A high-end personal digital library platform that connects to cloud storage and provides an immersive book-reading experience.",
  keywords: ["e-read", "digital library", "PDF reader", "ebooks", "personal library"],
  authors: [{ name: "e-Read" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "e-Read",
  },
  openGraph: {
    title: "e-Read — Your Personal Digital Library",
    description: "An immersive, warm-light digital reading experience.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F9F7F2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500&family=Instrument+Sans:wght@400;500;600&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="grain">
        {children}
      </body>
    </html>
  );
}
