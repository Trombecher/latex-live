import {Show} from "solid-js";

import {Spinner} from "./PdfPreview";

interface ToolbarProps {
    compiling: boolean;
    durationMs: number | null;
    pageCount: number;
    error: string | null;
    onCompile: () => void;
}

export function Toolbar(props: ToolbarProps) {
    return (
        <header class="flex h-12 shrink-0 items-center gap-3 border-b border-neutral-700 bg-neutral-900 px-3">
            <div class="flex items-center gap-2">
                <span class="grid size-6 place-items-center rounded bg-red-600 text-[10px] font-bold text-white">
                    TeX
                </span>
                <span class="text-sm font-semibold tracking-tight text-neutral-100">
                    latex-live
                </span>
            </div>

            <div class="mx-1 h-6 w-px bg-neutral-700" />

            <button
                type="button"
                class="inline-flex h-8 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-900 disabled:text-blue-200"
                disabled={props.compiling}
                onClick={props.onCompile}
            >
                <Show when={props.compiling} fallback={<PlayIcon />}>
                    <Spinner />
                </Show>
                {props.compiling ? "Compiling…" : "Compile"}
            </button>

            <kbd class="hidden rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400 sm:inline">
                Ctrl/Cmd + Enter
            </kbd>

            <div class="min-w-0 flex-1 truncate text-xs text-neutral-400">
                <Show when={props.compiling}>
                    Working… the first compile may download TeX packages.
                </Show>
                <Show when={!props.compiling && props.error}>
                    <span class="text-red-400">Compilation failed</span>
                </Show>
                <Show
                    when={
                        !props.compiling
                        && !props.error
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
                        && props.durationMs === null
                    }
                >
                    Ready
                </Show>
            </div>

            <Show when={props.pageCount > 0}>
                <span class="rounded bg-neutral-800 px-2 py-1 text-[11px] text-neutral-400">
                    {props.pageCount} {props.pageCount === 1 ? "page" : "pages"}
                </span>
            </Show>
        </header>
    );
}

function PlayIcon() {
    return (
        <svg
            viewBox="0 0 16 16"
            class="size-3.5"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M4.5 2.8v10.4c0 .5.5.8.9.5l8-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5Z" />
        </svg>
    );
}
