import {Button} from "@kobalte/core/button";
import DownloadIcon from "lucide-solid/icons/download";
import PlayIcon from "lucide-solid/icons/play";
import {Show} from "solid-js";

import {PageControls} from "./pdf/PageControls";
import {ZoomControls} from "./pdf/ZoomControls";
import {Spinner} from "./Spinner";

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
    return (
        <div class="@container flex h-10 shrink-0 items-center justify-between gap-2 border-b border-surface-300 px-3">
            <span class="hidden text-xs font-semibold tracking-wide text-surface-600 uppercase @min-[30rem]:inline">
                Preview
            </span>

            <div class="flex items-center gap-2">
                <Show when={props.pageCount > 0}>
                    <PageControls
                        pageNumber={props.pageNumber}
                        pageCount={props.pageCount}
                        onPreviousPage={props.onPreviousPage}
                        onNextPage={props.onNextPage}
                    />

                    <ZoomControls
                        zoom={props.zoom}
                        scaleValue={props.scaleValue}
                        onZoomIn={props.onZoomIn}
                        onZoomOut={props.onZoomOut}
                        onScaleChange={props.onScaleChange}
                    />

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
