import type * as monaco from "monaco-editor/editor";
import {Show, createSignal, onCleanup, onMount} from "solid-js";

import {EditorPane, type EditorFile} from "./components/EditorPane";
import {ErrorPanel} from "./components/ErrorPanel";
import {FilePlaceholder} from "./components/FilePlaceholder";
import {Logo} from "./components/Logo";
import {PaneSeparator} from "./components/PaneSeparator";
import {PdfPreview, Spinner} from "./components/PdfPreview";
import {PreviewToolbar} from "./components/PreviewToolbar";
import {Sidebar} from "./components/Sidebar";
import {compileLatex} from "./lib/compile";
import {errorMessage, fileName, isTexFile} from "./lib/files";
import {
    chooseWorkspaceDirectory,
    confirmDiscardChanges,
    openWorkspace,
    readFile,
    writeFile,
    type DirEntry,
    type WorkspaceInfo,
} from "./lib/workspace";

export default function App() {
    let editor: monaco.editor.IStandaloneCodeEditor | undefined;
    let currentPdfUrl: string | null = null;
    let savedText = "";
    let readGeneration = 0;
    let pendingSave: Promise<void> | null = null;

    const [workspace, setWorkspace] = createSignal<WorkspaceInfo | null>(null);
    const [selection, setSelection] = createSignal<DirEntry | null>(null);
    const [editorFile, setEditorFile] = createSignal<EditorFile | null>(null);
    const [dirty, setDirty] = createSignal(false);
    const [loadingFile, setLoadingFile] = createSignal(false);
    const [fileError, setFileError] = createSignal<string | null>(null);

    const [compiling, setCompiling] = createSignal(false);
    const [pdfUrl, setPdfUrl] = createSignal<string | null>(null);
    const [error, setError] = createSignal<string | null>(null);
    const [pageCount, setPageCount] = createSignal(0);
    const [previewRatio, setPreviewRatio] = createSignal(0.5);

    const isTexSelected = () => {
        const entry = selection();
        return entry !== null && !entry.isDir && isTexFile(entry.path);
    };

    const canCompile = () =>
        isTexSelected() && !loadingFile() && editorFile() !== null;

    const replacePdfUrl = (url: string | null) => {
        if (currentPdfUrl) {
            URL.revokeObjectURL(currentPdfUrl);
        }
        currentPdfUrl = url;
        setPdfUrl(url);
    };

    const resetPreview = () => {
        replacePdfUrl(null);
        setError(null);
        setPageCount(0);
    };

    const clearCurrentFile = () => {
        readGeneration += 1;
        setSelection(null);
        setEditorFile(null);
        savedText = "";
        setDirty(false);
        setLoadingFile(false);
        resetPreview();
    };

    const confirmDiscard = async (): Promise<boolean> => {
        if (pendingSave) {
            await pendingSave;
        }

        const entry = selection();
        if (!dirty() || !entry) {
            return true;
        }

        return confirmDiscardChanges(fileName(entry.path));
    };

    const selectEntry = async (entry: DirEntry) => {
        if (entry.isDir) {
            return;
        }

        const current = selection();
        if (current?.path === entry.path) {
            return;
        }

        if (!(await confirmDiscard())) {
            return;
        }

        const generation = ++readGeneration;

        setSelection(entry);
        setFileError(null);

        if (!isTexFile(entry.path)) {
            setEditorFile(null);
            savedText = "";
            setDirty(false);
            setLoadingFile(false);
            resetPreview();
            return;
        }

        setLoadingFile(true);

        try {
            const text = await readFile(entry.path);

            if (generation !== readGeneration) {
                return;
            }

            savedText = text;
            setEditorFile({path: entry.path, text});
            setDirty(false);
            resetPreview();
        } catch (cause) {
            if (generation !== readGeneration) {
                return;
            }

            setSelection(null);
            setEditorFile(null);
            savedText = "";
            setDirty(false);
            setFileError(errorMessage(cause));
        } finally {
            if (generation === readGeneration) {
                setLoadingFile(false);
            }
        }
    };

    const openFolder = async () => {
        if (!(await confirmDiscard())) {
            return;
        }

        try {
            const path = await chooseWorkspaceDirectory();
            if (!path) {
                return;
            }

            const info = await openWorkspace(path);

            clearCurrentFile();
            setFileError(null);
            setWorkspace(info);

            const main = info.entries.find(
                entry =>
                    !entry.isDir && entry.name.toLowerCase() === "main.tex",
            );

            if (main) {
                await selectEntry(main);
            }
        } catch (cause) {
            setFileError(errorMessage(cause));
        }
    };

    const save = async (): Promise<void> => {
        const entry = selection();
        if (
            !editor
            || !entry
            || !isTexFile(entry.path)
            || loadingFile()
            || !editorFile()
        ) {
            return;
        }

        try {
            const text = editor.getValue();
            await writeFile(entry.path, text);
            savedText = text;
            setDirty(editor.getValue() !== savedText);
            setFileError(null);
        } catch (cause) {
            setFileError(errorMessage(cause));
        }
    };

    const saveIfDirty = () => {
        if (!dirty() || pendingSave) {
            return;
        }

        const promise = save();
        pendingSave = promise;
        void promise.finally(() => {
            if (pendingSave === promise) {
                pendingSave = null;
            }
        });
    };

    const compile = async () => {
        const entry = selection();
        if (
            compiling()
            || !editor
            || !entry
            || !isTexFile(entry.path)
            || !workspace()
            || loadingFile()
            || !editorFile()
        ) {
            return;
        }

        setCompiling(true);
        setError(null);

        try {
            const bytes = await compileLatex(editor.getValue(), entry.path);
            const blob = new Blob([bytes], {type: "application/pdf"});

            replacePdfUrl(URL.createObjectURL(blob));
        } catch (cause) {
            setError(errorMessage(cause));
        } finally {
            setCompiling(false);
        }
    };

    const handleEditorChange = (text: string) => {
        setDirty(text !== savedText);
    };

    onMount(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey)) {
                return;
            }

            switch (event.key.toLowerCase()) {
                case "enter":
                    event.preventDefault();
                    void compile();
                    break;
                case "s":
                    event.preventDefault();
                    void save();
                    break;
                case "o":
                    event.preventDefault();
                    void openFolder();
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        const handleWindowBlur = () => saveIfDirty();
        window.addEventListener("blur", handleWindowBlur);

        onCleanup(() => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("blur", handleWindowBlur);
        });
    });

    onCleanup(() => {
        if (currentPdfUrl) {
            URL.revokeObjectURL(currentPdfUrl);
        }
    });

    return (
        <div class="flex h-screen flex-col overflow-hidden bg-neutral-900 text-neutral-200">
            <main class="flex min-h-0 flex-1">
                <Sidebar
                    workspace={workspace()}
                    entries={workspace()?.entries ?? []}
                    selectedPath={selection()?.path ?? null}
                    dirty={dirty()}
                    error={fileError()}
                    onOpenFolder={() => void openFolder()}
                    onSelectFile={entry => void selectEntry(entry)}
                />

                <section class="relative flex min-w-0 flex-1 flex-col bg-neutral-900">
                    <Show
                        when={isTexSelected()}
                        fallback={
                            <Show
                                when={selection()}
                                fallback={
                                    <EditorEmptyState
                                        hasWorkspace={workspace() !== null}
                                    />
                                }
                            >
                                {entry => <FilePlaceholder entry={entry()} />}
                            </Show>
                        }
                    >
                        <EditorPane
                            file={editorFile()}
                            onChange={handleEditorChange}
                            onSave={() => void save()}
                            onBlur={saveIfDirty}
                            onCompile={() => void compile()}
                            onReady={instance => {
                                editor = instance;
                            }}
                        />
                    </Show>

                    <Show when={loadingFile()}>
                        <div class="absolute inset-0 grid place-items-center bg-neutral-900/70 backdrop-blur-[1px]">
                            <div class="flex items-center gap-3 rounded-md bg-neutral-900/90 px-4 py-3 text-sm text-neutral-200 shadow-xl">
                                <Spinner />
                                Opening file…
                            </div>
                        </div>
                    </Show>
                </section>

                <PaneSeparator
                    ratio={previewRatio()}
                    onChange={setPreviewRatio}
                />

                <section
                    class="flex min-w-0 flex-col bg-neutral-800"
                    style={{width: `${previewRatio() * 100}%`}}
                >
                    <PreviewToolbar
                        canCompile={canCompile()}
                        compiling={compiling()}
                        pageCount={pageCount()}
                        onCompile={() => void compile()}
                    />
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

function EditorEmptyState(props: {hasWorkspace: boolean}) {
    return (
        <div class="grid h-full place-items-center px-6 text-center">
            <div class="max-w-sm">
                <Logo class="mx-auto mb-4 block size-12 rounded-lg" />
                <p class="text-sm font-medium text-neutral-300">
                    {props.hasWorkspace ? "No file selected" : "No folder open"}
                </p>
                <p class="mt-1 text-xs leading-relaxed text-neutral-500">
                    {props.hasWorkspace
                        ? "Choose a .tex file from the sidebar to start editing."
                        : "Open a folder to browse your LaTeX project."}
                </p>
            </div>
        </div>
    );
}
