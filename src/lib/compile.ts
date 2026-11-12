import {invoke} from "@tauri-apps/api/core";

/**
 * Compile LaTeX in the Rust backend.
 *
 * `path` is relative to the open workspace and determines both the primary
 * input name and Tectonic's filesystem root, so relative includes and assets
 * resolve. The source comes from the editor buffer, allowing compilation of
 * unsaved changes.
 *
 * The backend returns raw PDF bytes through Tauri's IPC response channel, which
 * arrives in JavaScript as an `ArrayBuffer`.
 */
export async function compileLatex(
    source: string,
    path: string,
): Promise<Uint8Array<ArrayBuffer>> {
    const response = await invoke<ArrayBuffer | number[]>("compile_latex", {
        source,
        path,
    });

    if (response instanceof ArrayBuffer) {
        return new Uint8Array(response);
    }

    return Uint8Array.from(response);
}
