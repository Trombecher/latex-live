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

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const PAGE_GAP = 16;
const HORIZONTAL_PADDING = 32;

interface PdfPreviewProps {
    url: string | null;
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
            canvas.style.width = `${Math.floor(width)}px`;
            canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;

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
    let scrollContainer: HTMLDivElement | undefined;

    const [doc, setDoc] = createSignal<PDFDocumentProxy | null>(null);
    const [pageCount, setPageCount] = createSignal(0);
    const [pageWidth, setPageWidth] = createSignal(0);
    const [loadingDocument, setLoadingDocument] = createSignal(false);
    const [loadError, setLoadError] = createSignal<string | null>(null);

    onMount(() => {
        if (!scrollContainer) {
            return;
        }

        const updateWidth = () => {
            setPageWidth(
                Math.max(0, scrollContainer!.clientWidth - HORIZONTAL_PADDING),
            );
        };

        updateWidth();

        const observer = new ResizeObserver(updateWidth);
        observer.observe(scrollContainer);

        onCleanup(() => observer.disconnect());
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
        <div class="relative flex min-h-0 flex-1 flex-col">
            <div
                ref={element => {
                    scrollContainer = element;
                }}
                class="min-h-0 flex-1 overflow-auto bg-neutral-800 p-4"
            >
                <Show when={pageCount() > 0 && doc()} fallback={<EmptyState />}>
                    <div
                        class="mx-auto flex flex-col items-center"
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
