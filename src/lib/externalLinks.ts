import {openUrl} from "@tauri-apps/plugin-opener";

const EXTERNAL_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Delegated `<a href>` click handler for rendered PDF pages.
 *
 * External links (hyperref, mailto, ...) must open outside the Tauri webview
 * instead of navigating the app away. Returns the cleanup function.
 */
export function installExternalLinkHandler(container: HTMLElement): () => void {
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

        // Never let a PDF link navigate the app webview away. Named actions,
        // destinations and attachments are handled by PDF.js itself and never
        // reach this point.
        event.preventDefault();

        if (!EXTERNAL_LINK_PROTOCOLS.has(url.protocol)) {
            console.warn(`Blocked unsupported PDF link: ${href}`);
            return;
        }

        void openUrl(url.href).catch(error => {
            console.error("Failed to open external link", error);
        });
    };

    container.addEventListener("click", handleLinkClick);

    return () => {
        container.removeEventListener("click", handleLinkClick);
    };
}
