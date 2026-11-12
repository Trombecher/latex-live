import type {DirEntry} from "./workspace";

/**
 * The final path segment.
 */
export function fileName(path: string): string {
    return path.split("/").pop() || path;
}

/**
 * Lowercase extension without the dot, or an empty string.
 */
export function fileExtension(path: string): string {
    const name = fileName(path);
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function isTexFile(path: string): boolean {
    const extension = fileExtension(path);
    return extension === "tex" || extension === "latex";
}

export function errorMessage(cause: unknown): string {
    return typeof cause === "string"
        ? cause
        : cause instanceof Error
          ? cause.message
          : String(cause);
}

export type {DirEntry};
