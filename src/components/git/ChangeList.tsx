import {Button} from "@kobalte/core/button";
import {For, Show} from "solid-js";

import type {GitChange} from "../../lib/git";
import {badgeLabel, statusColor} from "../../lib/gitStatus";
import {fileName, parentPath} from "../../lib/paths";

interface ChangeListProps {
    unstaged: GitChange[];
    staged: GitChange[];
    onOpen: (path: string) => void;
}

/**
 * Changed files grouped by staging state.
 */
export function ChangeList(props: ChangeListProps) {
    const hasChanges = () => props.unstaged.length + props.staged.length > 0;

    return (
        <Show
            when={hasChanges()}
            fallback={
                <p class="px-3 py-4 text-xs leading-relaxed text-surface-500">
                    No changes. Working tree is clean.
                </p>
            }
        >
            <ChangeGroup
                title="Changes"
                changes={props.unstaged}
                onOpen={props.onOpen}
            />
            <Show when={props.staged.length > 0}>
                <ChangeGroup
                    title="Staged Changes"
                    changes={props.staged}
                    onOpen={props.onOpen}
                />
            </Show>
        </Show>
    );
}

interface ChangeGroupProps {
    title: string;
    changes: GitChange[];
    onOpen: (path: string) => void;
}

function ChangeGroup(props: ChangeGroupProps) {
    return (
        <div>
            <div class="sticky top-0 z-10 flex h-7 items-center justify-between border-b border-surface-300/60 bg-surface-100 px-2 text-[11px] font-semibold tracking-wide text-surface-500 uppercase">
                <span>{props.title}</span>
                <span>{props.changes.length}</span>
            </div>
            <For each={props.changes}>
                {change => <ChangeRow change={change} onOpen={props.onOpen} />}
            </For>
        </div>
    );
}

interface ChangeRowProps {
    change: GitChange;
    onOpen: (path: string) => void;
}

function ChangeRow(props: ChangeRowProps) {
    const openable = () => props.change.status !== "D";
    const directory = () => parentPath(props.change.path);
    const title = () =>
        props.change.origPath
            ? `${props.change.origPath} → ${props.change.path}`
            : props.change.path;

    return (
        <Button
            class="flex h-7 w-full items-center gap-2 px-2 text-left text-sm transition-colors"
            classList={{
                "hover:bg-surface-200": openable(),
                "cursor-default": !openable(),
            }}
            disabled={!openable()}
            title={title()}
            onClick={() => {
                if (openable()) {
                    props.onOpen(props.change.path);
                }
            }}
        >
            <span class="w-4 shrink-0 text-center font-mono text-xs font-bold">
                <span class={statusColor(props.change.status)}>
                    {badgeLabel(props.change.status)}
                </span>
            </span>
            <span class="min-w-0 flex-1 truncate text-surface-800">
                {fileName(props.change.path)}
            </span>
            <Show when={directory()}>
                {parent => (
                    <span class="max-w-[45%] shrink-0 truncate text-xs text-surface-500">
                        {parent()}
                    </span>
                )}
            </Show>
        </Button>
    );
}
