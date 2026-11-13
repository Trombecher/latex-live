import {Show} from "solid-js";

export function ErrorPanel(props: {error: string | null}) {
    return (
        <Show when={props.error}>
            <section class="max-h-[45%] shrink-0 overflow-auto border-t border-red-500/30 bg-red-950/40">
                <div class="sticky top-0 flex items-center justify-between border-b border-red-500/20 bg-red-950/90 px-3 py-2">
                    <span class="text-xs font-semibold tracking-wide text-red-300 uppercase">
                        Compilation failed
                    </span>
                </div>
                <pre class="p-3 font-mono text-xs leading-relaxed wrap-break-word whitespace-pre-wrap text-red-100/90">
                    {props.error}
                </pre>
            </section>
        </Show>
    );
}
