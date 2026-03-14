import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDriveClient } from "@/lib/gdrive";
import { BookCategory } from "@prisma/client";

export async function GET(req: NextRequest) {
    const user = await getSession();

    if (!user || user.role !== "HEAD") {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
        async start(controller) {
            function sendEvent(data: object) {
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                } catch (err) {
                    console.error("SSE enqueue error", err);
                }
            }

            try {
                const drive = getDriveClient();
                const folderId = process.env.GDRIVE_SYNC_FOLDER_ID;

                let query = "(mimeType='application/pdf' or mimeType='application/epub+zip')";
                if (folderId) {
                    query += ` and '${folderId}' in parents`;
                }

                sendEvent({ type: "progress", totalFiles: 0, processedFiles: 0, currentFileName: "Fetching file list..." });

                let pageToken: string | undefined = undefined;
                const allFiles = [];

                do {
                    const res: any = await drive.files.list({
                        q: query,
                        fields: "nextPageToken, files(id, name, parents, size, mimeType, modifiedTime, thumbnailLink, hasThumbnail)",
                        pageToken: pageToken,
                        pageSize: 50,
                    });
                    
                    if (res.data.files) {
                        allFiles.push(...res.data.files);
                    }
                    pageToken = res.data.nextPageToken || undefined;
                } while (pageToken);

                const totalFiles = allFiles.length;
                let processedFiles = 0;
                let newBooksAdded = 0;

                const dbBooks = await prisma.book.findMany({
                    where: { provider: "GDRIVE" },
                    // @ts-ignore
                    select: { id: true, fileUrl: true, fileId: true }
                });

                // @ts-ignore
                const dbBooksMap = new Map(dbBooks.map((b: any) => [b.fileId || b.fileUrl, b.id]));
                const activeDriveFileIds = new Set<string>();

                for (const file of allFiles) {
                    const fileId = file.id!;
                    const fileName = file.name!;
                    activeDriveFileIds.add(fileId);

                    sendEvent({ type: "progress", totalFiles, processedFiles, currentFileName: fileName });

                    // Default Category
                    let category: BookCategory = "OTHERS";

                    // Simple folder-to-category mapping if parent exists
                    // For robust mapping we'd need to fetch parent folder names,
                    // but since this is optional, we'll assign OTHERS for now,
                    // unless we can map the filename
                    if (fileName.toLowerCase().includes("business") || fileName.toLowerCase().includes("invest")) {
                        category = "FINANCE_INVESTMENT";
                    } else if (fileName.toLowerCase().includes("code") || fileName.toLowerCase().includes("tech")) {
                        category = "TECHNOLOGY_AI";
                    } else if (fileName.toLowerCase().includes("self")) {
                        category = "SELF_DEVELOPMENT";
                    } else if (fileName.toLowerCase().includes("novel")) {
                        category = "LITERATURE_FICTION";
                    }

                    const normalizedFileUrl = fileId; 
                    let coverUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w600`;
                    
                    if (file.hasThumbnail && file.thumbnailLink) {
                        coverUrl = file.thumbnailLink.replace(/=s\d+/, "=s600");
                    }
                    
                    const existingBookId = dbBooksMap.get(fileId);

                    if (existingBookId) {
                        // Update metadata
                        await prisma.book.update({
                            where: { id: existingBookId },
                            data: {
                                title: fileName.replace(/\.[^/.]+$/, ""), // remove extension
                                fileSize: file.size ? parseInt(file.size) : null,
                                mimeType: file.mimeType,
                                // @ts-ignore
                                isArchived: false,
                                // @ts-ignore
                                fileId: fileId,
                                coverUrl: coverUrl
                                // category is kept the same to avoid overwriting user edits, unless we want to force
                            }
                        });
                    } else {
                        // Create new
                        await prisma.book.create({
                            data: {
                                title: fileName.replace(/\.[^/.]+$/, ""),
                                fileUrl: normalizedFileUrl,
                                coverUrl,
                                provider: "GDRIVE",
                                category: category,
                                userId: user.id, // assigning to HEAD user
                                fileSize: file.size ? parseInt(file.size) : null,
                                mimeType: file.mimeType,
                                // @ts-ignore
                                fileId: fileId,
                                // @ts-ignore
                                isArchived: false
                            }
                        });
                        newBooksAdded++;
                    }

                    processedFiles++;
                    sendEvent({ type: "progress", totalFiles, processedFiles, currentFileName: fileName });
                }

                // Cleanup (Mark missing as archived)
                // @ts-ignore
                const booksToArchive = dbBooks.filter((b: any) => !activeDriveFileIds.has(b.fileId || b.fileUrl!));
                if (booksToArchive.length > 0) {
                    await prisma.book.updateMany({
                        where: { id: { in: booksToArchive.map(b => b.id) } },
                        // @ts-ignore
                        data: { isArchived: true }
                    });
                }

                // Update lastSyncAt
                // @ts-ignore
                await prisma.systemConfig.upsert({
                    where: { id: "global" },
                    update: { lastSyncAt: new Date() },
                    create: { id: "global", lastSyncAt: new Date() }
                });

                sendEvent({ type: "complete", newBooksAdded });
                controller.close();
            } catch (error: any) {
                console.error("[SYNC_ERROR]", error);
                sendEvent({ type: "error", message: error.message || "Unknown error" });
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    });
}
