import {openUrl} from "@tauri-apps/plugin-opener";
import {Show, createEffect, createSignal, onCleanup, onMount} from "solid-js";

import {
    EventBus,
    PDFLinkService,
    PDFViewer,
    pdfjs,
    type PDFDocumentProxy,
} from "../lib/pdfjs";
import {clampZoom} from "../lib/zoom";
import {Spinner} from "./Spinner";

const WHEEL_ZOOM_SENSITIVITY = 0.0025;
const ZOOM_DRAWING_DELAY = 400;
const FIT_SCALE_VALUES = new Set([
    "auto",
    "page-width",
    "page-fit",
    "page-height",
]);

type PDFViewerOptionsWithAbort = ConstructorParameters<typeof PDFViewer>[0] & {
    abortSignal?: AbortSignal;
};

const EXTERNAL_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export interface PdfViewerHandle {
    zoomIn: () => void;
    zoomOut: () => void;
    setScaleValue: (value: string) => void;
    previousPage: () => void;
    nextPage: () => void;
}

interface PdfPreviewProps {
    url: string | null;
    onReady: (handle: PdfViewerHandle | null) => void;
    onScaleChange: (scale: number, value: string) => void;
    onPageChange: (page: number) => void;
    onPageCount: (count: number) => void;
}

export function PdfPreview(props: PdfPreviewProps) {
    let container: HTMLDivElement | undefined;
    let viewerElement: HTMLDivElement | undefined;

    const [hasDocument, setHasDocument] = createSignal(false);
    const [loadingDocument, setLoadingDocument] = createSignal(false);
    const [loadError, setLoadError] = createSignal<string | null>(null);
    const [ready, setReady] = createSignal(false);

    let viewer: PDFViewer | null = null;
    let eventBus: EventBus | null = null;
    let linkService: PDFLinkService | null = null;
    let viewerAbort: AbortController | null = null;
    let eventAbort: AbortController | null = null;
    let displayedDoc: PDFDocumentProxy | null = null;

    // `PDFViewer` computes zoom anchors as `origin - containerTopLeft`, where
    // `containerTopLeft` is offset relative to the container's offset parent.
    // Our container lives inside a relatively positioned pane, so translate
    // client coordinates into the same coordinate space.
    function pointerOrigin(clientX: number, clientY: number): number[] {
        if (!viewer || !container) {
            return [clientX, clientY];
        }

        const rect = container.getBoundingClientRect();
        const [top, left] = viewer.containerTopLeft;
        return [clientX - rect.left + left, clientY - rect.top + top];
    }

    function zoomBy(factor: number, clientX?: number, clientY?: number) {
        if (!viewer || !container || !viewer.pdfDocument) {
            return;
        }

        const current = viewer.currentScale;
        const target = clampZoom(current * factor);

        // Never move in the opposite direction when the current scale already
        // sits outside the app's zoom bounds (e.g. a very small page-width).
        if (factor < 1 && target >= current) {
            return;
        }
        if (factor > 1 && target <= current) {
            return;
        }

        if (Math.abs(target - current) < 1e-4) {
            return;
        }

        const rect = container.getBoundingClientRect();
        const origin = pointerOrigin(
            clientX ?? rect.left + rect.width / 2,
            clientY ?? rect.top + rect.height / 2,
        );

        viewer.updateScale({
            scaleFactor: target / current,
            origin,
            drawingDelay: ZOOM_DRAWING_DELAY,
        });
    }

    const handle: PdfViewerHandle = {
        zoomIn: () => zoomBy(1.1),
        zoomOut: () => zoomBy(1 / 1.1),
        setScaleValue: value => {
            if (viewer?.pdfDocument) {
                viewer.currentScaleValue = value;
            }
        },
        previousPage: () => {
            viewer?.previousPage();
        },
        nextPage: () => {
            viewer?.nextPage();
        },
    };

    onMount(() => {
        if (!container || !viewerElement) {
            return;
        }

        viewerElement.classList.add("pdfViewer");

        eventBus = new EventBus();
        linkService = new PDFLinkService({eventBus});
        viewerAbort = new AbortController();

        viewer = new PDFViewer({
            container,
            viewer: viewerElement,
            eventBus,
            linkService,
            annotationEditorMode: pdfjs.AnnotationEditorType.DISABLE,
            removePageBorders: true,
            abortSignal: viewerAbort.signal,
        } as PDFViewerOptionsWithAbort);

        linkService.setViewer(viewer);

        eventAbort = new AbortController();
        eventBus.on(
            "scalechanging",
            (event: {scale: number}) => {
                props.onScaleChange(
                    event.scale,
                    // `currentScaleValue` is a number after `updateScale`, even
                    // though the typings only declare strings.
                    String(viewer?.currentScaleValue ?? event.scale),
                );
            },
            {signal: eventAbort.signal},
        );
        eventBus.on(
            "pagechanging",
            (event: {pageNumber: number}) => {
                props.onPageChange(event.pageNumber);
            },
            {signal: eventAbort.signal},
        );

        // Keep named fit modes in sync with pane resizes.
        let lastWidth = container.clientWidth;
        let lastHeight = container.clientHeight;
        let resizeFrame = 0;
        const resizeObserver = new ResizeObserver(() => {
            const width = container?.clientWidth ?? 0;
            const height = container?.clientHeight ?? 0;

            if (width === lastWidth && height === lastHeight) {
                return;
            }

            lastWidth = width;
            lastHeight = height;

            if (resizeFrame !== 0) {
                cancelAnimationFrame(resizeFrame);
            }

            resizeFrame = requestAnimationFrame(() => {
                resizeFrame = 0;

                if (!viewer) {
                    return;
                }

                const value = String(viewer.currentScaleValue);
                if (FIT_SCALE_VALUES.has(value)) {
                    viewer.currentScaleValue = value;
                }
            });
        });

        resizeObserver.observe(container);

        let zoomFrame = 0;
        let accumulatedFactor = 1;
        let anchorX = 0;
        let anchorY = 0;

        const scheduleZoom = (
            factor: number,
            clientX: number,
            clientY: number,
        ) => {
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
                return event.deltaY * (container?.clientHeight ?? 1);
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
            const rect = container?.getBoundingClientRect();

            if (gestureScale > 0) {
                scheduleZoom(
                    scale / gestureScale,
                    gesture.clientX ?? (rect ? rect.left + rect.width / 2 : 0),
                    gesture.clientY ?? (rect ? rect.top + rect.height / 2 : 0),
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

        // External links (hyperref, mailto, ...) must open outside the Tauri
        // webview instead of navigating the app away.
        const handleLinkClick = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }

            const anchor = target.closest("a[href]");
            if (!(anchor instanceof HTMLAnchorElement)) {
                return;
            }

            const href = anchor.getAttribute("href");
            if (!href || href.startsWith("#")) {
                return;
            }

            let url: URL;
            try {
                url = new URL(href, window.location.href);
            } catch {
                event.preventDefault();
                return;
            }

            // Never let a PDF link navigate the app webview away. Named
            // actions, destinations and attachments are handled by PDF.js
            // itself and never reach this point.
            event.preventDefault();

            if (!EXTERNAL_LINK_PROTOCOLS.has(url.protocol)) {
                console.warn(`Blocked unsupported PDF link: ${href}`);
                return;
            }

            void openUrl(url.href).catch(error => {
                console.error("Failed to open external link", error);
            });
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
        container.addEventListener("touchmove", handleTouchMove, {
            passive: false,
        });
        container.addEventListener("touchend", handleTouchEnd);
        container.addEventListener("touchcancel", handleTouchEnd);
        container.addEventListener("click", handleLinkClick);

        props.onReady(handle);
        setReady(true);

        onCleanup(() => {
            resizeObserver.disconnect();
            cancelAnimationFrame(resizeFrame);
            cancelAnimationFrame(zoomFrame);
            container?.removeEventListener("wheel", handleWheel);
            container?.removeEventListener("gesturestart", handleGestureStart);
            container?.removeEventListener(
                "gesturechange",
                handleGestureChange,
            );
            container?.removeEventListener("gestureend", handleGestureEnd);
            container?.removeEventListener("touchstart", handleTouchStart);
            container?.removeEventListener("touchmove", handleTouchMove);
            container?.removeEventListener("touchend", handleTouchEnd);
            container?.removeEventListener("touchcancel", handleTouchEnd);
            container?.removeEventListener("click", handleLinkClick);
        });
    });

    const clearDocument = () => {
        const previous = displayedDoc;
        displayedDoc = null;

        viewer?.setDocument(null);
        linkService?.setDocument(null);

        if (previous) {
            void previous.loadingTask.destroy();
        }

        setHasDocument(false);
        setLoadingDocument(false);
        props.onPageCount(0);
        props.onPageChange(1);
    };

    createEffect(() => {
        const url = props.url;
        if (!ready()) {
            return;
        }

        let cancelled = false;
        let resolved = false;
        let loadAbort: AbortController | null = null;

        setLoadError(null);

        if (!url) {
            clearDocument();
            return;
        }

        setLoadingDocument(true);

        const previousDoc = displayedDoc;
        const loadingTask = pdfjs.getDocument({url});

        void loadingTask.promise
            .then(document => {
                if (cancelled) {
                    void document.loadingTask.destroy();
                    return;
                }

                resolved = true;
                displayedDoc = document;

                const savedScaleValue = viewer?.currentScaleValue
                    ? String(viewer.currentScaleValue)
                    : null;
                const savedPage = viewer?.currentPageNumber ?? 1;
                const savedScrollTop = container?.scrollTop ?? 0;
                const savedScrollLeft = container?.scrollLeft ?? 0;
                const hadDocument = previousDoc !== null;

                loadAbort = new AbortController();
                eventBus?.on(
                    "pagesinit",
                    () => {
                        if (cancelled || document !== viewer?.pdfDocument) {
                            return;
                        }

                        if (viewer) {
                            viewer.currentScaleValue =
                                hadDocument && savedScaleValue
                                    ? savedScaleValue
                                    : "page-width";

                            if (hadDocument && viewer.pagesCount > 0) {
                                viewer.currentPageNumber = Math.min(
                                    savedPage,
                                    viewer.pagesCount,
                                );
                            }
                        }

                        if (hadDocument) {
                            requestAnimationFrame(() => {
                                requestAnimationFrame(() => {
                                    if (cancelled || !container) {
                                        return;
                                    }

                                    container.scrollLeft = savedScrollLeft;
                                    container.scrollTop = savedScrollTop;
                                });
                            });
                        }

                        setLoadingDocument(false);
                    },
                    {once: true, signal: loadAbort.signal},
                );

                viewer?.setDocument(document);
                linkService?.setDocument(document);

                setHasDocument(true);
                props.onPageCount(document.numPages);
                props.onPageChange(1);

                if (previousDoc && previousDoc !== document) {
                    void previousDoc.loadingTask.destroy();
                }

                void viewer?.pagesPromise?.catch((error: unknown) => {
                    if (cancelled) {
                        return;
                    }

                    setLoadError(
                        error instanceof Error ? error.message : String(error),
                    );
                    setLoadingDocument(false);
                });
            })
            .catch(error => {
                if (cancelled) {
                    return;
                }

                setLoadError(
                    error instanceof Error ? error.message : String(error),
                );
                setLoadingDocument(false);

                if (!previousDoc) {
                    setHasDocument(false);
                    props.onPageCount(0);
                    props.onPageChange(1);
                }
            });

        onCleanup(() => {
            cancelled = true;
            loadAbort?.abort();

            // Only cancel the load if it has not become the displayed
            // document yet; the next compile destroys the old document once
            // the replacement is ready.
            if (!resolved) {
                void loadingTask.destroy();
            }
        });
    });

    onCleanup(() => {
        viewer?.setDocument(null);
        eventAbort?.abort();
        viewerAbort?.abort();

        const previous = displayedDoc;
        displayedDoc = null;

        if (previous) {
            void previous.loadingTask.destroy();
        }

        props.onReady(null);
    });

    return (
        <div class="relative flex min-h-0 flex-1 flex-col">
            <div
                ref={element => {
                    container = element;
                }}
                class="absolute inset-0 overflow-auto bg-surface-200 p-4"
                style={{
                    "touch-action": "pan-x pan-y",
                    "scrollbar-gutter": "stable",
                }}
                tabindex="0"
            >
                <div
                    ref={element => {
                        viewerElement = element;
                    }}
                    class="latex-pdf-viewer"
                />
            </div>

            <Show when={!hasDocument()}>
                <div class="absolute inset-0 grid place-items-center bg-surface-200">
                    <EmptyState />
                </div>
            </Show>

            <Show when={loadingDocument()}>
                <div class="absolute inset-0 grid place-items-center bg-surface-100/60 backdrop-blur-[1px]">
                    <div class="flex items-center gap-3 rounded-md bg-surface-100/90 px-4 py-3 text-sm text-surface-800 shadow-xl">
                        <Spinner />
                        Loading PDF…
                    </div>
                </div>
            </Show>

            <Show when={loadError()}>
                <div class="absolute inset-x-4 bottom-4 rounded-md border border-red-500/40 bg-danger-surface/90 p-3 text-sm text-danger-text shadow-xl">
                    Failed to load PDF: {loadError()}
                </div>
            </Show>
        </div>
    );
}

function EmptyState() {
    return (
        <div class="grid h-full place-items-center text-center">
            <div class="max-w-sm">
                <div class="mx-auto mb-3 grid size-12 place-items-center rounded-lg bg-surface-300/50 text-2xl">
                    PDF
                </div>
                <p class="text-sm font-medium text-surface-700">
                    No preview yet
                </p>
                <p class="mt-1 text-xs text-surface-500">
                    Press Compile to render your LaTeX document here.
                </p>
            </div>
        </div>
    );
}
