import {invoke} from "@tauri-apps/api/core";

/**
 * A source location parsed from the LaTeX log.
 */
export interface CompileDiagnostic {
    file: string;
    line: number;
    message: string;
    severity: "error" | "warning";
}

interface CompileFailure {
    message: string;
    diagnostics?: CompileDiagnostic[];
}

/**
 * A compilation failure that carries the errors parsed from the log.
 */
export class LatexCompileError extends Error {
    readonly diagnostics: CompileDiagnostic[];

    constructor(message: string, diagnostics: CompileDiagnostic[]) {
        super(message);
        this.name = "LatexCompileError";
        this.diagnostics = diagnostics;
    }
}

function isCompileFailure(cause: unknown): cause is CompileFailure {
    return (
        typeof cause === "object"
        && cause !== null
        && "message" in cause
        && typeof (cause as {message: unknown}).message === "string"
    );
}

/**
 * Compile LaTeX in the Rust backend.
 *
 * `path` is relative to the open workspace and determines both the primary
 * input name and Tectonic's filesystem root, so relative includes and assets
 * resolve. The source comes from the editor buffer, allowing compilation of
 * unsaved changes.
 *
 * The backend returns raw PDF bytes through Tauri's IPC response channel, which
 * arrives in JavaScript as an `ArrayBuffer`. On failure it throws a
 * {@link LatexCompileError} carrying both the full log and the structured errors
 * extracted from it.
 */
export async function compileLatex(
    source: string,
    path: string,
): Promise<Uint8Array<ArrayBuffer>> {
    let response: ArrayBuffer | number[];

    try {
        response = await invoke<ArrayBuffer | number[]>("compile_latex", {
            source,
            path,
        });
    } catch (cause) {
        if (isCompileFailure(cause)) {
            throw new LatexCompileError(cause.message, cause.diagnostics ?? []);
        }

        throw cause;
    }

    if (response instanceof ArrayBuffer) {
        return new Uint8Array(response);
    }

    return Uint8Array.from(response);
}
