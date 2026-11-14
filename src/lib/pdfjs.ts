import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
    EventBus,
    PDFLinkService,
    PDFViewer,
} from "pdfjs-dist/web/pdf_viewer.mjs";

// `pdf_viewer.mjs` reads its dependencies from `globalThis.pdfjsLib`, which is
// populated when the core `pdfjs-dist` module is evaluated. Keep this import
// order: the core module must be evaluated before the viewer module.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export {EventBus, PDFLinkService, PDFViewer, pdfjs};
export type {PDFDocumentProxy} from "pdfjs-dist";
