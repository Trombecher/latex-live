import type * as monaco from "monaco-editor/editor";
import {createSignal, onCleanup, onMount} from "solid-js";

import {EditorPane} from "./components/EditorPane";
import {ErrorPanel} from "./components/ErrorPanel";
import {PdfPreview} from "./components/PdfPreview";
import {Toolbar} from "./components/Toolbar";
import {compileLatex} from "./lib/compile";

export default function App() {
    let editor: monaco.editor.IStandaloneCodeEditor | undefined;
    let currentPdfUrl: string | null = null;

    const [compiling, setCompiling] = createSignal(false);
    const [pdfUrl, setPdfUrl] = createSignal<string | null>(null);
    const [error, setError] = createSignal<string | null>(null);
    const [durationMs, setDurationMs] = createSignal<number | null>(null);
    const [pageCount, setPageCount] = createSignal(0);

    const replacePdfUrl = (url: string | null) => {
        if (currentPdfUrl) {
            URL.revokeObjectURL(currentPdfUrl);
        }
        currentPdfUrl = url;
        setPdfUrl(url);
    };

    const compile = async () => {
        if (compiling() || !editor) {
            return;
        }

        setCompiling(true);
        setError(null);

        const startedAt = performance.now();

        try {
            const bytes = await compileLatex(editor.getValue());
            const blob = new Blob([bytes], {type: "application/pdf"});

            replacePdfUrl(URL.createObjectURL(blob));
            setDurationMs(performance.now() - startedAt);
        } catch (cause) {
            const message =
                typeof cause === "string"
                    ? cause
                    : cause instanceof Error
                      ? cause.message
                      : String(cause);

            setError(message);
        } finally {
            setCompiling(false);
        }
    };

    onMount(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                void compile();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        onCleanup(() => {
            window.removeEventListener("keydown", handleKeyDown);
        });
    });

    onCleanup(() => {
        if (currentPdfUrl) {
            URL.revokeObjectURL(currentPdfUrl);
        }
    });

    return (
        <div class="flex h-screen flex-col overflow-hidden bg-neutral-900 text-neutral-200">
            <Toolbar
                compiling={compiling()}
                durationMs={durationMs()}
                pageCount={pageCount()}
                error={error()}
                onCompile={() => void compile()}
            />

            <main class="flex min-h-0 flex-1">
                <section class="flex w-1/2 min-w-0 flex-col border-r border-neutral-700 bg-neutral-900">
                    <EditorPane
                        onReady={instance => {
                            editor = instance;
                        }}
                    />
                </section>

                <section class="flex min-w-0 flex-1 flex-col bg-neutral-800">
                    <PdfPreview
                        url={pdfUrl()}
                        onPageCount={count => setPageCount(count)}
                    />
                    <ErrorPanel error={error()} />
                </section>
            </main>
        </div>
    );
}
