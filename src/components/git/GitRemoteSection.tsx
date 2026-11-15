import {Button} from "@kobalte/core/button";
import CloudIcon from "lucide-solid/icons/cloud";
import {Show} from "solid-js";

import type {GitStatus} from "../../lib/git";
import {outlineButton, primaryButton} from "../ui/buttonStyles";
import type {BusyKind} from "./useGitPanel";

interface GitRemoteSectionProps {
    status: GitStatus;
    busy: BusyKind;
    editing: boolean;
    url: string;
    onEdit: () => void;
    onCancel: () => void;
    onSave: (event: SubmitEvent) => void;
    onUrlInput: (value: string) => void;
    setInput: (element: HTMLInputElement) => void;
}

/**
 * The origin remote row and its inline editor.
 */
export function GitRemoteSection(props: GitRemoteSectionProps) {
    return (
        <div class="shrink-0 border-b border-surface-300 px-2 py-1.5 text-xs">
            <div class="flex items-center gap-1.5">
                <CloudIcon
                    class="size-3.5 shrink-0 text-surface-500"
                    aria-hidden="true"
                />
                <Show
                    when={props.status.originUrl}
                    fallback={
                        <span class="min-w-0 flex-1 truncate text-surface-500">
                            No remote configured
                        </span>
                    }
                >
                    {url => (
                        <span
                            class="min-w-0 flex-1 truncate text-surface-600"
                            title={url()}
                        >
                            {url()}
                        </span>
                    )}
                </Show>
                <button
                    type="button"
                    class="shrink-0 rounded px-1 py-0.5 text-blue-600 transition hover:bg-surface-200 dark:text-blue-400"
                    onClick={props.onEdit}
                >
                    {props.status.originUrl ? "Change" : "Add remote"}
                </button>
            </div>

            <Show when={props.editing}>
                <form
                    class="mt-1.5 flex flex-col gap-1.5"
                    onSubmit={props.onSave}
                >
                    <input
                        ref={props.setInput}
                        value={props.url}
                        onInput={event =>
                            props.onUrlInput(event.currentTarget.value)
                        }
                        placeholder="https://github.com/user/repo.git"
                        autocomplete="off"
                        spellcheck={false}
                        class="h-7 w-full rounded-md border border-surface-300 bg-surface-50 px-2 text-xs text-surface-900 outline-none focus:border-blue-500"
                    />
                    <div class="flex justify-end gap-1.5">
                        <Button
                            type="button"
                            class={`${outlineButton} h-7 px-2 text-xs`}
                            onClick={props.onCancel}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            class={`${primaryButton} h-7 px-2 text-xs`}
                            disabled={props.busy !== null || !props.url.trim()}
                        >
                            {props.busy === "remote" ? "Saving…" : "Save"}
                        </Button>
                    </div>
                </form>
            </Show>
        </div>
    );
}
