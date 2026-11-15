const WHEEL_ZOOM_SENSITIVITY = 0.0025;

type ZoomBy = (factor: number, clientX?: number, clientY?: number) => void;

/**
 * Installs ctrl/cmd+wheel, WebKit gesture and touch pinch zoom handlers on the
 * scrolling container. Returns the cleanup function.
 */
export function installZoomInput(
    container: HTMLElement,
    zoomBy: ZoomBy,
): () => void {
    let zoomFrame = 0;
    let accumulatedFactor = 1;
    let anchorX = 0;
    let anchorY = 0;

    const scheduleZoom = (factor: number, clientX: number, clientY: number) => {
        if (!Number.isFinite(factor) || factor <= 0) {
            return;
        }

        accumulatedFactor *= factor;
        anchorX = clientX;
        anchorY = clientY;

        if (zoomFrame !== 0) {
            return;
        }

        zoomFrame = requestAnimationFrame(() => {
            zoomFrame = 0;
            const pendingFactor = accumulatedFactor;
            accumulatedFactor = 1;
            zoomBy(pendingFactor, anchorX, anchorY);
        });
    };

    const normalizeWheelDelta = (event: WheelEvent) => {
        if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
            return event.deltaY * 16;
        }
        if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
            return event.deltaY * container.clientHeight;
        }
        return event.deltaY;
    };

    const handleWheel = (event: WheelEvent) => {
        if (!(event.ctrlKey || event.metaKey)) {
            return;
        }

        event.preventDefault();

        const delta = normalizeWheelDelta(event);
        scheduleZoom(
            Math.exp(-delta * WHEEL_ZOOM_SENSITIVITY),
            event.clientX,
            event.clientY,
        );
    };

    // WebKit-based webviews (macOS) emit dedicated pinch gesture events
    // instead of ctrl+wheel events.
    type GestureEvent = Event & {
        scale?: number;
        clientX?: number;
        clientY?: number;
    };

    let gestureScale = 1;

    const handleGestureStart = (event: Event) => {
        event.preventDefault();
        gestureScale = (event as GestureEvent).scale ?? 1;
    };

    const handleGestureChange = (event: Event) => {
        event.preventDefault();

        const gesture = event as GestureEvent;
        const scale = gesture.scale ?? gestureScale;
        const rect = container.getBoundingClientRect();

        if (gestureScale > 0) {
            scheduleZoom(
                scale / gestureScale,
                gesture.clientX ?? rect.left + rect.width / 2,
                gesture.clientY ?? rect.top + rect.height / 2,
            );
        }

        gestureScale = scale;
    };

    const handleGestureEnd = (event: Event) => {
        event.preventDefault();
        gestureScale = 1;
    };

    // Touchscreen pinch-to-zoom.
    const touchDistance = (touches: TouchList) => {
        const first = touches[0];
        const second = touches[1];
        return Math.hypot(
            second.clientX - first.clientX,
            second.clientY - first.clientY,
        );
    };

    let pinchDistance = 0;

    const handleTouchStart = (event: TouchEvent) => {
        if (event.touches.length !== 2) {
            pinchDistance = 0;
            return;
        }

        event.preventDefault();
        pinchDistance = touchDistance(event.touches);
    };

    const handleTouchMove = (event: TouchEvent) => {
        if (event.touches.length !== 2) {
            return;
        }

        event.preventDefault();

        const distance = touchDistance(event.touches);
        if (pinchDistance <= 0 || distance <= 0) {
            pinchDistance = distance;
            return;
        }

        const centerX =
            (event.touches[0].clientX + event.touches[1].clientX) / 2;
        const centerY =
            (event.touches[0].clientY + event.touches[1].clientY) / 2;

        scheduleZoom(distance / pinchDistance, centerX, centerY);
        pinchDistance = distance;
    };

    const handleTouchEnd = (event: TouchEvent) => {
        if (event.touches.length < 2) {
            pinchDistance = 0;
        }
    };

    container.addEventListener("wheel", handleWheel, {passive: false});
    container.addEventListener("gesturestart", handleGestureStart, {
        passive: false,
    });
    container.addEventListener("gesturechange", handleGestureChange, {
        passive: false,
    });
    container.addEventListener("gestureend", handleGestureEnd, {
        passive: false,
    });
    container.addEventListener("touchstart", handleTouchStart, {
        passive: false,
    });
    container.addEventListener("touchmove", handleTouchMove, {passive: false});
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("touchcancel", handleTouchEnd);

    return () => {
        cancelAnimationFrame(zoomFrame);
        container.removeEventListener("wheel", handleWheel);
        container.removeEventListener("gesturestart", handleGestureStart);
        container.removeEventListener("gesturechange", handleGestureChange);
        container.removeEventListener("gestureend", handleGestureEnd);
        container.removeEventListener("touchstart", handleTouchStart);
        container.removeEventListener("touchmove", handleTouchMove);
        container.removeEventListener("touchend", handleTouchEnd);
        container.removeEventListener("touchcancel", handleTouchEnd);
    };
}
