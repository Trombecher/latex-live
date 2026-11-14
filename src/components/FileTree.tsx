import {Button} from "@kobalte/core/button";
import {ContextMenu} from "@kobalte/core/context-menu";
import ChevronRightIcon from "lucide-solid/icons/chevron-right";
import FileIcon from "lucide-solid/icons/file";
import FilePlusIcon from "lucide-solid/icons/file-plus";
import FolderIcon from "lucide-solid/icons/folder";
import FolderPlusIcon from "lucide-solid/icons/folder-plus";
import PencilIcon from "lucide-solid/icons/pencil";
import TrashIcon from "lucide-solid/icons/trash";
import {For, Show, createEffect, createMemo, createSignal, on} from "solid-js";

import {errorMessage, isTexFile} from "../lib/files";
import {
    confirmTrashFile,
    createFile,
    createFolder,
    listDirectory,
    renameFile,
    trashFile,
    type DirEntry,
} from "../lib/workspace";
import {NameDialog} from "./NameDialog";

interface FileTreeProps {
    entries: DirEntry[];
    workspaceRoot: string | null;
    selectedPath: string | null;
    dirty: boolean;
    onSelect: (entry: DirEntry) => void;
    onRefreshRoot: () => Promise<void>;
    onRenamed: (oldPath: string, newPath: string) => void;
    onDeleted: (path: string) => void;
    onError: (message: string | null) => void;
}

interface TreeRow {
    entry: DirEntry;
    depth: number;
}

type NameDialogState =
    | {kind: "create-file"; directory: string}
    | {kind: "create-folder"; directory: string}
    | {kind: "rename"; entry: DirEntry};

/**
 * The containing directory of a relative path, or "" for the root.
 */
function parentPath(path: string): string {
    const slash = path.lastIndexOf("/");
    return slash === -1 ? "" : path.slice(0, slash);
}

