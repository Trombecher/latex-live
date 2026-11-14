import {Separator} from "@kobalte/core/separator";

const MIN_PANE_WIDTH = 240;
const SEPARATOR_WIDTH = 4;
const KEYBOARD_STEP = 0.02;
const KEYBOARD_STEP_LARGE = 0.1;

interface PaneSeparatorProps {
    ratio: number;
    onChange: (ratio: number) => void;
}

function ratioBounds(containerWidth: number) {
    return {
        minRatio: Math.min(0.5, MIN_PANE_WIDTH / containerWidth),
        maxRatio: Math.max(
            0.5,
            1 - (MIN_PANE_WIDTH + SEPARATOR_WIDTH) / containerWidth,
        ),
    };
}

function clampRatio(value: number, containerWidth: number) {
    const {minRatio, maxRatio} = ratioBounds(containerWidth);
    return Math.min(maxRatio, Math.max(minRatio, value));
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

        handle.setPointerCapture(event.pointerId);
        document.body.classList.add("cursor-col-resize", "select-none");

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const delta = (startX - moveEvent.clientX) / containerWidth;
            props.onChange(clampRatio(startRatio + delta, containerWidth));
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

    const handleKeyDown = (
        event: KeyboardEvent & {currentTarget: HTMLDivElement},
    ) => {
        const container = event.currentTarget.parentElement;
        if (!container || container.clientWidth <= 0) {
            return;
        }

        const step = event.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP;

        // Moving the separator left makes the preview pane larger.
        let delta: number;
        switch (event.key) {
            case "ArrowLeft":
                delta = step;
                break;
            case "ArrowRight":
                delta = -step;
                break;
            default:
                return;
        }

        event.preventDefault();
        props.onChange(clampRatio(props.ratio + delta, container.clientWidth));
    };

    return (
        <Separator
            as="div"
            orientation="vertical"
            aria-label="Resize preview panel"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(props.ratio * 100)}
            tabIndex={0}
            class="group relative z-10 w-1 shrink-0 cursor-col-resize touch-none bg-surface-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
        >
            <div class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-surface-300 transition-colors group-hover:bg-blue-500 group-focus-visible:bg-blue-500 group-active:bg-blue-400" />
        </Separator>
    );
}
