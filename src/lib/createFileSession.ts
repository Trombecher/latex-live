import type * as monaco from "monaco-editor/editor";
import {createSignal} from "solid-js";

import {errorMessage} from "./errors";
import {isTextFile} from "./fileKinds";
import {fileName} from "./paths";
import {
    confirmDiscardChanges,
    readFile,
    writeFile,
    type DirEntry,
} from "./workspace";

/**
 * The text and workspace-relative path of the file shown in the editor.
 */
export interface EditorFile {
    path: string;
    text: string;
}

interface FileSessionOptions {
    editor: () => monaco.editor.IStandaloneCodeEditor | undefined;
    /**
     * Called whenever the open document is replaced or closed, so the preview
     * can drop the PDF belonging to the previous document.
     */
    onPreviewReset: () => void;
}

/**
 * The open file, its unsaved state and the actions that load, save and discard
 * it.
 */
export function createFileSession(options: FileSessionOptions) {
    const [selection, setSelection] = createSignal<DirEntry | null>(null);
    const [editorFile, setEditorFile] = createSignal<EditorFile | null>(null);
    const [dirty, setDirty] = createSignal(false);
    const [loadingFile, setLoadingFile] = createSignal(false);
    const [fileError, setFileError] = createSignal<string | null>(null);

    let savedText = "";
    let readGeneration = 0;
    let pendingSave: Promise<void> | null = null;

    const clearCurrentFile = () => {
        readGeneration += 1;
        setSelection(null);
        setEditorFile(null);
        savedText = "";
        setDirty(false);
        setLoadingFile(false);
        options.onPreviewReset();
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
            options.onPreviewReset();
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
            options.onPreviewReset();
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

    /**
     * Replace the whole editor buffer as a single undoable edit, keeping the
     * caret roughly in place.
     */
    const replaceEditorText = (text: string) => {
        const editor = options.editor();
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
        const editor = options.editor();
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

    const handleEditorChange = (text: string) => {
        setDirty(text !== savedText);
    };

    const renameSelection = (oldPath: string, newPath: string) => {
        setSelection(current =>
            current?.path === oldPath
                ? {...current, path: newPath, name: fileName(newPath)}
                : current,
        );
    };

    return {
        selection,
        editorFile,
        dirty,
        loadingFile,
        fileError,
        setFileError,
        savedText: () => savedText,
        selectEntry,
        save,
        saveIfDirty,
        confirmDiscard,
        prepareGitAction,
        clearCurrentFile,
        handleEditorChange,
        renameSelection,
    };
}
