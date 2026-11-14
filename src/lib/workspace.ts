import {invoke} from "@tauri-apps/api/core";
import {confirm, open} from "@tauri-apps/plugin-dialog";

export interface DirEntry {
    name: string;
    /**
     * Path relative to the workspace root, using `/` separators.
     */
    path: string;
    isDir: boolean;
}

export interface WorkspaceInfo {
    root: string;
    name: string;
    entries: DirEntry[];
}

/**
 * Show the native folder picker and return the selected absolute path.
 */
export async function chooseWorkspaceDirectory(): Promise<string | null> {
    const selected = await open({
        directory: true,
        multiple: false,
        title: "Open LaTeX project",
    });

    return typeof selected === "string" ? selected : null;
}

export function openWorkspace(path: string): Promise<WorkspaceInfo> {
    return invoke<WorkspaceInfo>("open_workspace", {path});
}

export function listDirectory(path: string): Promise<DirEntry[]> {
    return invoke<DirEntry[]>("list_workspace_directory", {path});
}

export function readFile(path: string): Promise<string> {
    return invoke<string>("read_workspace_file", {path});
}

/**
 * Save a file. LaTeX sources are formatted before they are written, and the
 * text that ended up on disk is returned so the editor can be updated.
 */
export function writeFile(path: string, contents: string): Promise<string> {
    return invoke<string>("write_workspace_file", {path, contents});
}

/**
 * Create an empty text file inside a directory (the workspace root for an empty
 * path) and return its relative path.
 */
export function createFile(directory: string, name: string): Promise<string> {
    return invoke<string>("create_workspace_file", {directory, name});
}

/**
 * Create an empty folder inside a directory (the workspace root for an empty
 * path) and return its relative path.
 */
export function createFolder(directory: string, name: string): Promise<string> {
    return invoke<string>("create_workspace_folder", {directory, name});
}

/**
 * Rename a file and return its new relative path.
 */
export function renameFile(path: string, name: string): Promise<string> {
    return invoke<string>("rename_workspace_file", {path, name});
}

/**
 * Move a file to the operating system's trash.
 */
export function trashFile(path: string): Promise<void> {
    return invoke<void>("trash_workspace_file", {path});
}

export function confirmTrashFile(
    fileName: string,
    hasUnsavedChanges: boolean,
): Promise<boolean> {
    return confirm(
        hasUnsavedChanges
            ? `${fileName} has unsaved changes. Move it to the trash?`
            : `Move ${fileName} to the trash?`,
        {
            title: "Move to trash",
            kind: "warning",
            okLabel: "Move to trash",
            cancelLabel: "Cancel",
        },
    );
}

export function confirmDiscardChanges(fileName: string): Promise<boolean> {
    return confirm(`Discard unsaved changes to ${fileName}?`, {
        title: "Unsaved changes",
        kind: "warning",
        okLabel: "Discard",
        cancelLabel: "Keep editing",
    });
}
