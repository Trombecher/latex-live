import {Button} from "@kobalte/core/button";
import {Tooltip} from "@kobalte/core/tooltip";
import ChevronLeftIcon from "lucide-solid/icons/chevron-left";
import ChevronRightIcon from "lucide-solid/icons/chevron-right";
import DownloadIcon from "lucide-solid/icons/download";
import MinusIcon from "lucide-solid/icons/minus";
import PlayIcon from "lucide-solid/icons/play";
import PlusIcon from "lucide-solid/icons/plus";
import {Show, type JSX} from "solid-js";

import {MAX_ZOOM, MIN_ZOOM} from "../lib/zoom";
import {Spinner} from "./Spinner";

const ZOOM_PRESETS = [
    {value: "auto", label: "Automatic Zoom"},
    {value: "page-actual", label: "Actual Size"},
    {value: "page-fit", label: "Page Fit"},
    {value: "page-width", label: "Page Width"},
    {value: "0.5", label: "50%"},
    {value: "0.75", label: "75%"},
    {value: "1", label: "100%"},
    {value: "1.25", label: "125%"},
    {value: "1.5", label: "150%"},
    {value: "2", label: "200%"},
    {value: "3", label: "300%"},
    {value: "4", label: "400%"},
] as const;

const PRESET_VALUES = new Set<string>(ZOOM_PRESETS.map(preset => preset.value));

interface PreviewToolbarProps {
    canCompile: boolean;
    compiling: boolean;
    pageNumber: number;
    pageCount: number;
    zoom: number;
    scaleValue: string;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onScaleChange: (value: string) => void;
    onPreviousPage: () => void;
    onNextPage: () => void;
    onCompile: () => void;
    onExport: () => void;
}

