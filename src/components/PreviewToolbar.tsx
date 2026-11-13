import {Button} from "@kobalte/core/button";
import {Tooltip} from "@kobalte/core/tooltip";
import {Show, type JSX} from "solid-js";

import {Spinner} from "./PdfPreview";

interface PreviewToolbarProps {
    canCompile: boolean;
    compiling: boolean;
    pageCount: number;
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onZoomReset: () => void;
    onCompile: () => void;
    onExport: () => void;
}

export function PreviewToolbar(props: PreviewToolbarProps) {
    return (
        <div class="@container flex h-10 shrink-0 items-center justify-between gap-2 border-b border-neutral-700 px-3">
            <span class="hidden text-xs font-semibold tracking-wide text-neutral-400 uppercase @2xs:inline">
                Preview
            </span>

            <div class="flex items-center gap-2">
                <Show when={props.pageCount > 0}>
                    <div class="flex items-center gap-1">
                        <ZoomButton label="Zoom out" onClick={props.onZoomOut}>
                            <MinusIcon />
                        </ZoomButton>
                        <TooltipButton
                            label="Reset zoom"
                            class="inline-flex h-7 min-w-12 items-center justify-center rounded-md px-1.5 text-[11px] text-neutral-300 tabular-nums transition hover:bg-neutral-700"
                            onClick={props.onZoomReset}
                        >
                            {Math.round(props.zoom * 100)}%
                        </TooltipButton>
                        <ZoomButton label="Zoom in" onClick={props.onZoomIn}>
                            <PlusIcon />
                        </ZoomButton>
                    </div>

                    <span class="hidden rounded bg-neutral-800 px-2 py-1 text-[11px] text-neutral-400 @min-[26rem]:inline-block">
                        {props.pageCount}{" "}
                        {props.pageCount === 1 ? "page" : "pages"}
                    </span>

                    <Button
                        class="inline-flex h-7 items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800 px-2.5 text-xs font-medium text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-700"
                        title="Export PDF"
                        aria-label="Export PDF"
                        onClick={props.onExport}
                    >
                        <DownloadIcon />
                        <span class="hidden @sm:inline">Export</span>
                    </Button>
                </Show>

                <Show when={props.canCompile}>
                    <div class="flex items-center gap-2">
                        <kbd class="hidden rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400 @lg:inline">
                            Ctrl/Cmd + Enter
                        </kbd>
                        <Button
                            class="inline-flex h-7 items-center gap-2 rounded-md bg-blue-600 px-2.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-900 disabled:text-blue-200"
                            disabled={props.compiling}
                            aria-label={
                                props.compiling ? "Compiling" : "Compile"
                            }
                            onClick={props.onCompile}
                        >
                            <Show
                                when={props.compiling}
                                fallback={<PlayIcon />}
                            >
                                <Spinner />
                            </Show>
                            <span class="hidden @min-[22rem]:inline">
                                {props.compiling ? "Compiling…" : "Compile"}
                            </span>
                        </Button>
                    </div>
                </Show>
            </div>
        </div>
    );
}

function ZoomButton(props: {
    label: string;
    onClick: () => void;
    children: JSX.Element;
}) {
    return (
        <TooltipButton
            label={props.label}
            class="inline-flex size-7 items-center justify-center rounded-md border border-neutral-700 bg-neutral-800 text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-700"
            onClick={props.onClick}
        >
            {props.children}
        </TooltipButton>
    );
}

function TooltipButton(props: {
    label: string;
    class: string;
    onClick: () => void;
    children: JSX.Element;
}) {
    return (
        <Tooltip openDelay={400}>
            <Tooltip.Trigger
                as={Button}
                class={props.class}
                aria-label={props.label}
                onClick={props.onClick}
            >
                {props.children}
            </Tooltip.Trigger>
            <Tooltip.Portal>
                <Tooltip.Content class="z-50 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-200 shadow-lg">
                    {props.label}
                </Tooltip.Content>
            </Tooltip.Portal>
        </Tooltip>
    );
}

function MinusIcon() {
    return (
        <svg
            viewBox="0 0 16 16"
            class="size-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            aria-hidden="true"
        >
            <path d="M3.5 8h9" />
        </svg>
    );
}

function PlusIcon() {
    return (
        <svg
            viewBox="0 0 16 16"
            class="size-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            aria-hidden="true"
        >
            <path d="M8 3.5v9M3.5 8h9" />
        </svg>
    );
}

function DownloadIcon() {
    return (
        <svg
            viewBox="0 0 16 16"
            class="size-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <path d="M8 2.5v7m0 0 2.75-2.75M8 9.5 5.25 6.75M2.5 11.5v1.25c0 .41.34.75.75.75h9.5c.41 0 .75-.34.75-.75V11.5" />
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
