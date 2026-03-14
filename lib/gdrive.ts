/**
 * lib/gdrive.ts
 * ─────────────────────────────────────────────────────────────────
 * Singleton Google Auth client backed by a Service Account.
 *
 * The JSON key is stored as a Base-64 string in GOOGLE_SERVICE_ACCOUNT_KEY.
 * Steps to generate:
 *   1. Create a Service Account in Google Cloud Console.
 *   2. Download the JSON key.
 *   3. Base64-encode it:
 *        Node:    Buffer.from(JSON.stringify(json)).toString("base64")
 *        Shell:   base64 -w 0 service-account.json
 *   4. Paste the result into .env as GOOGLE_SERVICE_ACCOUNT_KEY.
 *   5. Share every Drive PDF / folder with the service-account email.
 */

import { google } from "googleapis";

let _driveClient: ReturnType<typeof google.drive> | null = null;

/** Extract the raw GDrive file ID from various URL formats */
export function extractDriveFileId(fileUrl: string): string | null {
    // /d/{id}/  or  ?id={id}  or  /open?id={id}
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

/** Returns an authenticated Google Drive v3 client (lazy singleton) */
export function getDriveClient() {
    if (_driveClient) return _driveClient;

    const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!encoded || encoded === "PASTE_BASE64_ENCODED_SERVICE_ACCOUNT_JSON_HERE") {
        throw new Error(
            "[GDrive] GOOGLE_SERVICE_ACCOUNT_KEY is not configured. " +
            "Please follow the instructions in .env."
        );
    }

    let credentials: object;
    try {
        credentials = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
    } catch {
        throw new Error("[GDrive] Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY. Ensure it is valid Base-64 JSON.");
    }

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    _driveClient = google.drive({ version: "v3", auth });
    return _driveClient;
}
