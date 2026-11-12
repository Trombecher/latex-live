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

export function writeFile(path: string, contents: string): Promise<void> {
    return invoke<void>("write_workspace_file", {path, contents});
}

export function confirmDiscardChanges(fileName: string): Promise<boolean> {
    return confirm(`Discard unsaved changes to ${fileName}?`, {
        title: "Unsaved changes",
        kind: "warning",
        okLabel: "Discard",
        cancelLabel: "Keep editing",
    });
}
