export type CloudProvider = "GDRIVE" | "ONEDRIVE" | "LOCAL";

export type BookCategory =
    | "SELF_DEVELOPMENT"
    | "FINANCE_INVESTMENT"
    | "TECHNOLOGY_AI"
    | "LANGUAGE_SKILLS"
    | "LITERATURE_FICTION"
    | "SPIRITUALITY"
    | "OTHERS";

export type UserRole = "HEAD" | "LEAD" | "MEMBER";

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
    category: BookCategory | null;
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
    role: UserRole;
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

/* ── Role-based Permission Helpers ─────────────────── */

/** Can add a new book to the library */
export function canAddBook(role: UserRole): boolean {
    return role === "HEAD" || role === "LEAD";
}

/** Can delete a book */
export function canDeleteBook(role: UserRole): boolean {
    return role === "HEAD" || role === "LEAD";
}

/** Can manage users / admin-level features (future use) */
export function canManageUsers(role: UserRole): boolean {
    return role === "HEAD";
}
