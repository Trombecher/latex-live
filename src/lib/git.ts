import {invoke} from "@tauri-apps/api/core";

export interface GitChange {
    /**
     * Path relative to the workspace root, using `/` separators.
     */
    path: string;
    /**
     * Previous path of a rename or copy, when it is inside the workspace.
     */
    origPath: string | null;
    /**
     * Status in the index (first porcelain column).
     */
    index: string;
    /**
     * Status in the working tree (second porcelain column).
     */
    worktree: string;
    /**
     * Single character used for the status badge.
     */
    status: string;
}

export interface GitStatus {
    isRepo: boolean;
    repoRoot: string | null;
    branch: string | null;
    detached: boolean;
    originUrl: string | null;
    ahead: number;
    behind: number;
    hasUpstream: boolean;
    changes: GitChange[];
}

export interface GitActionResult {
    message: string;
    status: GitStatus;
}

export function readGitStatus(): Promise<GitStatus> {
    return invoke<GitStatus>("git_status");
}

/**
 * Initialize a repository in the open folder.
 */
export function initRepository(): Promise<GitStatus> {
    return invoke<GitStatus>("git_init");
}

/**
 * Add the `origin` remote, or update it when it already exists.
 */
export function setOrigin(url: string): Promise<GitStatus> {
    return invoke<GitStatus>("git_set_origin", {url});
}

/**
 * Stage every change in the workspace, commit it, and push the current branch.
 * Without an origin remote the commit stays local.
 */
export function commitAndPush(message: string): Promise<GitActionResult> {
    return invoke<GitActionResult>("git_commit_push", {message});
}

/**
 * Fetch from `origin` and fast-forward the current branch.
 */
export function fetchAndPull(): Promise<GitActionResult> {
    return invoke<GitActionResult>("git_fetch_pull");
}
