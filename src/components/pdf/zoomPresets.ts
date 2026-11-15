/**
 * The zoom dropdown offers fixed PDF.js scale values. Arbitrary scales (wheel
 * or pinch zoom) are not presets, so the select shows a synthetic "custom"
 * entry for them instead.
 */
export const CUSTOM_ZOOM_VALUE = "custom";

export const ZOOM_PRESETS = [
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

/**
 * The select's value: the preset itself when the viewer sits on one, or the
 * "custom" marker otherwise.
 */
export function zoomSelectValue(scaleValue: string): string {
    return PRESET_VALUES.has(scaleValue) ? scaleValue : CUSTOM_ZOOM_VALUE;
}
