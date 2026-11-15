import type * as monaco from "monaco-editor/editor";
import {createSignal, onCleanup, onMount} from "solid-js";

import {EditorArea} from "./components/EditorArea";
import {PreviewPane} from "./components/PreviewPane";
import {Sidebar} from "./components/Sidebar";
import {createCompiler} from "./lib/createCompiler";
import {createFileSession} from "./lib/createFileSession";
import {createPdfUrl} from "./lib/createPdfUrl";
import {errorMessage} from "./lib/errors";
import {isTexFile} from "./lib/fileKinds";
import {fileName} from "./lib/paths";
import {
    chooseWorkspaceDirectory,
    listDirectory,
    openWorkspace,
    type WorkspaceInfo,
} from "./lib/workspace";

export default function App() {
    let editor: monaco.editor.IStandaloneCodeEditor | undefined;

    const [workspace, setWorkspace] = createSignal<WorkspaceInfo | null>(null);

    const pdfUrl = createPdfUrl();

    const fileSession = createFileSession({
        editor: () => editor,
        onPreviewReset: () => compiler.reset(),
    });

    const isTexSelected = () => {
        const entry = fileSession.selection();
        return entry !== null && !entry.isDir && isTexFile(entry.path);
    };

    const canCompile = () =>
        isTexSelected()
        && !fileSession.loadingFile()
        && fileSession.editorFile() !== null;

    const compiler = createCompiler({
        editor: () => editor,
        path: () => fileSession.selection()?.path ?? null,
        workspaceRoot: () => workspace()?.root ?? null,
        canCompile,
        replacePdfUrl: pdfUrl.replace,
        setFileError: fileSession.setFileError,
    });

    const openFolder = async () => {
        if (!(await fileSession.confirmDiscard())) {
            return;
        }

        try {
            const path = await chooseWorkspaceDirectory();
            if (!path) {
                return;
            }

            const info = await openWorkspace(path);

            fileSession.clearCurrentFile();
            fileSession.setFileError(null);
            setWorkspace(info);

            const main = info.entries.find(
                entry =>
                    !entry.isDir && entry.name.toLowerCase() === "main.tex",
            );

            if (main) {
                await fileSession.selectEntry(main);
            }
        } catch (cause) {
            fileSession.setFileError(errorMessage(cause));
        }
    };

    const openGitFile = (path: string) => {
        void fileSession.selectEntry({
            name: fileName(path),
            path,
            isDir: false,
        });
    };

    const refreshRootEntries = async () => {
        if (!workspace()) {
            return;
        }

        const entries = await listDirectory("");
        setWorkspace(current => (current ? {...current, entries} : current));
    };

    const handleDeleted = (path: string) => {
        const selected = fileSession.selection();
        if (
            selected
            && (selected.path === path || selected.path.startsWith(`${path}/`))
        ) {
            fileSession.clearCurrentFile();
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
                    void compiler.compile();
                    break;
                case "s":
                    event.preventDefault();
                    void fileSession.save();
                    break;
                case "o":
                    event.preventDefault();
                    void openFolder();
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        const handleWindowBlur = () => fileSession.saveIfDirty();
        window.addEventListener("blur", handleWindowBlur);

        onCleanup(() => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("blur", handleWindowBlur);
        });
    });

    return (
        <div class="flex h-screen flex-col overflow-hidden bg-surface-100 text-surface-800">
            <main class="flex min-h-0 flex-1">
                <Sidebar
                    workspace={workspace()}
                    entries={workspace()?.entries ?? []}
                    selectedPath={fileSession.selection()?.path ?? null}
                    dirty={fileSession.dirty()}
                    error={fileSession.fileError()}
                    onOpenFolder={() => void openFolder()}
                    onSelectFile={entry => void fileSession.selectEntry(entry)}
                    onRefreshRoot={refreshRootEntries}
                    onRenamed={fileSession.renameSelection}
                    onDeleted={handleDeleted}
                    onGitOpenFile={openGitFile}
                    onBeforeGitAction={fileSession.prepareGitAction}
                />

                <EditorArea
                    hasWorkspace={workspace() !== null}
                    selection={fileSession.selection()}
                    file={fileSession.editorFile()}
                    diagnostics={compiler.diagnostics()}
                    loadingFile={fileSession.loadingFile()}
                    onChange={fileSession.handleEditorChange}
                    onSave={() => void fileSession.save()}
                    onBlur={fileSession.saveIfDirty}
                    onCompile={() => void compiler.compile()}
                    onReady={instance => {
                        editor = instance;
                    }}
                />

                <PreviewPane
                    pdfUrl={pdfUrl.url()}
                    compiling={compiler.compiling()}
                    canCompile={canCompile()}
                    error={compiler.error()}
                    onCompile={() => void compiler.compile()}
                    onExport={() => void compiler.exportCurrentPdf()}
                />
            </main>
        </div>
    );
}
