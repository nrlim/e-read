/**
 * app/api/thumb/[fileId]/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Authenticated Google Drive thumbnail proxy.
 *
 * GET /api/thumb/<driveFileId>
 *   → Fetches the thumbnail image for the given Drive file using the
 *     service-account credentials and returns it as image/* bytes.
 *   → Requires an active e-Read session cookie.
 *   → Cached by CDN / browser for 1 hour to avoid hammering Drive API.
 *
 * Why this proxy exists:
 *   Google Drive's thumbnailLink is a short-lived, authenticated URL
 *   (lh3.googleusercontent.com). Rendering it directly in an <img>
 *   tag fails with 403 because the browser doesn't carry the service
 *   account credentials, and setting referrerPolicy="no-referrer"
 *   makes it even worse. This proxy fetches the image server-side
 *   with proper auth and streams it to the client.
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
    // ── 1. Auth guard ─────────────────────────────────────────────
    const user = await getSession();
    if (!user) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { fileId } = await params;
    if (!fileId) {
        return new NextResponse("Missing fileId", { status: 400 });
    }

    // ── 2. Fetch thumbnail from Google Drive ──────────────────────
    try {
        const drive = getDriveClient();

        // Get the file metadata to retrieve thumbnailLink
        const meta = await drive.files.get({
            fileId,
            fields: "id, hasThumbnail, thumbnailLink",
        });

        const { hasThumbnail, thumbnailLink } = meta.data;

        if (!hasThumbnail || !thumbnailLink) {
            // No thumbnail available — return 404 so <BookCover> falls back
            return new NextResponse("No thumbnail", { status: 404 });
        }

        // Upgrade thumbnail resolution: replace =s220 with =s600
        const highResThumbnailUrl = thumbnailLink.replace(/=s\d+/, "=s600");

        // ── 3. Fetch the actual image bytes ───────────────────────
        // We need to use the authenticated Drive client's underlying
        // GoogleAuth to get a token and inject it into the fetch call.
        const auth = (drive as any)._options?.auth;
        let imageRes: Response;

        if (auth && typeof auth.getAccessToken === "function") {
            const tokenResult = await auth.getAccessToken();
            const accessToken = tokenResult?.token ?? tokenResult;

            imageRes = await fetch(highResThumbnailUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
        } else {
            // Fallback: try without auth (works for public thumbnails)
            imageRes = await fetch(highResThumbnailUrl);
        }

        if (!imageRes.ok) {
            return new NextResponse("Thumbnail fetch failed", { status: imageRes.status });
        }

        const contentType = imageRes.headers.get("content-type") ?? "image/jpeg";
        const buffer = await imageRes.arrayBuffer();

        // ── 4. Return with aggressive caching ────────────────────
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                // Cache for 1h in the browser, 24h in the CDN (stale-while-revalidate)
                "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (process.env.NODE_ENV !== "production") {
            console.error("[/api/thumb]", fileId, msg);
        }

        if (msg.includes("404") || msg.includes("notFound")) {
            return new NextResponse("File not found", { status: 404 });
        }
        if (msg.includes("403") || msg.includes("forbidden")) {
            return new NextResponse("Access denied", { status: 403 });
        }

        return new NextResponse("Thumbnail error", { status: 500 });
    }
}
