import {createEffect, createSignal, on} from "solid-js";

import type {PdfViewerHandle} from "../pdf/createPdfViewer";
import {ErrorPanel} from "./ErrorPanel";
import {PaneSeparator} from "./PaneSeparator";
import {PdfPreview} from "./PdfPreview";
import {PreviewToolbar} from "./PreviewToolbar";

interface PreviewPaneProps {
    pdfUrl: string | null;
    compiling: boolean;
    canCompile: boolean;
    error: string | null;
    onCompile: () => void;
    onExport: () => void;
}

/**
 * The PDF pane: viewer, toolbar, compile errors and the separator that sizes
 * it. Owns the viewer-facing controls so the rest of the app only deals with
 * the PDF URL and compile state.
 */
export function PreviewPane(props: PreviewPaneProps) {
    const [previewRatio, setPreviewRatio] = createSignal(0.5);
    const [zoom, setZoom] = createSignal(1);
    const [scaleValue, setScaleValue] = createSignal("page-width");
    const [pageNumber, setPageNumber] = createSignal(1);
    const [pageCount, setPageCount] = createSignal(0);
    const [viewerHandle, setViewerHandle] =
        createSignal<PdfViewerHandle | null>(null);

    // Closing the document (switching or clearing files) resets the view
    // controls. PdfPreview resets the page counters when its document is
    // cleared.
    createEffect(
        on(
            () => props.pdfUrl,
            url => {
                if (url !== null) {
                    return;
                }

                setZoom(1);
                setScaleValue("page-width");
            },
            {defer: true},
        ),
    );

    return (
        <>
            <PaneSeparator ratio={previewRatio()} onChange={setPreviewRatio} />

            <section
                class="flex min-w-0 flex-col bg-surface-200"
                style={{width: `${previewRatio() * 100}%`}}
            >
                <PreviewToolbar
                    canCompile={props.canCompile}
                    compiling={props.compiling}
                    pageNumber={pageNumber()}
                    pageCount={pageCount()}
                    zoom={zoom()}
                    scaleValue={scaleValue()}
                    onZoomIn={() => viewerHandle()?.zoomIn()}
                    onZoomOut={() => viewerHandle()?.zoomOut()}
                    onScaleChange={value =>
                        viewerHandle()?.setScaleValue(value)
                    }
                    onPreviousPage={() => viewerHandle()?.previousPage()}
                    onNextPage={() => viewerHandle()?.nextPage()}
                    onCompile={props.onCompile}
                    onExport={props.onExport}
                />
                <PdfPreview
                    url={props.pdfUrl}
                    onReady={handle => setViewerHandle(handle)}
                    onScaleChange={(scale, value) => {
                        setZoom(scale);
                        setScaleValue(value);
                    }}
                    onPageChange={setPageNumber}
                    onPageCount={count => setPageCount(count)}
                />
                <ErrorPanel error={props.error} />
            </section>
        </>
    );
}
