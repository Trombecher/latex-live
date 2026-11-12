const MIN_PANE_WIDTH = 240;
const SEPARATOR_WIDTH = 4;

interface PaneSeparatorProps {
    ratio: number;
    onChange: (ratio: number) => void;
}

export function PaneSeparator(props: PaneSeparatorProps) {
    const handlePointerDown = (
        event: PointerEvent & {currentTarget: HTMLDivElement},
    ) => {
        if (event.button !== 0) {
            return;
        }

        const handle = event.currentTarget;
        const container = handle.parentElement;
        if (!container) {
            return;
        }

        const containerWidth = container.clientWidth;
        if (containerWidth <= 0) {
            return;
        }

        event.preventDefault();

        const startX = event.clientX;
        const startRatio = props.ratio;
        const minRatio = Math.min(0.5, MIN_PANE_WIDTH / containerWidth);
        const maxRatio = Math.max(
            0.5,
            1 - (MIN_PANE_WIDTH + SEPARATOR_WIDTH) / containerWidth,
        );

        handle.setPointerCapture(event.pointerId);
        document.body.classList.add("cursor-col-resize", "select-none");

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const delta = (startX - moveEvent.clientX) / containerWidth;
            props.onChange(
                Math.min(maxRatio, Math.max(minRatio, startRatio + delta)),
            );
        };

        const stopDragging = () => {
            document.body.classList.remove("cursor-col-resize", "select-none");
            handle.removeEventListener("pointermove", handlePointerMove);
            handle.removeEventListener("pointerup", stopDragging);
            handle.removeEventListener("pointercancel", stopDragging);

            if (handle.hasPointerCapture(event.pointerId)) {
                handle.releasePointerCapture(event.pointerId);
            }
        };

        handle.addEventListener("pointermove", handlePointerMove);
        handle.addEventListener("pointerup", stopDragging);
        handle.addEventListener("pointercancel", stopDragging);
    };

    return (
        <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize preview panel"
            class="group relative z-10 w-1 shrink-0 cursor-col-resize touch-none bg-neutral-800"
            onPointerDown={handlePointerDown}
        >
            <div class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-neutral-700 transition-colors group-hover:bg-blue-500 group-active:bg-blue-400" />
        </div>
    );
}
