import type {GitChange} from "./git";

/**
 * Whether a change is not staged for commit yet, including untracked files.
 */
export function isUnstaged(change: GitChange): boolean {
    return change.index === "?" || change.worktree !== " ";
}

/**
 * Whether a change is staged in the index.
 */
export function isStaged(change: GitChange): boolean {
    return change.index !== " " && change.index !== "?";
}

/**
 * Visual Studio Code shows untracked files as "U".
 */
export function badgeLabel(status: string): string {
    return status === "?" ? "U" : status;
}

export function statusColor(status: string): string {
    switch (status) {
        case "M":
            return "text-amber-600 dark:text-amber-400";
        case "A":
            return "text-emerald-600 dark:text-emerald-400";
        case "D":
            return "text-danger-text";
        case "R":
            return "text-blue-600 dark:text-blue-400";
        case "C":
            return "text-cyan-600 dark:text-cyan-400";
        case "U":
            return "text-danger-text-strong";
        default:
            return "text-surface-500";
    }
}
