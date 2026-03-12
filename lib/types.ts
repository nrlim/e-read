export type CloudProvider = "GDRIVE" | "ONEDRIVE" | "LOCAL";

export interface Book {
    id: string;
    title: string;
    author: string | null;
    coverUrl: string | null;
    fileUrl: string;
    provider: CloudProvider;
    currentPage: number;
    totalPages: number | null;
    fileSize: number | null;
    mimeType: string | null;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
    userId: string;
}

export interface User {
    id: string;
    email: string;
    password: string;
    name: string | null;
    avatar: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface Session {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
}
