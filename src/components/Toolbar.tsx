import {Show} from "solid-js";

import {Logo} from "./Logo";

interface ToolbarProps {
    hasWorkspace: boolean;
    compiling: boolean;
    durationMs: number | null;
    pageCount: number;
    error: string | null;
    dirty: boolean;
    canSave: boolean;
    canCompile: boolean;
    onSave: () => void;
}

export function Toolbar(props: ToolbarProps) {
    return (
        <header class="flex h-12 shrink-0 items-center gap-3 border-b border-neutral-700 bg-neutral-900 px-3">
            <div class="flex shrink-0 items-center gap-2">
                <Logo class="size-6 rounded" />
                <span class="text-sm font-semibold tracking-tight text-neutral-100">
                    latex-live
                </span>
            </div>

            <div class="mx-1 h-6 w-px bg-neutral-700" />

            <button
                type="button"
                class="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-neutral-700 bg-neutral-800 px-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!props.canSave}
                onClick={props.onSave}
            >
                Save
            </button>

            <div class="min-w-0 flex-1 truncate text-xs text-neutral-400">
                <Show when={props.compiling}>
                    Working… the first compile may download TeX packages.
                </Show>
                <Show when={!props.compiling && props.error}>
                    <span class="text-red-400">Compilation failed</span>
                </Show>
                <Show when={!props.compiling && !props.error && props.dirty}>
                    <span class="text-amber-400">Unsaved changes</span>
                </Show>
                <Show
                    when={
                        !props.compiling
                        && !props.error
                        && !props.dirty
                        && props.durationMs !== null
                    }
                >
                    <span class="text-emerald-400">
                        Compiled in {Math.round(props.durationMs ?? 0)} ms
                    </span>
                </Show>
                <Show
                    when={
                        !props.compiling
                        && !props.error
                        && !props.dirty
                        && props.durationMs === null
                    }
                >
                    <Show
                        when={props.canCompile}
                        fallback={
                            <Show
                                when={props.hasWorkspace}
                                fallback="No folder open"
                            >
                                Select a .tex file
                            </Show>
                        }
                    >
                        Ready
                    </Show>
                </Show>
            </div>

            <Show when={props.pageCount > 0}>
                <span class="shrink-0 rounded bg-neutral-800 px-2 py-1 text-[11px] text-neutral-400">
                    {props.pageCount} {props.pageCount === 1 ? "page" : "pages"}
                </span>
            </Show>
        </header>
    );
}
