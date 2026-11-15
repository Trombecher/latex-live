import MinusIcon from "lucide-solid/icons/minus";
import PlusIcon from "lucide-solid/icons/plus";
import {Show} from "solid-js";

import {MAX_ZOOM, MIN_ZOOM} from "../../lib/zoom";
import {IconButton} from "../ui/TooltipButton";
import {CUSTOM_ZOOM_VALUE, ZOOM_PRESETS, zoomSelectValue} from "./zoomPresets";

interface ZoomControlsProps {
    zoom: number;
    scaleValue: string;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onScaleChange: (value: string) => void;
}

/**
 * Zoom in/out buttons around a preset dropdown (with a percentage readout for
 * narrow containers where the dropdown is hidden).
 */
export function ZoomControls(props: ZoomControlsProps) {
    const selectValue = () => zoomSelectValue(props.scaleValue);

    const handleScaleChange = (
        event: Event & {currentTarget: HTMLSelectElement},
    ) => {
        const value = event.currentTarget.value;
        if (value !== CUSTOM_ZOOM_VALUE) {
            props.onScaleChange(value);
        }
    };

    return (
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
                <Show when={selectValue() === CUSTOM_ZOOM_VALUE}>
                    <option value={CUSTOM_ZOOM_VALUE}>
                        {Math.round(props.zoom * 100)}%
                    </option>
                </Show>
                {ZOOM_PRESETS.map(preset => (
                    <option value={preset.value}>{preset.label}</option>
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
    );
}
