import {ContextMenu} from "@kobalte/core/context-menu";
import FilePlusIcon from "lucide-solid/icons/file-plus";
import FolderPlusIcon from "lucide-solid/icons/folder-plus";
import PencilIcon from "lucide-solid/icons/pencil";
import TrashIcon from "lucide-solid/icons/trash";
import {Show} from "solid-js";

interface FileContextMenuProps {
    hasEntry: boolean;
    isDirectory: boolean;
    onNewFile: () => void;
    onNewFolder: () => void;
    onRename: () => void;
    onMoveToTrash: () => void;
}

/**
 * Context menu of the file tree, shown above the entry (or empty area) that was
 * right-clicked.
 */
export function FileContextMenu(props: FileContextMenuProps) {
    return (
        <ContextMenu.Portal>
            <ContextMenu.Content class="z-50 min-w-44 rounded-xl border border-surface-300 bg-surface-200 p-1 text-sm shadow-xl outline-none">
                <ContextMenu.Item
                    class="flex h-8 cursor-default items-center gap-2 rounded-lg px-2 text-surface-800 outline-none data-highlighted:bg-surface-300"
                    onSelect={props.onNewFile}
                >
                    <FilePlusIcon
                        class="size-4 shrink-0 text-surface-600"
                        aria-hidden="true"
                    />
                    <ContextMenu.ItemLabel>New File</ContextMenu.ItemLabel>
                </ContextMenu.Item>

                <ContextMenu.Item
                    class="flex h-8 cursor-default items-center gap-2 rounded-lg px-2 text-surface-800 outline-none data-highlighted:bg-surface-300"
                    onSelect={props.onNewFolder}
                >
                    <FolderPlusIcon
                        class="size-4 shrink-0 text-surface-600"
                        aria-hidden="true"
                    />
                    <ContextMenu.ItemLabel>New Folder</ContextMenu.ItemLabel>
                </ContextMenu.Item>

                <Show when={props.hasEntry}>
                    <ContextMenu.Separator class="my-1 h-px border-0 bg-surface-300" />

                    <Show when={!props.isDirectory}>
                        <ContextMenu.Item
                            class="flex h-8 cursor-default items-center gap-2 rounded-lg px-2 text-surface-800 outline-none data-highlighted:bg-surface-300"
                            onSelect={props.onRename}
                        >
                            <PencilIcon
                                class="size-4 shrink-0 text-surface-600"
                                aria-hidden="true"
                            />
                            <ContextMenu.ItemLabel>
                                Rename
                            </ContextMenu.ItemLabel>
                        </ContextMenu.Item>
                    </Show>

                    <ContextMenu.Item
                        class="flex h-8 cursor-default items-center gap-2 rounded-lg px-2 text-danger-text outline-none data-highlighted:bg-danger-surface/60"
                        onSelect={props.onMoveToTrash}
                    >
                        <TrashIcon class="size-4 shrink-0" aria-hidden="true" />
                        <ContextMenu.ItemLabel>
                            Move to Trash
                        </ContextMenu.ItemLabel>
                    </ContextMenu.Item>
                </Show>
            </ContextMenu.Content>
        </ContextMenu.Portal>
    );
}
