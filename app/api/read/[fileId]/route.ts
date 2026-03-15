/**
 * app/api/read/[fileId]/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Authenticated GDrive PDF proxy.
 *
 * GET /api/read/<driveFileId>
 *   → Returns the raw PDF bytes with Content-Type: application/pdf
 *   → Requires an active e-Read session cookie.
 *
 * The file must be shared with the service account's email address.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDriveClient } from "@/lib/gdrive";
import { Readable } from "stream";


export const dynamic = "force-dynamic";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ fileId: string }> }
) {
    // ── 1. Auth guard ────────────────────────────────────────────
    const user = await getSession();
    if (!user) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { fileId } = await params;
    if (!fileId) {
        return new NextResponse("Missing fileId", { status: 400 });
    }

    // ── 2. Fetch from Google Drive ────────────────────────────────
    try {
        const drive = getDriveClient();

        const response = await drive.files.get(
            { fileId, alt: "media" },
            { responseType: "stream" }
        );

        // ── 3. Stream the PDF back to the browser ─────────────────
        // We use native Readable.toWeb to correctly map the Node stream
        // to a Web stream (handles backpressure and avoids edge runtime freezes)
        const nodeStream = response.data as Readable;
        const webStream = Readable.toWeb(nodeStream) as Readonly<ReadableStream>;

        const contentType = (response.headers["content-type"] as string) || "application/pdf";

        return new NextResponse(webStream, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "private, max-age=3600",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (process.env.NODE_ENV !== "production") {
            console.error("[/api/read] Error:", msg);
        }

        if (msg.includes("404") || msg.includes("notFound")) {
            return new NextResponse("File not found in Google Drive", { status: 404 });
        }
        if (msg.includes("403") || msg.includes("forbidden")) {
            return new NextResponse(
                "Access denied — make sure the file is shared with the service account email.",
                { status: 403 }
            );
        }

        return new NextResponse("Failed to fetch PDF", { status: 500 });
    }
}
