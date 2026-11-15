import {createSignal, onCleanup} from "solid-js";

export interface PdfUrlOwner {
    url: () => string | null;
    replace: (url: string | null) => void;
    dispose: () => void;
}

/**
 * Owns the object URLs behind the PDF preview.
 *
 * A replaced URL stays alive until the next replacement: the viewer may still
 * lazily fetch pages from the previous document.
 */
export function createPdfUrl(): PdfUrlOwner {
    const [url, setUrl] = createSignal<string | null>(null);

    let current: string | null = null;
    let previous: string | null = null;

    const replace = (next: string | null) => {
        // The viewer may still lazily fetch pages from the previous document,
        // so keep the immediately previous URL alive until the next compile.
        if (previous) {
            URL.revokeObjectURL(previous);
            previous = null;
        }

        if (!next) {
            if (current) {
                URL.revokeObjectURL(current);
                current = null;
            }
        } else {
            previous = current;
            current = next;
        }

        setUrl(next);
    };

    const dispose = () => {
        if (previous) {
            URL.revokeObjectURL(previous);
            previous = null;
        }

        if (current) {
            URL.revokeObjectURL(current);
            current = null;
        }

        setUrl(null);
    };

    onCleanup(dispose);

    return {url, replace, dispose};
}
