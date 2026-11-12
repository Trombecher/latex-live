import {For, Show, createEffect, createMemo, createSignal, on} from "solid-js";

import {errorMessage, isTexFile} from "../lib/files";
import {listDirectory, type DirEntry} from "../lib/workspace";

interface FileTreeProps {
    entries: DirEntry[];
    workspaceRoot: string | null;
    selectedPath: string | null;
    dirty: boolean;
    onSelect: (entry: DirEntry) => void;
    onError: (message: string | null) => void;
}

interface TreeRow {
    entry: DirEntry;
    depth: number;
}

export function FileTree(props: FileTreeProps) {
    const [children, setChildren] = createSignal<Record<string, DirEntry[]>>(
        {},
    );
    const [expanded, setExpanded] = createSignal<Record<string, boolean>>({});
    const [loading, setLoading] = createSignal<Record<string, boolean>>({});

    createEffect(
        on(
            () => [props.workspaceRoot, props.entries] as const,
            () => {
                setChildren({});
                setExpanded({});
                setLoading({});
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

    return (
        <div role="tree" class="py-1">
            <For each={rows()}>
                {row => {
                    const isSelected = () =>
                        !row.entry.isDir
                        && props.selectedPath === row.entry.path;

                    return (
                        <button
                            type="button"
                            role="treeitem"
                            aria-selected={isSelected()}
                            aria-expanded={
                                row.entry.isDir
                                    ? Boolean(expanded()[row.entry.path])
                                    : undefined
                            }
                            class="group flex h-7 w-full items-center gap-1.5 pr-2 text-left text-xs transition-colors"
                            classList={{
                                "bg-blue-600/20 text-neutral-100": isSelected(),
                                "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200":
                                    !isSelected(),
                            }}
                            style={{"padding-left": `${6 + row.depth * 14}px`}}
                            onClick={() => activate(row.entry)}
                        >
                            <Show
                                when={row.entry.isDir}
                                fallback={<span class="size-3.5 shrink-0" />}
                            >
                                <ChevronIcon
                                    open={Boolean(expanded()[row.entry.path])}
                                />
                            </Show>

                            <EntryIcon entry={row.entry} />

                            <span class="min-w-0 flex-1 truncate">
                                {row.entry.name}
                            </span>

                            <Show when={loading()[row.entry.path]}>
                                <span class="size-3 shrink-0 animate-spin rounded-full border border-neutral-500 border-t-neutral-200" />
                            </Show>

                            <Show when={isSelected() && props.dirty}>
                                <span
                                    class="size-1.5 shrink-0 rounded-full bg-amber-400"
                                    title="Unsaved changes"
                                />
                            </Show>
                        </button>
                    );
                }}
            </For>
        </div>
    );
}

function EntryIcon(props: {entry: DirEntry}) {
    if (props.entry.isDir) {
        return (
            <svg
                viewBox="0 0 16 16"
                class="size-3.5 shrink-0 text-neutral-500"
                fill="currentColor"
                aria-hidden="true"
            >
                <path d="M1.5 3.25c0-.69.56-1.25 1.25-1.25h3.2c.33 0 .65.13.88.37l.96.96c.1.1.23.17.37.17h5.09c.69 0 1.25.56 1.25 1.25v7.75c0 .69-.56 1.25-1.25 1.25H2.75c-.69 0-1.25-.56-1.25-1.25V3.25Z" />
            </svg>
        );
    }

    if (isTexFile(props.entry.path)) {
        return (
            <span class="grid size-3.5 shrink-0 place-items-center rounded-[2px] bg-red-600/80 text-[6px] font-bold text-white">
                T
            </span>
        );
    }

    return (
        <svg
            viewBox="0 0 16 16"
            class="size-3.5 shrink-0 text-neutral-500"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M4 1.75C4 1.34 4.34 1 4.75 1h4.19c.2 0 .39.08.53.22l3.31 3.31c.14.14.22.33.22.53v9.19c0 .41-.34.75-.75.75h-7.5a.75.75 0 0 1-.75-.75V1.75Z" />
        </svg>
    );
}

function ChevronIcon(props: {open: boolean}) {
    return (
        <svg
            viewBox="0 0 16 16"
            class="size-3.5 shrink-0 text-neutral-500 transition-transform"
            classList={{"rotate-90": props.open}}
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M6 3.5 10.5 8 6 12.5V3.5Z" />
        </svg>
    );
}
