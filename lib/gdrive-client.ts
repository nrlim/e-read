/**
 * lib/gdrive-client.ts
 * ─────────────────────────────────────────────────────────────────
 * Client-safe utilities for Google Drive (no Node-only imports).
 * Can be imported in both server and client components.
 */

/** Extract the raw GDrive file ID from various URL formats */
export function extractDriveFileId(fileUrl: string): string | null {
    const patterns = [
        /\/d\/([a-zA-Z0-9_-]+)/,
        /[?&]id=([a-zA-Z0-9_-]+)/,
        /^([a-zA-Z0-9_-]{25,})$/, // bare ID
    ];
    for (const re of patterns) {
        const m = fileUrl.match(re);
        if (m?.[1]) return m[1];
    }
    return null;
}
