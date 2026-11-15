import {Spinner} from "./Spinner";

interface LoadingOverlayProps {
    label: string;
    /**
     * Overrides the veil tint. The PDF pane dims its paper background more than
     * the editor does.
     */
    backdropClass?: string;
}

/**
 * Full-size loading veil with a spinner and a label.
 */
export function LoadingOverlay(props: LoadingOverlayProps) {
    return (
        <div
            class={`absolute inset-0 grid place-items-center backdrop-blur-[1px] ${props.backdropClass ?? "bg-surface-100/70"}`}
        >
            <div class="flex items-center gap-3 rounded-md bg-surface-100/90 px-4 py-3 text-sm text-surface-800 shadow-xl">
                <Spinner />
                {props.label}
            </div>
        </div>
    );
}
