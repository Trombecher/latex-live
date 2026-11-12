import {invoke} from "@tauri-apps/api/core";

/**
 * Compile LaTeX in the Rust backend.
 *
 * The backend returns raw PDF bytes through Tauri's IPC response channel, which
 * arrives in JavaScript as an `ArrayBuffer`.
 */
export async function compileLatex(
    source: string,
): Promise<Uint8Array<ArrayBuffer>> {
    const response = await invoke<ArrayBuffer | number[]>("compile_latex", {
        source,
    });

    if (response instanceof ArrayBuffer) {
        return new Uint8Array(response);
    }

    return Uint8Array.from(response);
}
