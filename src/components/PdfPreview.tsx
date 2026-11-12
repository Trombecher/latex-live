import * as pdfjs from "pdfjs-dist";
import type {PDFDocumentProxy, RenderTask} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
    For,
    Show,
    createEffect,
    createSignal,
    onCleanup,
    onMount,
} from "solid-js";

import {clampZoom} from "../lib/zoom";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const PAGE_GAP = 16;
const HORIZONTAL_PADDING = 32;
const WHEEL_ZOOM_SENSITIVITY = 0.0025;

interface PdfPreviewProps {
    url: string | null;
    zoom: number;
    onZoomChange: (zoom: number) => void;
    onPageCount: (count: number) => void;
}

function PdfPage(props: {
    doc: PDFDocumentProxy;
    pageNumber: number;
    width: number;
}) {
    let canvas: HTMLCanvasElement | undefined;
    let renderTask: RenderTask | undefined;
    let generation = 0;

    const [aspectRatio, setAspectRatio] = createSignal(0);

    // Keep the CSS size of the canvas in sync with the requested width
    // synchronously, so the scroll container can be adjusted while zooming
    // before the page has finished re-rendering.
    createEffect(() => {
        const width = props.width;
        const aspect = aspectRatio();

        if (!canvas || width <= 0) {
            return;
        }

        canvas.style.width = `${Math.floor(width)}px`;
        if (aspect > 0) {
            canvas.style.height = `${Math.floor(width * aspect)}px`;
        }
    });

    createEffect(() => {
        const doc = props.doc;
        const pageNumber = props.pageNumber;
        const width = props.width;

        if (!canvas || width <= 0) {
            return;
        }

        const current = ++generation;
        renderTask?.cancel();

        void (async () => {
            const page = await doc.getPage(pageNumber);
            if (current !== generation || !canvas) {
                return;
            }

            const baseViewport = page.getViewport({scale: 1});
            const pixelRatio = window.devicePixelRatio || 1;
            const cssScale = width / baseViewport.width;
            const viewport = page.getViewport({scale: cssScale * pixelRatio});

            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            setAspectRatio(baseViewport.height / baseViewport.width);

            const task = page.render({canvas, viewport});
            renderTask = task;

            try {
                await task.promise;
            } catch (error) {
                if (
                    (error as {name?: string}).name
                    !== "RenderingCancelledException"
                ) {
                    console.error("Failed to render PDF page", error);
                }
            }
        })();
    });

    onCleanup(() => {
        generation += 1;
        renderTask?.cancel();
    });

    return (
        <canvas
            ref={element => {
                canvas = element;
            }}
            class="block rounded-sm bg-white shadow-lg shadow-black/40"
        />
    );
}

