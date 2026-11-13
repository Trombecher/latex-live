import {Button} from "@kobalte/core/button";
import {Dialog} from "@kobalte/core/dialog";
import {Show, createEffect, createSignal, createUniqueId, on} from "solid-js";

interface NameDialogProps {
    open: boolean;
    title: string;
    description: string;
    initialName: string;
    confirmLabel: string;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onSubmit: (name: string) => void;
}

/**
 * Single-field dialog used to create and rename files.
 */
export function NameDialog(props: NameDialogProps) {
    const inputId = createUniqueId();
    const [value, setValue] = createSignal(props.initialName);
    let input: HTMLInputElement | undefined;

    createEffect(
        on(
            () => props.open,
            open => {
                if (!open) {
                    return;
                }

                setValue(props.initialName);

                queueMicrotask(() => {
                    if (!input) {
                        return;
                    }

                    input.focus();
                    const dot = props.initialName.lastIndexOf(".");
                    input.setSelectionRange(
                        0,
                        dot > 0 ? dot : props.initialName.length,
                    );
                });
            },
        ),
    );

    const submit = (event: SubmitEvent) => {
        event.preventDefault();

        const name = value().trim();
        if (!name || props.busy) {
            return;
        }

        props.onSubmit(name);
    };

    return (
        <Dialog
            open={props.open}
            onOpenChange={open => {
                if (!open) {
                    props.onClose();
                }
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay class="fixed inset-0 z-40 bg-black/60" />
                <Dialog.Content class="fixed top-1/2 left-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-700 bg-neutral-900 p-4 shadow-2xl outline-none">
                    <Dialog.Title class="text-sm font-semibold text-neutral-100">
                        {props.title}
                    </Dialog.Title>
                    <Dialog.Description class="mt-1 text-xs leading-relaxed text-neutral-500">
                        {props.description}
                    </Dialog.Description>

                    <form class="mt-3" onSubmit={submit}>
                        <label
                            for={inputId}
                            class="block text-xs font-medium text-neutral-400"
                        >
                            File name
                        </label>
                        <input
                            id={inputId}
                            ref={element => {
                                input = element;
                            }}
                            value={value()}
                            onInput={event =>
                                setValue(event.currentTarget.value)
                            }
                            autocomplete="off"
                            spellcheck={false}
                            class="mt-1 h-8 w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 text-sm text-neutral-100 outline-none focus:border-blue-500"
                        />

                        <Show when={props.error}>
                            {error => (
                                <p class="mt-2 text-xs leading-snug text-red-300">
                                    {error()}
                                </p>
                            )}
                        </Show>

                        <div class="mt-4 flex justify-end gap-2">
                            <Button
                                class="inline-flex h-8 items-center rounded-md border border-neutral-700 px-3 text-sm text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-800"
                                onClick={props.onClose}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={props.busy || !value().trim()}
                                class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {props.busy ? "Working…" : props.confirmLabel}
                            </Button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog>
    );
}
