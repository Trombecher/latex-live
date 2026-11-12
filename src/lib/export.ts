import {invoke} from "@tauri-apps/api/core";
import {save} from "@tauri-apps/plugin-dialog";

/**
 * Ask where to save the compiled PDF, then write it there.
 *
 * Returns the chosen destination, or `null` when the dialog was cancelled.
 */
export async function exportPdf(
    defaultPath: string,
    bytes: Uint8Array,
): Promise<string | null> {
    const destination = await save({
        defaultPath,
        title: "Export PDF",
        filters: [{name: "PDF", extensions: ["pdf"]}],
    });

    if (typeof destination !== "string") {
        return null;
    }

    // The destination and PDF travel as one raw IPC body: a little-endian u32
    // byte length followed by the UTF-8 path and then the PDF itself.
    const pathBytes = new TextEncoder().encode(destination);
    const payload = new Uint8Array(4 + pathBytes.length + bytes.length);
    new DataView(payload.buffer).setUint32(0, pathBytes.length, true);
    payload.set(pathBytes, 4);
    payload.set(bytes, 4 + pathBytes.length);

    await invoke<void>("export_pdf", payload);

    return destination;
}