export function FileTree(props: FileTreeProps) {
    const [children, setChildren] = createSignal<Record<string, DirEntry[]>>(
        {},
    );
    const [expanded, setExpanded] = createSignal<Record<string, boolean>>({});
    const [loading, setLoading] = createSignal<Record<string, boolean>>({});

    const [contextEntry, setContextEntry] = createSignal<DirEntry | null>(null);
    const [dialog, setDialog] = createSignal<NameDialogState | null>(null);
    const [dialogError, setDialogError] = createSignal<string | null>(null);
    const [busy, setBusy] = createSignal(false);

    createEffect(
        on(
            () => props.workspaceRoot,
            () => {
                setChildren({});
                setExpanded({});
                setLoading({});
                setContextEntry(null);
                setDialog(null);
                props.onError(null);
            },
        ),
    );

    const rows = createMemo(() => {
        const result: TreeRow[] = [];
        const currentChildren = children();
        const currentExpanded = expanded();

        const walk = (list: DirEntry[], depth: number) => {
            for (const entry of list) {
                result.push({entry, depth});

                if (entry.isDir && currentExpanded[entry.path]) {
                    const nested = currentChildren[entry.path];
                    if (nested) {
                        walk(nested, depth + 1);
                    }
                }
            }
        };

        walk(props.entries, 0);
        return result;
    });

    const toggle = async (entry: DirEntry) => {
        const isOpen = Boolean(expanded()[entry.path]);
        setExpanded(previous => ({...previous, [entry.path]: !isOpen}));

        if (isOpen || children()[entry.path]) {
            return;
        }

        setLoading(previous => ({...previous, [entry.path]: true}));

        try {
            const nested = await listDirectory(entry.path);
            setChildren(previous => ({...previous, [entry.path]: nested}));
            props.onError(null);
        } catch (cause) {
            setExpanded(previous => ({...previous, [entry.path]: false}));
            props.onError(errorMessage(cause));
        } finally {
            setLoading(previous => ({...previous, [entry.path]: false}));
        }
    };

    const activate = (entry: DirEntry) => {
        if (entry.isDir) {
            void toggle(entry);
        } else {
            props.onSelect(entry);
        }
    };

    /**
     * Reload the entries of a directory, or the workspace root when the path is
     * empty.
     */
    const refreshDirectory = async (directory: string) => {
        try {
            if (directory === "") {
                await props.onRefreshRoot();
                return;
            }

            const nested = await listDirectory(directory);
            setChildren(previous => ({...previous, [directory]: nested}));
        } catch (cause) {
            props.onError(errorMessage(cause));
        }
    };

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

                await refreshDirectory(parentPath(state.entry.path));
                props.onRenamed(state.entry.path, newPath);
            } else {
                if (state.kind === "create-folder") {
                    await createFolder(state.directory, name);
                } else {
                    await createFile(state.directory, name);
                }

                if (state.directory) {
                    setExpanded(previous => ({
                        ...previous,
                        [state.directory]: true,
                    }));
                }

                await refreshDirectory(state.directory);
            }

            setDialog(null);
        } catch (cause) {
            setDialogError(errorMessage(cause));
        } finally {
            setBusy(false);
        }
    };

    const trashEntry = async () => {
        const entry = contextEntry();
        if (!entry || entry.isDir) {
            return;
        }

        const hasUnsavedChanges =
            props.selectedPath === entry.path && props.dirty;

        if (!(await confirmTrashFile(entry.name, hasUnsavedChanges))) {
            return;
        }

        try {
            props.onError(null);
            await trashFile(entry.path);
            props.onDeleted(entry.path);
            await refreshDirectory(parentPath(entry.path));
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

    return (
        <ContextMenu>
            <ContextMenu.Trigger
                role="tree"
                aria-label="Workspace files"
                class="min-h-full py-1"
                onContextMenu={event => {
                    // Only clear for the empty area; row handlers run first.
                    if (event.target === event.currentTarget) {
                        setContextEntry(null);
                    }
                }}
            >
                <For each={rows()}>
                    {row => {
                        const isSelected = () =>
                            !row.entry.isDir
                            && props.selectedPath === row.entry.path;

                        return (
                            <Button
                                role="treeitem"
                                aria-selected={isSelected()}
                                aria-expanded={
                                    row.entry.isDir
                                        ? Boolean(expanded()[row.entry.path])
                                        : undefined
                                }
                                class="group flex h-8 w-full items-center gap-2 pr-2 text-left text-sm transition-colors"
                                classList={{
                                    "bg-blue-600/20 text-surface-900":
                                        isSelected(),
                                    "text-surface-600 hover:bg-surface-200 hover:text-surface-800":
                                        !isSelected(),
                                }}
                                style={{
                                    "padding-left": `${6 + row.depth * 14}px`,
                                }}
                                onClick={() => activate(row.entry)}
                                onContextMenu={() => setContextEntry(row.entry)}
                            >
                                <Show
                                    when={row.entry.isDir}
                                    fallback={<span class="size-4 shrink-0" />}
                                >
                                    <ChevronRightIcon
                                        class="size-4 shrink-0 text-surface-500 transition-transform"
                                        classList={{
                                            "rotate-90": Boolean(
                                                expanded()[row.entry.path],
                                            ),
                                        }}
                                        aria-hidden="true"
                                    />
                                </Show>

                                <EntryIcon entry={row.entry} />

                                <span class="min-w-0 flex-1 truncate">
                                    {row.entry.name}
                                </span>

                                <Show when={loading()[row.entry.path]}>
                                    <span class="size-3 shrink-0 animate-spin rounded-full border border-surface-500 border-t-surface-800" />
                                </Show>

                                <Show when={isSelected() && props.dirty}>
                                    <span
                                        class="size-1.5 shrink-0 rounded-full bg-blue-400"
                                        title="Unsaved changes"
                                    />
                                </Show>
                            </Button>
                        );
                    }}
                </For>
            </ContextMenu.Trigger>

            <ContextMenu.Portal>
                <ContextMenu.Content class="z-50 min-w-44 rounded-xl border border-surface-300 bg-surface-200 p-1 text-sm shadow-xl outline-none">
                    <ContextMenu.Item
                        class="flex h-8 cursor-default items-center gap-2 rounded-lg px-2 text-surface-800 outline-none data-highlighted:bg-surface-300"
                        onSelect={startCreateFile}
                    >
                        <FilePlusIcon
                            class="size-4 shrink-0 text-surface-600"
                            aria-hidden="true"
                        />
                        <ContextMenu.ItemLabel>New File</ContextMenu.ItemLabel>
                    </ContextMenu.Item>

                    <ContextMenu.Item
                        class="flex h-8 cursor-default items-center gap-2 rounded-lg px-2 text-surface-800 outline-none data-highlighted:bg-surface-300"
                        onSelect={startCreateFolder}
                    >
                        <FolderPlusIcon
                            class="size-4 shrink-0 text-surface-600"
                            aria-hidden="true"
                        />
                        <ContextMenu.ItemLabel>
                            New Folder
                        </ContextMenu.ItemLabel>
                    </ContextMenu.Item>

                    <Show when={contextEntry() && !contextEntry()?.isDir}>
                        <ContextMenu.Separator class="my-1 h-px border-0 bg-surface-300" />
                        <ContextMenu.Item
                            class="flex h-8 cursor-default items-center gap-2 rounded-lg px-2 text-surface-800 outline-none data-highlighted:bg-surface-300"
                            onSelect={startRename}
                        >
                            <PencilIcon
                                class="size-4 shrink-0 text-surface-600"
                                aria-hidden="true"
                            />
                            <ContextMenu.ItemLabel>
                                Rename
                            </ContextMenu.ItemLabel>
                        </ContextMenu.Item>
                        <ContextMenu.Item
                            class="flex h-8 cursor-default items-center gap-2 rounded-lg px-2 text-danger-text outline-none data-highlighted:bg-danger-surface/60"
                            onSelect={() => void trashEntry()}
                        >
                            <TrashIcon
                                class="size-4 shrink-0"
                                aria-hidden="true"
                            />
                            <ContextMenu.ItemLabel>
                                Move to Trash
                            </ContextMenu.ItemLabel>
                        </ContextMenu.Item>
                    </Show>
                </ContextMenu.Content>
            </ContextMenu.Portal>

            <NameDialog
                open={dialog() !== null}
                title={dialogTitle()}
                description={dialogDescription()}
                fieldLabel={dialogFieldLabel()}
                initialName={dialogInitialName()}
                confirmLabel={dialog()?.kind === "rename" ? "Rename" : "Create"}
                busy={busy()}
                error={dialogError()}
                onClose={() => {
                    if (!busy()) {
                        setDialog(null);
                    }
                }}
                onSubmit={name => void submitName(name)}
            />
        </ContextMenu>
    );
}

function EntryIcon(props: {entry: DirEntry}) {
    if (props.entry.isDir) {
        return (
            <FolderIcon
                class="size-4 shrink-0 text-surface-500"
                aria-hidden="true"
            />
        );
    }

    if (isTexFile(props.entry.path)) {
        return (
            <span class="grid size-4 shrink-0 place-items-center rounded-xs bg-red-600/80 text-[7px] font-bold text-always-white">
                T
            </span>
        );
    }

    return (
        <FileIcon class="size-4 shrink-0 text-surface-500" aria-hidden="true" />
    );
}
