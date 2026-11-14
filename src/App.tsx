import {join} from "@tauri-apps/api/path";
import type * as monaco from "monaco-editor/editor";
import {Show, createSignal, onCleanup, onMount} from "solid-js";

import {EditorPane, type EditorFile} from "./components/EditorPane";
import {ErrorPanel} from "./components/ErrorPanel";
import {FilePlaceholder} from "./components/FilePlaceholder";
import {Logo} from "./components/Logo";
import {PaneSeparator} from "./components/PaneSeparator";
import {PdfPreview, type PdfViewerHandle} from "./components/PdfPreview";
import {PreviewToolbar} from "./components/PreviewToolbar";
import {Sidebar} from "./components/Sidebar";
import {Spinner} from "./components/Spinner";
import {compileLatex} from "./lib/compile";
import {exportPdf} from "./lib/export";
import {errorMessage, fileName, isTexFile, isTextFile} from "./lib/files";
import {
    chooseWorkspaceDirectory,
    confirmDiscardChanges,
    listDirectory,
    openWorkspace,
    readFile,
    writeFile,
    type DirEntry,
    type WorkspaceInfo,
} from "./lib/workspace";

export default function App() {
    let editor: monaco.editor.IStandaloneCodeEditor | undefined;
    let currentPdfUrl: string | null = null;
    let previousPdfUrl: string | null = null;
    let pdfBytes: Uint8Array | null = null;
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
    const [pageNumber, setPageNumber] = createSignal(1);
    const [previewRatio, setPreviewRatio] = createSignal(0.5);
    const [zoom, setZoom] = createSignal(1);
    const [scaleValue, setScaleValue] = createSignal("page-width");
    const [viewerHandle, setViewerHandle] =
        createSignal<PdfViewerHandle | null>(null);

    const isEditableSelected = () => {
        const entry = selection();
        return entry !== null && !entry.isDir && isTextFile(entry.path);
    };

    const isTexSelected = () => {
        const entry = selection();
        return entry !== null && !entry.isDir && isTexFile(entry.path);
    };

    const canCompile = () =>
        isTexSelected() && !loadingFile() && editorFile() !== null;

    const replacePdfUrl = (url: string | null) => {
        // The viewer may still lazily fetch pages from the previous document,
        // so keep the immediately previous URL alive until the next compile.
        if (previousPdfUrl) {
            URL.revokeObjectURL(previousPdfUrl);
            previousPdfUrl = null;
        }

        if (!url) {
            if (currentPdfUrl) {
                URL.revokeObjectURL(currentPdfUrl);
                currentPdfUrl = null;
            }
        } else {
            previousPdfUrl = currentPdfUrl;
            currentPdfUrl = url;
        }

        setPdfUrl(url);
    };

    const resetPreview = () => {
        pdfBytes = null;
        replacePdfUrl(null);
        setError(null);
        setPageCount(0);
        setPageNumber(1);
        setZoom(1);
        setScaleValue("page-width");
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

        if (!isTextFile(entry.path)) {
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

    /**
     * Replace the whole editor buffer as a single undoable edit, keeping the
     * caret roughly in place.
     */
    const replaceEditorText = (text: string) => {
        const model = editor?.getModel();
        if (!editor || !model) {
            return;
        }

        const position = editor.getPosition();
        const offset = position ? model.getOffsetAt(position) : 0;

        editor.pushUndoStop();
        editor.executeEdits("tex-fmt", [
            {range: model.getFullModelRange(), text},
        ]);
        editor.pushUndoStop();

        editor.setPosition(
            model.getPositionAt(Math.min(offset, model.getValueLength())),
        );
    };

    const save = async (): Promise<void> => {
        const entry = selection();
        if (
            !editor
            || !entry
            || !isTextFile(entry.path)
            || loadingFile()
            || !editorFile()
        ) {
            return;
        }

        const text = editor.getValue();

        try {
            const saved = await writeFile(entry.path, text);

            if (selection()?.path !== entry.path) {
                return;
            }

            savedText = saved;

            // The backend formats LaTeX before writing. Only mirror that in the
            // editor when the buffer has not changed during the save.
            if (saved !== text && editor.getValue() === text) {
                replaceEditorText(saved);
            }

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

    /**
     * Save pending editor changes before a Git operation touches the working
     * tree. Returns false when the save failed.
     */
    const prepareGitAction = async (): Promise<boolean> => {
        saveIfDirty();

        if (pendingSave) {
            await pendingSave;
        }

        return !dirty();
    };

    const openGitFile = (path: string) => {
        void selectEntry({name: fileName(path), path, isDir: false});
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

            pdfBytes = bytes;
            replacePdfUrl(URL.createObjectURL(blob));
        } catch (cause) {
            setError(errorMessage(cause));
        } finally {
            setCompiling(false);
        }
    };

    const handleScaleChange = (scale: number, value: string) => {
        setZoom(scale);
        setScaleValue(value);
    };

    const exportCurrentPdf = async () => {
        const workspaceInfo = workspace();
        if (!pdfBytes || !workspaceInfo) {
            return;
        }

        const entry = selection();
        const relativePdf = entry
            ? entry.path.replace(/\.(tex|latex)$/i, ".pdf")
            : "document.pdf";

        try {
            const destination = await exportPdf(
                await join(workspaceInfo.root, relativePdf),
                pdfBytes,
            );

            if (destination) {
                setFileError(null);
            }
        } catch (cause) {
            setFileError(errorMessage(cause));
        }
    };

    const handleEditorChange = (text: string) => {
        setDirty(text !== savedText);
    };

    const refreshRootEntries = async () => {
        if (!workspace()) {
            return;
        }

        const entries = await listDirectory("");
        setWorkspace(current => (current ? {...current, entries} : current));
    };

    const handleRenamed = (oldPath: string, newPath: string) => {
        setSelection(current =>
            current?.path === oldPath
                ? {...current, path: newPath, name: fileName(newPath)}
                : current,
        );
    };

    const handleDeleted = (path: string) => {
        const selected = selection();
        if (
            selected
            && (selected.path === path || selected.path.startsWith(`${path}/`))
        ) {
            clearCurrentFile();
        }
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
        if (previousPdfUrl) {
            URL.revokeObjectURL(previousPdfUrl);
            previousPdfUrl = null;
        }

        if (currentPdfUrl) {
            URL.revokeObjectURL(currentPdfUrl);
            currentPdfUrl = null;
        }
    });

    return (
        <div class="flex h-screen flex-col overflow-hidden bg-surface-100 text-surface-800">
            <main class="flex min-h-0 flex-1">
                <Sidebar
                    workspace={workspace()}
                    entries={workspace()?.entries ?? []}
                    selectedPath={selection()?.path ?? null}
                    dirty={dirty()}
                    error={fileError()}
                    onOpenFolder={() => void openFolder()}
                    onSelectFile={entry => void selectEntry(entry)}
                    onRefreshRoot={refreshRootEntries}
                    onRenamed={handleRenamed}
                    onDeleted={handleDeleted}
                    onGitOpenFile={openGitFile}
                    onBeforeGitAction={prepareGitAction}
                />

                <section class="relative flex min-w-0 flex-1 flex-col bg-surface-100">
                    <Show
                        when={isEditableSelected()}
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
                        <div class="absolute inset-0 grid place-items-center bg-surface-100/70 backdrop-blur-[1px]">
                            <div class="flex items-center gap-3 rounded-md bg-surface-100/90 px-4 py-3 text-sm text-surface-800 shadow-xl">
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
                    class="flex min-w-0 flex-col bg-surface-200"
                    style={{width: `${previewRatio() * 100}%`}}
                >
                    <PreviewToolbar
                        canCompile={canCompile()}
                        compiling={compiling()}
                        pageNumber={pageNumber()}
                        pageCount={pageCount()}
                        zoom={zoom()}
                        scaleValue={scaleValue()}
                        onZoomIn={() => viewerHandle()?.zoomIn()}
                        onZoomOut={() => viewerHandle()?.zoomOut()}
                        onScaleChange={value =>
                            viewerHandle()?.setScaleValue(value)
                        }
                        onPreviousPage={() => viewerHandle()?.previousPage()}
                        onNextPage={() => viewerHandle()?.nextPage()}
                        onCompile={() => void compile()}
                        onExport={() => void exportCurrentPdf()}
                    />
                    <PdfPreview
                        url={pdfUrl()}
                        onReady={handle => setViewerHandle(handle)}
                        onScaleChange={handleScaleChange}
                        onPageChange={setPageNumber}
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
                <p class="text-sm font-medium text-surface-700">
                    {props.hasWorkspace ? "No file selected" : "No folder open"}
                </p>
                <p class="mt-1 text-xs leading-relaxed text-surface-500">
                    {props.hasWorkspace
                        ? "Choose a text file from the sidebar to start editing."
                        : "Open a folder to browse your LaTeX project."}
                </p>
            </div>
        </div>
    );
}
