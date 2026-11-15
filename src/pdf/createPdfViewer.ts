import {EventBus, PDFLinkService, PDFViewer, pdfjs} from "../lib/pdfjs";
import {clampZoom} from "../lib/zoom";

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

export interface PdfViewerHandle {
    zoomIn: () => void;
    zoomOut: () => void;
    setScaleValue: (value: string) => void;
    previousPage: () => void;
    nextPage: () => void;
}

export interface PdfViewerController {
    handle: PdfViewerHandle;
    zoomBy: (factor: number, clientX?: number, clientY?: number) => void;
    viewer: PDFViewer;
    linkService: PDFLinkService;
    eventBus: EventBus;
    destroy: () => void;
}

interface CreatePdfViewerOptions {
    container: HTMLDivElement;
    viewerElement: HTMLDivElement;
    onScaleChange: (scale: number, value: string) => void;
    onPageChange: (page: number) => void;
}

/**
 * Builds the PDF.js viewer, wires its scale/page events and keeps named fit
 * modes in sync with pane resizes.
 */
export function createPdfViewer(
    options: CreatePdfViewerOptions,
): PdfViewerController {
    const {container, viewerElement} = options;

    viewerElement.classList.add("pdfViewer");

    const eventBus = new EventBus();
    const linkService = new PDFLinkService({eventBus});
    const viewerAbort = new AbortController();

    const viewer = new PDFViewer({
        container,
        viewer: viewerElement,
        eventBus,
        linkService,
        annotationEditorMode: pdfjs.AnnotationEditorType.DISABLE,
        removePageBorders: true,
        abortSignal: viewerAbort.signal,
    } as PDFViewerOptionsWithAbort);

    linkService.setViewer(viewer);

    const eventAbort = new AbortController();
    eventBus.on(
        "scalechanging",
        (event: {scale: number}) => {
            options.onScaleChange(
                event.scale,
                // `currentScaleValue` is a number after `updateScale`, even
                // though the typings only declare strings.
                String(viewer.currentScaleValue ?? event.scale),
            );
        },
        {signal: eventAbort.signal},
    );
    eventBus.on(
        "pagechanging",
        (event: {pageNumber: number}) => {
            options.onPageChange(event.pageNumber);
        },
        {signal: eventAbort.signal},
    );

    let lastWidth = container.clientWidth;
    let lastHeight = container.clientHeight;
    let resizeFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
        const width = container.clientWidth;
        const height = container.clientHeight;

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

            const value = String(viewer.currentScaleValue);
            if (FIT_SCALE_VALUES.has(value)) {
                viewer.currentScaleValue = value;
            }
        });
    });

    resizeObserver.observe(container);

    // `PDFViewer` computes zoom anchors as `origin - containerTopLeft`, where
    // `containerTopLeft` is offset relative to the container's offset parent.
    // Our container lives inside a relatively positioned pane, so translate
    // client coordinates into the same coordinate space.
    function pointerOrigin(clientX: number, clientY: number): number[] {
        const rect = container.getBoundingClientRect();
        const [top, left] = viewer.containerTopLeft;
        return [clientX - rect.left + left, clientY - rect.top + top];
    }

    function zoomBy(factor: number, clientX?: number, clientY?: number) {
        if (!viewer.pdfDocument) {
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
            if (viewer.pdfDocument) {
                viewer.currentScaleValue = value;
            }
        },
        previousPage: () => {
            viewer.previousPage();
        },
        nextPage: () => {
            viewer.nextPage();
        },
    };

    const destroy = () => {
        resizeObserver.disconnect();
        cancelAnimationFrame(resizeFrame);

        viewer.setDocument(null);
        eventAbort.abort();
        viewerAbort.abort();
    };

    return {handle, zoomBy, viewer, linkService, eventBus, destroy};
}
