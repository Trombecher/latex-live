import {Button} from "@kobalte/core/button";
import GitBranchIcon from "lucide-solid/icons/git-branch";
import RefreshCwIcon from "lucide-solid/icons/refresh-cw";
import {Show} from "solid-js";

import type {GitStatus} from "../../lib/git";
import type {BusyKind} from "./useGitPanel";

interface GitBranchBarProps {
    status: GitStatus;
    loading: boolean;
    busy: BusyKind;
    onRefresh: () => void;
}

/**
 * Current branch, its distance from the remote, and the refresh action.
 */
export function GitBranchBar(props: GitBranchBarProps) {
    const branchLabel = () => {
        if (props.status.detached) {
            return "Detached HEAD";
        }

        return props.status.branch ?? "No branch";
    };

    return (
        <div class="flex h-9 shrink-0 items-center gap-1.5 border-b border-surface-300 px-2">
            <GitBranchIcon
                class="size-4 shrink-0 text-surface-500"
                aria-hidden="true"
            />
            <span
                class="min-w-0 truncate text-sm font-medium text-surface-800"
                title={branchLabel()}
            >
                {branchLabel()}
            </span>

            <Show when={props.status.ahead > 0}>
                <span
                    class="shrink-0 text-xs font-medium text-surface-500"
                    title={`${props.status.ahead} commit(s) to push`}
                >
                    ↑{props.status.ahead}
                </span>
            </Show>
            <Show when={props.status.behind > 0}>
                <span
                    class="shrink-0 text-xs font-medium text-surface-500"
                    title={`${props.status.behind} commit(s) to pull`}
                >
                    ↓{props.status.behind}
                </span>
            </Show>

            <Button
                class="ml-auto grid size-6 shrink-0 place-items-center rounded text-surface-500 transition hover:bg-surface-200 hover:text-surface-700 disabled:opacity-50"
                title="Refresh source control"
                disabled={props.loading || props.busy !== null}
                onClick={props.onRefresh}
            >
                <RefreshCwIcon
                    class="size-3.5"
                    classList={{"animate-spin": props.loading}}
                    aria-hidden="true"
                />
            </Button>
        </div>
    );
}
