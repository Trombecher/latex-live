import {createEffect, createSignal, onCleanup} from "solid-js";

import {pdfjs, type PDFDocumentProxy} from "../lib/pdfjs";
import type {PdfViewerController} from "./createPdfViewer";

interface PdfDocumentOptions {
    url: () => string | null;
    ready: () => boolean;
    controller: () => PdfViewerController | null;
    container: () => HTMLDivElement | undefined;
    onPageChange: (page: number) => void;
    onPageCount: (count: number) => void;
}

/**
 * Loads the PDF behind `url` into the viewer and preserves scale, page and
 * scroll position across recompiles.
 */
export function usePdfDocument(options: PdfDocumentOptions) {
    const [hasDocument, setHasDocument] = createSignal(false);
    const [loading, setLoading] = createSignal(false);
    const [loadError, setLoadError] = createSignal<string | null>(null);

    let displayedDoc: PDFDocumentProxy | null = null;

    const clearDocument = () => {
        const previous = displayedDoc;
        displayedDoc = null;

        const controller = options.controller();
        controller?.viewer.setDocument(null);
        controller?.linkService.setDocument(null);

        if (previous) {
            void previous.loadingTask.destroy();
        }

        setHasDocument(false);
        setLoading(false);
        options.onPageCount(0);
        options.onPageChange(1);
    };

    createEffect(() => {
        const url = options.url();
        if (!options.ready()) {
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

        const controller = options.controller();
        if (!controller) {
            return;
        }

        setLoading(true);

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

                const viewer = controller.viewer;
                const savedScaleValue = viewer.currentScaleValue
                    ? String(viewer.currentScaleValue)
                    : null;
                const savedPage = viewer.currentPageNumber;
                const savedScrollTop = options.container()?.scrollTop ?? 0;
                const savedScrollLeft = options.container()?.scrollLeft ?? 0;
                const hadDocument = previousDoc !== null;

                loadAbort = new AbortController();
                controller.eventBus.on(
                    "pagesinit",
                    () => {
                        if (cancelled || document !== viewer.pdfDocument) {
                            return;
                        }

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

                        if (hadDocument) {
                            requestAnimationFrame(() => {
                                requestAnimationFrame(() => {
                                    const container = options.container();
                                    if (cancelled || !container) {
                                        return;
                                    }

                                    container.scrollLeft = savedScrollLeft;
                                    container.scrollTop = savedScrollTop;
                                });
                            });
                        }

                        setLoading(false);
                    },
                    {once: true, signal: loadAbort.signal},
                );

                viewer.setDocument(document);
                controller.linkService.setDocument(document);

                setHasDocument(true);
                options.onPageCount(document.numPages);
                options.onPageChange(1);

                if (previousDoc && previousDoc !== document) {
                    void previousDoc.loadingTask.destroy();
                }

                void viewer.pagesPromise?.catch((error: unknown) => {
                    if (cancelled) {
                        return;
                    }

                    setLoadError(
                        error instanceof Error ? error.message : String(error),
                    );
                    setLoading(false);
                });
            })
            .catch(error => {
                if (cancelled) {
                    return;
                }

                setLoadError(
                    error instanceof Error ? error.message : String(error),
                );
                setLoading(false);

                if (!previousDoc) {
                    setHasDocument(false);
                    options.onPageCount(0);
                    options.onPageChange(1);
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
        const previous = displayedDoc;
        displayedDoc = null;

        if (previous) {
            void previous.loadingTask.destroy();
        }
    });

    return {hasDocument, loading, loadError, clearDocument};
}
