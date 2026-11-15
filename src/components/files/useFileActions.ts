import {createEffect, createSignal, on} from "solid-js";

import {errorMessage} from "../../lib/errors";
import {parentPath} from "../../lib/paths";
import {
    confirmTrashEntry,
    createFile,
    createFolder,
    renameFile,
    trashEntry,
    type DirEntry,
} from "../../lib/workspace";
import type {FileTreeState} from "./useFileTree";

type NameDialogState =
    | {kind: "create-file"; directory: string}
    | {kind: "create-folder"; directory: string}
    | {kind: "rename"; entry: DirEntry};

interface FileActionsOptions {
    workspaceRoot: string | null;
    selectedPath: string | null;
    dirty: boolean;
    onRenamed: (oldPath: string, newPath: string) => void;
    onDeleted: (path: string) => void;
    onError: (message: string | null) => void;
}

/**
 * Context menu and name dialog actions of the file tree.
 *
 * The hooks share the tree state so created, renamed and trashed entries can
 * refresh the affected directory and drop cached subtrees.
 */
export function useFileActions(props: FileActionsOptions, tree: FileTreeState) {
    const [contextEntry, setContextEntry] = createSignal<DirEntry | null>(null);
    const [dialog, setDialog] = createSignal<NameDialogState | null>(null);
    const [dialogError, setDialogError] = createSignal<string | null>(null);
    const [busy, setBusy] = createSignal(false);

    createEffect(
        on(
            () => props.workspaceRoot,
            () => {
                setContextEntry(null);
                setDialog(null);
                props.onError(null);
            },
        ),
    );

    /**
     * The directory a "New File" or "New Folder" action should create into.
     */
    const contextDirectory = () => {
        const entry = contextEntry();
        if (!entry) {
            return "";
        }

        return entry.isDir ? entry.path : parentPath(entry.path);
    };

    const startCreateFile = () => {
        setDialogError(null);
        setDialog({kind: "create-file", directory: contextDirectory()});
    };

    const startCreateFolder = () => {
        setDialogError(null);
        setDialog({kind: "create-folder", directory: contextDirectory()});
    };

    const startRename = () => {
        const entry = contextEntry();
        if (!entry || entry.isDir) {
            return;
        }

        setDialogError(null);
        setDialog({kind: "rename", entry});
    };

    const submitName = async (name: string) => {
        const state = dialog();
        if (!state || busy()) {
            return;
        }

        setBusy(true);
        setDialogError(null);
        props.onError(null);

        try {
            if (state.kind === "rename") {
                const newPath = await renameFile(state.entry.path, name);

                await tree.refreshDirectory(parentPath(state.entry.path));
                props.onRenamed(state.entry.path, newPath);
            } else {
                if (state.kind === "create-folder") {
                    await createFolder(state.directory, name);
                } else {
                    await createFile(state.directory, name);
                }

                if (state.directory) {
                    tree.setExpanded(previous => ({
                        ...previous,
                        [state.directory]: true,
                    }));
                }

                await tree.refreshDirectory(state.directory);
            }

            setDialog(null);
        } catch (cause) {
            setDialogError(errorMessage(cause));
        } finally {
            setBusy(false);
        }
    };

    /**
     * Whether the selected file is the entry itself or lives inside it.
     */
    const selectionInside = (entry: DirEntry) => {
        const selected = props.selectedPath;
        if (selected === null) {
            return false;
        }

        return (
            selected === entry.path
            || (entry.isDir && selected.startsWith(`${entry.path}/`))
        );
    };

    /**
     * Drop cached children, expansion and loading state of a removed folder.
     */
    const forgetSubtree = (path: string) => {
        const isInside = (key: string) =>
            key === path || key.startsWith(`${path}/`);

        const without = <T>(record: Record<string, T>) =>
            Object.fromEntries(
                Object.entries(record).filter(([key]) => !isInside(key)),
            );

        tree.setChildren(previous => without(previous));
        tree.setExpanded(previous => without(previous));
        tree.setLoading(previous => without(previous));
    };

    const moveToTrash = async () => {
        const entry = contextEntry();
        if (!entry) {
            return;
        }

        const hasUnsavedChanges = selectionInside(entry) && props.dirty;

        if (
            !(await confirmTrashEntry(
                entry.name,
                entry.isDir,
                hasUnsavedChanges,
            ))
        ) {
            return;
        }

        try {
            props.onError(null);
            await trashEntry(entry.path);
            props.onDeleted(entry.path);

            if (entry.isDir) {
                forgetSubtree(entry.path);
            }

            await tree.refreshDirectory(parentPath(entry.path));
        } catch (cause) {
            props.onError(errorMessage(cause));
        }
    };

    const dialogTitle = () => {
        const state = dialog();
        if (state?.kind === "create-folder") {
            return "New folder";
        }

        return state?.kind === "rename" ? "Rename file" : "New text file";
    };

    const dialogDescription = () => {
        const state = dialog();
        if (state?.kind === "rename") {
            return `Enter a new name for ${state.entry.name}.`;
        }

        const directory = state?.directory ?? "";
        const entryType = state?.kind === "create-folder" ? "folder" : "file";

        return directory
            ? `The ${entryType} will be created in the folder ${directory}.`
            : `The ${entryType} will be created in the project root.`;
    };

    const dialogFieldLabel = () =>
        dialog()?.kind === "create-folder" ? "Folder name" : "File name";

    const dialogInitialName = () => {
        const state = dialog();
        if (state?.kind === "rename") {
            return state.entry.name;
        }

        return state?.kind === "create-folder" ? "new-folder" : "untitled.tex";
    };

    const dialogConfirmLabel = () =>
        dialog()?.kind === "rename" ? "Rename" : "Create";

    const closeDialog = () => {
        if (!busy()) {
            setDialog(null);
        }
    };

    return {
        contextEntry,
        setContextEntry,
        busy,
        dialogOpen: () => dialog() !== null,
        dialogError,
        dialogTitle,
        dialogDescription,
        dialogFieldLabel,
        dialogInitialName,
        dialogConfirmLabel,
        closeDialog,
        startCreateFile,
        startCreateFolder,
        startRename,
        submitName,
        moveToTrash,
    };
}
