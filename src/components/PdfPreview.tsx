import {Show, createSignal, onCleanup, onMount} from "solid-js";

import {installExternalLinkHandler} from "../lib/externalLinks";
import {
    createPdfViewer,
    type PdfViewerController,
    type PdfViewerHandle,
} from "../pdf/createPdfViewer";
import {usePdfDocument} from "../pdf/usePdfDocument";
import {installZoomInput} from "../pdf/zoomInput";
import {LoadingOverlay} from "./LoadingOverlay";
import {EmptyState} from "./pdf/EmptyState";

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
    let controller: PdfViewerController | null = null;

    const [ready, setReady] = createSignal(false);

    const pdf = usePdfDocument({
        url: () => props.url,
        ready,
        controller: () => controller,
        container: () => container,
        onPageChange: page => props.onPageChange(page),
        onPageCount: count => props.onPageCount(count),
    });

    onMount(() => {
        if (!container || !viewerElement) {
            return;
        }

        const created = createPdfViewer({
            container,
            viewerElement,
            onScaleChange: (scale, value) => props.onScaleChange(scale, value),
            onPageChange: page => props.onPageChange(page),
        });

        controller = created;

        const uninstallZoomInput = installZoomInput(container, created.zoomBy);
        const uninstallExternalLinks = installExternalLinkHandler(container);

        props.onReady(created.handle);
        setReady(true);

        onCleanup(() => {
            uninstallZoomInput();
            uninstallExternalLinks();
            created.destroy();
            controller = null;
            props.onReady(null);
        });
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

            <Show when={!pdf.hasDocument()}>
                <div class="absolute inset-0 grid place-items-center bg-surface-200">
                    <EmptyState />
                </div>
            </Show>

            <Show when={pdf.loading()}>
                <LoadingOverlay
                    backdropClass="bg-surface-100/60"
                    label="Loading PDF…"
                />
            </Show>

            <Show when={pdf.loadError()}>
                <div class="absolute inset-x-4 bottom-4 rounded-md border border-red-500/40 bg-danger-surface/90 p-3 text-sm text-danger-text shadow-xl">
                    Failed to load PDF: {pdf.loadError()}
                </div>
            </Show>
        </div>
    );
}
