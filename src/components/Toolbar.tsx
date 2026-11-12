import {Show} from "solid-js";

import {Logo} from "./Logo";
import {Spinner} from "./PdfPreview";

interface ToolbarProps {
    workspaceName: string | null;
    compiling: boolean;
    durationMs: number | null;
    pageCount: number;
    error: string | null;
    dirty: boolean;
    canSave: boolean;
    canCompile: boolean;
    onOpenFolder: () => void;
    onSave: () => void;
    onCompile: () => void;
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

            <Show when={props.workspaceName}>
                <span
                    class="hidden max-w-40 truncate rounded bg-neutral-800 px-2 py-1 text-[11px] text-neutral-400 sm:inline"
                    title={props.workspaceName ?? undefined}
                >
                    {props.workspaceName}
                </span>
            </Show>

            <div class="mx-1 h-6 w-px bg-neutral-700" />

            <button
                type="button"
                class="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-neutral-700 bg-neutral-800 px-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-700"
                onClick={props.onOpenFolder}
            >
                <FolderIcon />
                Open Folder
            </button>

            <button
                type="button"
                class="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-neutral-700 bg-neutral-800 px-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!props.canSave}
                onClick={props.onSave}
            >
                Save
            </button>

            <button
                type="button"
                class="inline-flex h-8 shrink-0 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-900 disabled:text-blue-200"
                disabled={props.compiling || !props.canCompile}
                onClick={props.onCompile}
            >
                <Show when={props.compiling} fallback={<PlayIcon />}>
                    <Spinner />
                </Show>
                {props.compiling ? "Compiling…" : "Compile"}
            </button>

            <kbd class="hidden shrink-0 rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400 lg:inline">
                Ctrl/Cmd + Enter
            </kbd>

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
                            <Show when={props.workspaceName} fallback="Ready">
                                Select a .tex file to compile
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

function FolderIcon() {
    return (
        <svg
            viewBox="0 0 16 16"
            class="-ml-0.5 size-3.5"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M1.5 3.25c0-.69.56-1.25 1.25-1.25h3.2c.33 0 .65.13.88.37l.96.96c.1.1.23.17.37.17h5.09c.69 0 1.25.56 1.25 1.25v7.75c0 .69-.56 1.25-1.25 1.25H2.75c-.69 0-1.25-.56-1.25-1.25V3.25Z" />
        </svg>
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