export function PdfPreview(props: PdfPreviewProps) {
    let paneElement: HTMLDivElement | undefined;
    let scrollContainer: HTMLDivElement | undefined;

    const [doc, setDoc] = createSignal<PDFDocumentProxy | null>(null);
    const [pageCount, setPageCount] = createSignal(0);
    const [basePageWidth, setBasePageWidth] = createSignal(0);
    const [loadingDocument, setLoadingDocument] = createSignal(false);
    const [loadError, setLoadError] = createSignal<string | null>(null);

    const pageWidth = () => basePageWidth() * props.zoom;

    onMount(() => {
        const container = scrollContainer;
        const pane = paneElement;
        if (!container || !pane) {
            return;
        }

        // The page size is independent of the pane width, so resizing the
        // pane only reveals or clips the PDF. Keep the viewport centered on
        // the same part of the document while the pane changes size.
        let previousWidth = container.clientWidth;

        const observer = new ResizeObserver(() => {
            const width = container.clientWidth;
            if (width === previousWidth) {
                return;
            }

            const center = container.scrollLeft + previousWidth / 2;
            previousWidth = width;
            container.scrollLeft = center - width / 2;

            // Recover if the pane had no usable width when the document was
            // loaded.
            if (basePageWidth() <= 0) {
                setBasePageWidth(Math.max(0, width - HORIZONTAL_PADDING));
            }
        });

        observer.observe(pane);

        let zoomFrame = 0;
        let accumulatedFactor = 1;
        let anchorX = 0;
        let anchorY = 0;

        const applyZoom = (
            factor: number,
            clientX: number,
            clientY: number,
        ) => {
            const current = props.zoom;
            const next = clampZoom(current * factor);

            if (Math.abs(next - current) < 1e-4) {
                return;
            }

            const rect = container.getBoundingClientRect();
            const pointerX = clientX - rect.left;
            const pointerY = clientY - rect.top;
            const ratioX =
                (container.scrollLeft + pointerX)
                / Math.max(1, container.scrollWidth);
            const ratioY =
                (container.scrollTop + pointerY)
                / Math.max(1, container.scrollHeight);

            props.onZoomChange(next);

            // Keep the point under the cursor anchored while the pages
            // resize. Page sizes update synchronously, so this takes effect
            // before the next paint.
            container.scrollLeft = ratioX * container.scrollWidth - pointerX;
            container.scrollTop = ratioY * container.scrollHeight - pointerY;
        };

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
                applyZoom(pendingFactor, anchorX, anchorY);
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
        container.addEventListener("touchmove", handleTouchMove, {
            passive: false,
        });
        container.addEventListener("touchend", handleTouchEnd);
        container.addEventListener("touchcancel", handleTouchEnd);

        onCleanup(() => {
            observer.disconnect();
            cancelAnimationFrame(zoomFrame);
            container.removeEventListener("wheel", handleWheel);
            container.removeEventListener("gesturestart", handleGestureStart);
            container.removeEventListener("gesturechange", handleGestureChange);
            container.removeEventListener("gestureend", handleGestureEnd);
            container.removeEventListener("touchstart", handleTouchStart);
            container.removeEventListener("touchmove", handleTouchMove);
            container.removeEventListener("touchend", handleTouchEnd);
            container.removeEventListener("touchcancel", handleTouchEnd);
        });
    });

    createEffect(() => {
        const url = props.url;
        let cancelled = false;
        let loadedDocument: PDFDocumentProxy | null = null;

        setLoadError(null);

        if (!url) {
            setDoc(null);
            setPageCount(0);
            props.onPageCount(0);
            return;
        }

        setLoadingDocument(true);
        setDoc(null);
        setPageCount(0);

        const loadingTask = pdfjs.getDocument({url});

        void loadingTask.promise
            .then(document => {
                loadedDocument = document;

                if (cancelled) {
                    void document.loadingTask.destroy();
                    return;
                }

                const containerWidth = scrollContainer?.clientWidth ?? 0;
                setBasePageWidth(
                    Math.max(0, containerWidth - HORIZONTAL_PADDING),
                );
                setDoc(document);
                setPageCount(document.numPages);
                props.onPageCount(document.numPages);
            })
            .catch(error => {
                if (!cancelled) {
                    setLoadError(
                        error instanceof Error ? error.message : String(error),
                    );
                    setDoc(null);
                    setPageCount(0);
                    props.onPageCount(0);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoadingDocument(false);
                }
            });

        onCleanup(() => {
            cancelled = true;
            if (loadedDocument) {
                void loadedDocument.loadingTask.destroy();
            } else {
                void loadingTask.destroy();
            }
        });
    });

    return (
        <div
            ref={element => {
                paneElement = element;
            }}
            class="relative flex min-h-0 flex-1 flex-col"
        >
            <div
                ref={element => {
                    scrollContainer = element;
                }}
                class="min-h-0 flex-1 overflow-auto bg-neutral-800 p-4"
                style={{
                    "touch-action": "pan-x pan-y",
                    "scrollbar-gutter": "stable",
                }}
            >
                <Show when={pageCount() > 0 && doc()} fallback={<EmptyState />}>
                    <div
                        class="mx-auto flex w-max min-w-full flex-col items-center"
                        style={{gap: `${PAGE_GAP}px`}}
                    >
                        <For
                            each={Array.from(
                                {length: pageCount()},
                                (_, index) => index + 1,
                            )}
                        >
                            {pageNumber => (
                                <PdfPage
                                    doc={doc()!}
                                    pageNumber={pageNumber}
                                    width={pageWidth()}
                                />
                            )}
                        </For>
                    </div>
                </Show>
            </div>

            <Show when={loadingDocument()}>
                <div class="absolute inset-0 grid place-items-center bg-neutral-900/60 backdrop-blur-[1px]">
                    <div class="flex items-center gap-3 rounded-md bg-neutral-900/90 px-4 py-3 text-sm text-neutral-200 shadow-xl">
                        <Spinner />
                        Loading PDF…
                    </div>
                </div>
            </Show>

            <Show when={loadError()}>
                <div class="absolute inset-x-4 bottom-4 rounded-md border border-red-500/40 bg-red-950/90 p-3 text-sm text-red-200 shadow-xl">
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
                <div class="mx-auto mb-3 grid size-12 place-items-center rounded-lg bg-neutral-700/50 text-2xl">
                    PDF
                </div>
                <p class="text-sm font-medium text-neutral-300">
                    No preview yet
                </p>
                <p class="mt-1 text-xs text-neutral-500">
                    Press Compile to render your LaTeX document here.
                </p>
            </div>
        </div>
    );
}

export function Spinner() {
    return (
        <span class="inline-block size-4 animate-spin rounded-full border-2 border-neutral-500 border-t-neutral-100" />
    );
}
