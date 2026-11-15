import {join} from "@tauri-apps/api/path";
import type * as monaco from "monaco-editor/editor";
import {createSignal} from "solid-js";

import {
    compileLatex,
    LatexCompileError,
    type CompileDiagnostic,
} from "./compile";
import {errorMessage} from "./errors";
import {exportPdf} from "./export";

interface CompilerOptions {
    editor: () => monaco.editor.IStandaloneCodeEditor | undefined;
    /**
     * Workspace-relative path of the file to compile, or null.
     */
    path: () => string | null;
    /**
     * Absolute workspace root, used to suggest a PDF export destination.
     */
    workspaceRoot: () => string | null;
    canCompile: () => boolean;
    replacePdfUrl: (url: string | null) => void;
    setFileError: (message: string | null) => void;
}

/**
 * Compiles the editor buffer and owns the resulting PDF bytes, diagnostics and
 * the last compile error.
 */
export function createCompiler(options: CompilerOptions) {
    const [compiling, setCompiling] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    const [diagnostics, setDiagnostics] = createSignal<CompileDiagnostic[]>([]);

    let pdfBytes: Uint8Array | null = null;

    const reset = () => {
        pdfBytes = null;
        options.replacePdfUrl(null);
        setError(null);
        setDiagnostics([]);
    };

    const compile = async () => {
        const editor = options.editor();
        const path = options.path();

        if (compiling() || !options.canCompile() || !editor || !path) {
            return;
        }

        setCompiling(true);
        setError(null);
        setDiagnostics([]);

        try {
            const bytes = await compileLatex(editor.getValue(), path);
            const blob = new Blob([bytes], {type: "application/pdf"});

            pdfBytes = bytes;
            options.replacePdfUrl(URL.createObjectURL(blob));
        } catch (cause) {
            setError(errorMessage(cause));
            setDiagnostics(
                cause instanceof LatexCompileError ? cause.diagnostics : [],
            );
        } finally {
            setCompiling(false);
        }
    };

    const exportCurrentPdf = async () => {
        const root = options.workspaceRoot();
        if (!pdfBytes || !root) {
            return;
        }

        const path = options.path();
        const relativePdf = path
            ? path.replace(/\.(tex|latex)$/i, ".pdf")
            : "document.pdf";

        try {
            const destination = await exportPdf(
                await join(root, relativePdf),
                pdfBytes,
            );

            if (destination) {
                options.setFileError(null);
            }
        } catch (cause) {
            options.setFileError(errorMessage(cause));
        }
    };

    return {compiling, error, diagnostics, compile, exportCurrentPdf, reset};
}
