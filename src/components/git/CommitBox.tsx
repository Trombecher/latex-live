import {Button} from "@kobalte/core/button";
import DownloadIcon from "lucide-solid/icons/download";
import UploadIcon from "lucide-solid/icons/upload";
import {Show} from "solid-js";

import type {GitStatus} from "../../lib/git";
import {primaryButton, secondaryButton} from "../ui/buttonStyles";
import type {BusyKind} from "./useGitPanel";

interface CommitBoxProps {
    status: GitStatus;
    busy: BusyKind;
    message: string;
    onMessageInput: (value: string) => void;
    canCommit: boolean;
    canPull: boolean;
    notice: string | null;
    error: string | null;
    onCommit: () => void;
    onPull: () => void;
}

/**
 * Commit message field with the commit and pull actions.
 */
export function CommitBox(props: CommitBoxProps) {
    return (
        <div class="shrink-0 border-t border-surface-300 p-2">
            <textarea
                value={props.message}
                onInput={event =>
                    props.onMessageInput(event.currentTarget.value)
                }
                onKeyDown={event => {
                    if (
                        (event.ctrlKey || event.metaKey)
                        && event.key === "Enter"
                    ) {
                        event.preventDefault();
                        props.onCommit();
                    }
                }}
                rows={3}
                placeholder="Commit message"
                spellcheck={false}
                class="min-h-16 w-full resize-none rounded-md border border-surface-300 bg-surface-50 p-2 text-sm text-surface-900 outline-none focus:border-blue-500"
            />

            <div class="mt-2 flex flex-col gap-1.5">
                <Button
                    class={`${primaryButton} h-8 w-full px-3 text-sm`}
                    disabled={!props.canCommit}
                    onClick={props.onCommit}
                >
                    <UploadIcon class="size-4" aria-hidden="true" />
                    {props.busy === "commit"
                        ? "Committing…"
                        : props.status.originUrl
                          ? "Commit & Push"
                          : "Commit"}
                </Button>
                <Button
                    class={`${secondaryButton} h-8 w-full px-3 text-sm`}
                    disabled={!props.canPull}
                    onClick={props.onPull}
                >
                    <DownloadIcon class="size-4" aria-hidden="true" />
                    {props.busy === "pull" ? "Fetching…" : "Fetch & Pull"}
                </Button>
            </div>

            <Show when={props.status.originUrl === null}>
                <p class="mt-1.5 text-xs leading-snug text-surface-500">
                    No origin remote is configured, so commits stay local. Add
                    one to enable pushing and pulling.
                </p>
            </Show>

            <Show when={props.status.detached}>
                <p class="mt-1.5 text-xs leading-snug text-surface-500">
                    Check out a branch before committing or pulling.
                </p>
            </Show>

            <Show when={props.notice}>
                {text => (
                    <p class="mt-2 text-xs leading-snug wrap-break-word whitespace-pre-wrap text-emerald-600 dark:text-emerald-400">
                        {text()}
                    </p>
                )}
            </Show>

            <Show when={props.busy === null && props.error}>
                {error => (
                    <p class="mt-2 max-h-32 overflow-auto text-xs leading-snug wrap-break-word whitespace-pre-wrap text-danger-text">
                        {error()}
                    </p>
                )}
            </Show>
        </div>
    );
}
