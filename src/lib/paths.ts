/**
 * Helpers for workspace-relative paths, which always use `/` separators.
 */

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

/**
 * The containing directory of a relative path, or "" for the root.
 */
export function parentPath(path: string): string {
    const slash = path.lastIndexOf("/");
    return slash === -1 ? "" : path.slice(0, slash);
}
