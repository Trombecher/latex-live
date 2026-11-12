import {Show} from "solid-js";

import {Spinner} from "./PdfPreview";

interface PreviewToolbarProps {
    canCompile: boolean;
    compiling: boolean;
    onCompile: () => void;
}

export function PreviewToolbar(props: PreviewToolbarProps) {
    return (
        <div class="flex h-10 shrink-0 items-center justify-between border-b border-neutral-700 px-3">
            <span class="text-xs font-semibold tracking-wide text-neutral-400 uppercase">
                Preview
            </span>

            <Show when={props.canCompile}>
                <div class="flex items-center gap-2">
                    <kbd class="hidden rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400 md:inline">
                        Ctrl/Cmd + Enter
                    </kbd>
                    <button
                        type="button"
                        class="inline-flex h-7 items-center gap-2 rounded-md bg-blue-600 px-2.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-900 disabled:text-blue-200"
                        disabled={props.compiling}
                        onClick={props.onCompile}
                    >
                        <Show when={props.compiling} fallback={<PlayIcon />}>
                            <Spinner />
                        </Show>
                        {props.compiling ? "Compiling…" : "Compile"}
                    </button>
                </div>
            </Show>
        </div>
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