export function PreviewToolbar(props: PreviewToolbarProps) {
    const selectValue = () =>
        PRESET_VALUES.has(props.scaleValue) ? props.scaleValue : "custom";

    const handleScaleChange = (
        event: Event & {currentTarget: HTMLSelectElement},
    ) => {
        const value = event.currentTarget.value;
        if (value !== "custom") {
            props.onScaleChange(value);
        }
    };

    return (
        <div class="@container flex h-10 shrink-0 items-center justify-between gap-2 border-b border-surface-300 px-3">
            <span class="hidden text-xs font-semibold tracking-wide text-surface-600 uppercase @min-[30rem]:inline">
                Preview
            </span>

            <div class="flex items-center gap-2">
                <Show when={props.pageCount > 0}>
                    <div class="hidden items-center gap-1 @min-[38rem]:flex">
                        <IconButton
                            label="Previous page"
                            disabled={props.pageNumber <= 1}
                            onClick={props.onPreviousPage}
                        >
                            <ChevronLeftIcon
                                class="size-3.5"
                                aria-hidden="true"
                            />
                        </IconButton>

                        <span class="inline-flex h-7 min-w-12 items-center justify-center rounded-md border border-surface-300 bg-surface-200 px-1.5 text-[11px] text-surface-700 tabular-nums">
                            {props.pageNumber} / {props.pageCount}
                        </span>

                        <IconButton
                            label="Next page"
                            disabled={props.pageNumber >= props.pageCount}
                            onClick={props.onNextPage}
                        >
                            <ChevronRightIcon
                                class="size-3.5"
                                aria-hidden="true"
                            />
                        </IconButton>
                    </div>

                    <span class="hidden rounded bg-surface-200 px-2 py-1 text-[11px] text-surface-600 @sm:inline-block @min-[38rem]:hidden">
                        {props.pageCount}{" "}
                        {props.pageCount === 1 ? "page" : "pages"}
                    </span>

                    <div class="flex items-center gap-1">
                        <IconButton
                            label="Zoom out"
                            disabled={props.zoom <= MIN_ZOOM + 1e-4}
                            onClick={props.onZoomOut}
                        >
                            <MinusIcon class="size-3.5" aria-hidden="true" />
                        </IconButton>

                        <span class="inline-flex h-7 min-w-12 items-center justify-center rounded-md px-1.5 text-[11px] text-surface-700 tabular-nums @2xs:hidden">
                            {Math.round(props.zoom * 100)}%
                        </span>

                        <select
                            class="hidden h-7 w-[6.5rem] cursor-pointer rounded-md border border-surface-300 bg-surface-200 px-1.5 text-[11px] text-surface-700 tabular-nums transition hover:border-surface-400 hover:bg-surface-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 @2xs:block"
                            aria-label="Zoom"
                            title="Zoom"
                            value={selectValue()}
                            onChange={handleScaleChange}
                        >
                            <Show when={selectValue() === "custom"}>
                                <option value="custom">
                                    {Math.round(props.zoom * 100)}%
                                </option>
                            </Show>
                            {ZOOM_PRESETS.map(preset => (
                                <option value={preset.value}>
                                    {preset.label}
                                </option>
                            ))}
                        </select>

                        <IconButton
                            label="Zoom in"
                            disabled={props.zoom >= MAX_ZOOM - 1e-4}
                            onClick={props.onZoomIn}
                        >
                            <PlusIcon class="size-3.5" aria-hidden="true" />
                        </IconButton>
                    </div>

                    <Button
                        class="inline-flex h-7 items-center gap-1.5 rounded-md border border-surface-300 bg-surface-200 px-2.5 text-xs font-medium text-surface-800 transition hover:border-surface-400 hover:bg-surface-300"
                        title="Export PDF"
                        aria-label="Export PDF"
                        onClick={props.onExport}
                    >
                        <DownloadIcon class="size-3.5" aria-hidden="true" />
                        <span class="hidden @min-[30rem]:inline">Export</span>
                    </Button>
                </Show>

                <Show when={props.canCompile}>
                    <div class="flex items-center gap-2">
                        <kbd class="hidden shrink-0 rounded border border-surface-300 bg-surface-200 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-surface-600 @min-[44rem]:inline">
                            Ctrl/Cmd + Enter
                        </kbd>
                        <Button
                            class="inline-flex h-7 items-center gap-2 rounded-md bg-blue-600 px-2.5 text-xs font-medium text-always-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-900 disabled:text-blue-200"
                            disabled={props.compiling}
                            aria-label={
                                props.compiling ? "Compiling" : "Compile"
                            }
                            onClick={props.onCompile}
                        >
                            <Show
                                when={props.compiling}
                                fallback={
                                    <PlayIcon
                                        class="size-3.5"
                                        aria-hidden="true"
                                    />
                                }
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

function IconButton(props: {
    label: string;
    disabled?: boolean;
    onClick: () => void;
    children: JSX.Element;
}) {
    return (
        <TooltipButton
            label={props.label}
            disabled={props.disabled}
            class="inline-flex size-7 items-center justify-center rounded-md border border-surface-300 bg-surface-200 text-surface-700 transition hover:border-surface-400 hover:bg-surface-300 disabled:cursor-not-allowed disabled:opacity-50 hover:disabled:border-surface-300 hover:disabled:bg-surface-200"
            onClick={props.onClick}
        >
            {props.children}
        </TooltipButton>
    );
}

function TooltipButton(props: {
    label: string;
    class: string;
    disabled?: boolean;
    onClick: () => void;
    children: JSX.Element;
}) {
    return (
        <Tooltip openDelay={400}>
            <Tooltip.Trigger
                as={Button}
                class={props.class}
                disabled={props.disabled}
                aria-label={props.label}
                onClick={props.onClick}
            >
                {props.children}
            </Tooltip.Trigger>
            <Tooltip.Portal>
                <Tooltip.Content class="z-50 rounded-md border border-surface-300 bg-surface-100 px-2 py-1 text-[11px] text-surface-800 shadow-lg">
                    {props.label}
                </Tooltip.Content>
            </Tooltip.Portal>
        </Tooltip>
    );
}
