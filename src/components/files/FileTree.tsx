import {ContextMenu} from "@kobalte/core/context-menu";
import {For} from "solid-js";

import type {DirEntry} from "../../lib/workspace";
import {NameDialog} from "../NameDialog";
import {FileContextMenu} from "./FileContextMenu";
import {TreeRow} from "./TreeRow";
import {useFileActions} from "./useFileActions";
import {useFileTree} from "./useFileTree";

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

export function FileTree(props: FileTreeProps) {
    const tree = useFileTree(props);
    const actions = useFileActions(props, tree);

    return (
        <ContextMenu>
            <ContextMenu.Trigger
                role="tree"
                aria-label="Workspace files"
                class="min-h-full py-1"
                onContextMenu={event => {
                    // Only clear for the empty area; row handlers run first.
                    if (event.target === event.currentTarget) {
                        actions.setContextEntry(null);
                    }
                }}
            >
                <For each={tree.rows()}>
                    {row => (
                        <TreeRow
                            row={row}
                            selected={
                                !row.entry.isDir
                                && props.selectedPath === row.entry.path
                            }
                            expanded={Boolean(tree.expanded()[row.entry.path])}
                            loading={Boolean(tree.loading()[row.entry.path])}
                            dirty={props.dirty}
                            onActivate={() => tree.activate(row.entry)}
                            onContextMenu={() =>
                                actions.setContextEntry(row.entry)
                            }
                        />
                    )}
                </For>
            </ContextMenu.Trigger>

            <FileContextMenu
                hasEntry={actions.contextEntry() !== null}
                isDirectory={actions.contextEntry()?.isDir === true}
                onNewFile={actions.startCreateFile}
                onNewFolder={actions.startCreateFolder}
                onRename={actions.startRename}
                onMoveToTrash={() => void actions.moveToTrash()}
            />

            <NameDialog
                open={actions.dialogOpen()}
                title={actions.dialogTitle()}
                description={actions.dialogDescription()}
                fieldLabel={actions.dialogFieldLabel()}
                initialName={actions.dialogInitialName()}
                confirmLabel={actions.dialogConfirmLabel()}
                busy={actions.busy()}
                error={actions.dialogError()}
                onClose={actions.closeDialog}
                onSubmit={name => void actions.submitName(name)}
            />
        </ContextMenu>
    );
}
