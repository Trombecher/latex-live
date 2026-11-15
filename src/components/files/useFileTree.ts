import {createEffect, createMemo, createSignal, on} from "solid-js";

import {errorMessage} from "../../lib/errors";
import {listDirectory, type DirEntry} from "../../lib/workspace";

export interface TreeRowData {
    entry: DirEntry;
    depth: number;
}

interface FileTreeOptions {
    entries: DirEntry[];
    workspaceRoot: string | null;
    onSelect: (entry: DirEntry) => void;
    onRefreshRoot: () => Promise<void>;
    onError: (message: string | null) => void;
}

/**
 * Expansion and lazy directory loading behind the file tree.
 */
export function useFileTree(props: FileTreeOptions) {
    const [children, setChildren] = createSignal<Record<string, DirEntry[]>>(
        {},
    );
    const [expanded, setExpanded] = createSignal<Record<string, boolean>>({});
    const [loading, setLoading] = createSignal<Record<string, boolean>>({});

    createEffect(
        on(
            () => props.workspaceRoot,
            () => {
                setChildren({});
                setExpanded({});
                setLoading({});
            },
        ),
    );

    const rows = createMemo(() => {
        const result: TreeRowData[] = [];
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

    return {
        rows,
        expanded,
        loading,
        activate,
        refreshDirectory,
        setChildren,
        setExpanded,
        setLoading,
    };
}

export type FileTreeState = ReturnType<typeof useFileTree>;
