import {Button} from "@kobalte/core/button";
import ChevronRightIcon from "lucide-solid/icons/chevron-right";
import {Show} from "solid-js";

import type {DirEntry} from "../../lib/workspace";
import {EntryIcon} from "./EntryIcon";
import type {TreeRowData} from "./useFileTree";

interface TreeRowProps {
    row: TreeRowData;
    selected: boolean;
    expanded: boolean;
    loading: boolean;
    dirty: boolean;
    onActivate: () => void;
    onContextMenu: () => void;
}

/**
 * One entry of the file tree, indented by depth.
 */
export function TreeRow(props: TreeRowProps) {
    const entry = (): DirEntry => props.row.entry;

    return (
        <Button
            role="treeitem"
            aria-selected={props.selected}
            aria-expanded={entry().isDir ? props.expanded : undefined}
            class="group flex h-8 w-full items-center gap-2 pr-2 text-left text-sm transition-colors"
            classList={{
                "bg-blue-600/20 text-surface-900": props.selected,
                "text-surface-600 hover:bg-surface-200 hover:text-surface-800":
                    !props.selected,
            }}
            style={{"padding-left": `${6 + props.row.depth * 14}px`}}
            onClick={props.onActivate}
            onContextMenu={props.onContextMenu}
        >
            <Show
                when={entry().isDir}
                fallback={<span class="size-4 shrink-0" />}
            >
                <ChevronRightIcon
                    class="size-4 shrink-0 text-surface-500 transition-transform"
                    classList={{"rotate-90": props.expanded}}
                    aria-hidden="true"
                />
            </Show>

            <EntryIcon entry={entry()} />

            <span class="min-w-0 flex-1 truncate">{entry().name}</span>

            <Show when={props.loading}>
                <span class="size-3 shrink-0 animate-spin rounded-full border border-surface-500 border-t-surface-800" />
            </Show>

            <Show when={props.selected && props.dirty}>
                <span
                    class="size-1.5 shrink-0 rounded-full bg-blue-400"
                    title="Unsaved changes"
                />
            </Show>
        </Button>
    );
}
