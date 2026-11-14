import {Button} from "@kobalte/core/button";
import CloudIcon from "lucide-solid/icons/cloud";
import DownloadIcon from "lucide-solid/icons/download";
import GitBranchIcon from "lucide-solid/icons/git-branch";
import GitBranchPlusIcon from "lucide-solid/icons/git-branch-plus";
import RefreshCwIcon from "lucide-solid/icons/refresh-cw";
import UploadIcon from "lucide-solid/icons/upload";
import {
    For,
    Show,
    createEffect,
    createMemo,
    createSignal,
    on,
    onCleanup,
    onMount,
    type JSX,
} from "solid-js";

import {errorMessage, fileName} from "../lib/files";
import {
    commitAndPush,
    fetchAndPull,
    initRepository,
    readGitStatus,
    setOrigin,
    type GitChange,
    type GitStatus,
} from "../lib/git";
import {Spinner} from "./Spinner";

interface GitPanelProps {
    workspace: {name: string; root: string} | null;
    onOpenFile: (path: string) => void;
    /**
     * Save pending editor changes before a Git operation touches the working
     * tree. Returns false when saving failed, which cancels the operation.
     */
    onBeforeAction: () => Promise<boolean>;
}

type BusyKind = "init" | "remote" | "commit" | "pull" | null;

const REFRESH_INTERVAL_MS = 5000;

export function GitPanel(props: GitPanelProps) {
    const [status, setStatus] = createSignal<GitStatus | null>(null);
    const [loading, setLoading] = createSignal(false);
    const [busy, setBusy] = createSignal<BusyKind>(null);
    const [loadError, setLoadError] = createSignal<string | null>(null);
    const [actionError, setActionError] = createSignal<string | null>(null);
    const [message, setMessage] = createSignal<string | null>(null);

    const [commitMessage, setCommitMessage] = createSignal("");
    const [editingRemote, setEditingRemote] = createSignal(false);
    const [remoteUrl, setRemoteUrl] = createSignal("");
    let remoteInput: HTMLInputElement | undefined;
    let panel: HTMLDivElement | undefined;
    let generation = 0;

    const refresh = async (showSpinner: boolean) => {
        if (!props.workspace) {
            setStatus(null);
            setLoading(false);
            return;
        }

        const current = ++generation;
        if (showSpinner) {
            setLoading(true);
        }

        try {
            const next = await readGitStatus();

            if (current !== generation) {
                return;
            }

            setStatus(next);
            setLoadError(null);
        } catch (cause) {
            if (current !== generation) {
                return;
            }

            setLoadError(errorMessage(cause));
        } finally {
            if (current === generation) {
                setLoading(false);
            }
        }
    };

    createEffect(
        on(
            () => props.workspace,
            () => {
                generation += 1;
                setStatus(null);
                setLoadError(null);
                setActionError(null);
                setMessage(null);
                setEditingRemote(false);
                setRemoteUrl("");
                void refresh(true);
            },
        ),
    );

    onMount(() => {
        const isVisible = () => panel?.offsetParent !== null;

        const timer = window.setInterval(() => {
            if (
                isVisible()
                && !busy()
                && status()?.isRepo
                && document.visibilityState === "visible"
                && document.hasFocus()
            ) {
                void refresh(false);
            }
        }, REFRESH_INTERVAL_MS);

        const handleFocus = () => {
            if (isVisible() && status()?.isRepo) {
                void refresh(false);
            }
        };

        window.addEventListener("focus", handleFocus);

        onCleanup(() => {
            window.clearInterval(timer);
            window.removeEventListener("focus", handleFocus);
        });
    });

    const unstagedChanges = createMemo(
        () =>
            status()?.changes.filter(
                change => change.index === "?" || change.worktree !== " ",
            ) ?? [],
    );

    const stagedChanges = createMemo(
        () =>
            status()?.changes.filter(
                change => change.index !== " " && change.index !== "?",
            ) ?? [],
    );

    const hasChanges = () => (status()?.changes.length ?? 0) > 0;

    const repoReady = () => {
        const current = status();

        return (
            current?.isRepo === true
            && current.originUrl !== null
            && !current.detached
            && busy() === null
        );
    };

    const canCommit = () => repoReady() && commitMessage().trim().length > 0;

    const canPull = () => repoReady();

    const branchLabel = () => {
        const current = status();

        if (!current?.isRepo) {
            return "";
        }

        if (current.detached) {
            return "Detached HEAD";
        }

        return current.branch ?? "No branch";
    };

    const initialize = async () => {
        if (busy()) {
            return;
        }

        setBusy("init");
        setActionError(null);
        setMessage(null);

        try {
            const next = await initRepository();
            setStatus(next);
            setLoadError(null);
            setMessage("Initialized an empty Git repository.");
        } catch (cause) {
            setActionError(errorMessage(cause));
        } finally {
            setBusy(null);
        }
    };

    const startRemoteEdit = () => {
        setRemoteUrl(status()?.originUrl ?? "");
        setEditingRemote(true);
        setActionError(null);

        queueMicrotask(() => {
            remoteInput?.focus();
            remoteInput?.select();
        });
    };

    const cancelRemoteEdit = () => {
        setEditingRemote(false);
        setRemoteUrl("");
    };

    const saveRemote = async (event: SubmitEvent) => {
        event.preventDefault();

        if (busy()) {
            return;
        }

        setBusy("remote");
        setActionError(null);
        setMessage(null);

        try {
            const next = await setOrigin(remoteUrl().trim());
            setStatus(next);
            setLoadError(null);
            setEditingRemote(false);
            setMessage("Saved the origin remote.");
        } catch (cause) {
            setActionError(errorMessage(cause));
        } finally {
            setBusy(null);
        }
    };

    const commit = async () => {
        if (!canCommit()) {
            return;
        }

        setBusy("commit");
        setActionError(null);
        setMessage(null);

        try {
            if (!(await props.onBeforeAction())) {
                return;
            }

            const result = await commitAndPush(commitMessage().trim());
            setStatus(result.status);
            setLoadError(null);
            setMessage(result.message);
            setCommitMessage("");
        } catch (cause) {
            setActionError(errorMessage(cause));
            void refresh(false);
        } finally {
            setBusy(null);
        }
    };

    const pull = async () => {
        if (!canPull()) {
            return;
        }

        setBusy("pull");
        setActionError(null);
        setMessage(null);

        try {
            if (!(await props.onBeforeAction())) {
                return;
            }

            const result = await fetchAndPull();
            setStatus(result.status);
            setLoadError(null);
            setMessage(result.message);
        } catch (cause) {
            setActionError(errorMessage(cause));
            void refresh(false);
        } finally {
            setBusy(null);
        }
    };

    const shownError = () => actionError() ?? loadError();

    return (
        <div
            ref={element => {
                panel = element;
            }}
            class="flex h-full min-h-0 flex-col"
        >
            <Show
                when={props.workspace}
                fallback={
                    <PanelNotice
                        title="No folder open"
                        description="Open a folder to use source control."
                    />
                }
            >
                <Show
                    when={status()}
                    fallback={
                        <Show
                            when={loadError()}
                            fallback={
                                <div class="grid h-full place-items-center">
                                    <Show when={loading()}>
                                        <Spinner />
                                    </Show>
                                </div>
                            }
                        >
                            {error => (
                                <PanelError
                                    error={error()}
                                    onRetry={() => void refresh(true)}
                                />
                            )}
                        </Show>
                    }
                >
                    {current => (
                        <Show
                            when={current().isRepo}
                            fallback={
                                <PanelNotice
                                    icon={
                                        <GitBranchPlusIcon
                                            class="mb-2 size-8 text-surface-500"
                                            aria-hidden="true"
                                        />
                                    }
                                    title="Not a Git repository"
                                    description="Initialize Git in this folder to track changes and publish your project."
                                    error={actionError()}
                                >
                                    <Button
                                        class="mt-3 inline-flex h-8 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-always-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                        disabled={busy() !== null}
                                        onClick={() => void initialize()}
                                    >
                                        <GitBranchPlusIcon
                                            class="size-4"
                                            aria-hidden="true"
                                        />
                                        {busy() === "init"
                                            ? "Initializing…"
                                            : "Initialize Repository"}
                                    </Button>
                                </PanelNotice>
                            }
                        >
                            <div class="flex h-full min-h-0 flex-col">
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

                                    <Show when={current().ahead > 0}>
                                        <span
                                            class="shrink-0 text-xs font-medium text-surface-500"
                                            title={`${current().ahead} commit(s) to push`}
                                        >
                                            ↑{current().ahead}
                                        </span>
                                    </Show>
                                    <Show when={current().behind > 0}>
                                        <span
                                            class="shrink-0 text-xs font-medium text-surface-500"
                                            title={`${current().behind} commit(s) to pull`}
                                        >
                                            ↓{current().behind}
                                        </span>
                                    </Show>

                                    <Button
                                        class="ml-auto grid size-6 shrink-0 place-items-center rounded text-surface-500 transition hover:bg-surface-200 hover:text-surface-700 disabled:opacity-50"
                                        title="Refresh source control"
                                        disabled={loading() || busy() !== null}
                                        onClick={() => void refresh(true)}
                                    >
                                        <RefreshCwIcon
                                            class="size-3.5"
                                            classList={{
                                                "animate-spin": loading(),
                                            }}
                                            aria-hidden="true"
                                        />
                                    </Button>
                                </div>

                                <div class="shrink-0 border-b border-surface-300 px-2 py-1.5 text-xs">
                                    <div class="flex items-center gap-1.5">
                                        <CloudIcon
                                            class="size-3.5 shrink-0 text-surface-500"
                                            aria-hidden="true"
                                        />
                                        <Show
                                            when={current().originUrl}
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
                                            onClick={startRemoteEdit}
                                        >
                                            {current().originUrl
                                                ? "Change"
                                                : "Add remote"}
                                        </button>
                                    </div>

                                    <Show when={editingRemote()}>
                                        <form
                                            class="mt-1.5 flex flex-col gap-1.5"
                                            onSubmit={event =>
                                                void saveRemote(event)
                                            }
                                        >
                                            <input
                                                ref={element => {
                                                    remoteInput = element;
                                                }}
                                                value={remoteUrl()}
                                                onInput={event =>
                                                    setRemoteUrl(
                                                        event.currentTarget
                                                            .value,
                                                    )
                                                }
                                                placeholder="https://github.com/user/repo.git"
                                                autocomplete="off"
                                                spellcheck={false}
                                                class="h-7 w-full rounded-md border border-surface-300 bg-surface-50 px-2 text-xs text-surface-900 outline-none focus:border-blue-500"
                                            />
                                            <div class="flex justify-end gap-1.5">
                                                <Button
                                                    type="button"
                                                    class="inline-flex h-7 items-center rounded-md border border-surface-300 px-2 text-xs text-surface-700 transition hover:border-surface-400 hover:bg-surface-200"
                                                    onClick={cancelRemoteEdit}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    class="inline-flex h-7 items-center rounded-md bg-blue-600 px-2 text-xs font-medium text-always-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                                    disabled={
                                                        busy() !== null
                                                        || !remoteUrl().trim()
                                                    }
                                                >
                                                    {busy() === "remote"
                                                        ? "Saving…"
                                                        : "Save"}
                                                </Button>
                                            </div>
                                        </form>
                                    </Show>
                                </div>

                                <div class="min-h-0 flex-1 overflow-auto">
                                    <Show
                                        when={hasChanges()}
                                        fallback={
                                            <p class="px-3 py-4 text-xs leading-relaxed text-surface-500">
                                                No changes. Working tree is
                                                clean.
                                            </p>
                                        }
                                    >
                                        <ChangeGroup
                                            title="Changes"
                                            changes={unstagedChanges()}
                                            onOpen={props.onOpenFile}
                                        />
                                        <Show when={stagedChanges().length > 0}>
                                            <ChangeGroup
                                                title="Staged Changes"
                                                changes={stagedChanges()}
                                                onOpen={props.onOpenFile}
                                            />
                                        </Show>
                                    </Show>
                                </div>

                                <div class="shrink-0 border-t border-surface-300 p-2">
                                    <textarea
                                        value={commitMessage()}
                                        onInput={event =>
                                            setCommitMessage(
                                                event.currentTarget.value,
                                            )
                                        }
                                        onKeyDown={event => {
                                            if (
                                                (event.ctrlKey || event.metaKey)
                                                && event.key === "Enter"
                                            ) {
                                                event.preventDefault();
                                                void commit();
                                            }
                                        }}
                                        rows={3}
                                        placeholder="Commit message"
                                        spellcheck={false}
                                        class="min-h-16 w-full resize-none rounded-md border border-surface-300 bg-surface-50 p-2 text-sm text-surface-900 outline-none focus:border-blue-500"
                                    />

                                    <div class="mt-2 flex flex-col gap-1.5">
                                        <Button
                                            class="inline-flex h-8 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-always-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                            disabled={!canCommit()}
                                            onClick={() => void commit()}
                                        >
                                            <UploadIcon
                                                class="size-4"
                                                aria-hidden="true"
                                            />
                                            {busy() === "commit"
                                                ? "Committing…"
                                                : "Commit & Push"}
                                        </Button>
                                        <Button
                                            class="inline-flex h-8 w-full items-center justify-center gap-2 rounded-md border border-surface-300 bg-surface-200 px-3 text-sm font-medium text-surface-800 transition hover:border-surface-400 hover:bg-surface-300 disabled:cursor-not-allowed disabled:opacity-50"
                                            disabled={!canPull()}
                                            onClick={() => void pull()}
                                        >
                                            <DownloadIcon
                                                class="size-4"
                                                aria-hidden="true"
                                            />
                                            {busy() === "pull"
                                                ? "Fetching…"
                                                : "Fetch & Pull"}
                                        </Button>
                                    </div>

                                    <Show when={current().originUrl === null}>
                                        <p class="mt-1.5 text-xs leading-snug text-surface-500">
                                            Add an origin remote before
                                            committing or pulling.
                                        </p>
                                    </Show>

                                    <Show when={current().detached}>
                                        <p class="mt-1.5 text-xs leading-snug text-surface-500">
                                            Check out a branch before committing
                                            or pulling.
                                        </p>
                                    </Show>

                                    <Show when={message()}>
                                        {text => (
                                            <p class="mt-2 text-xs leading-snug wrap-break-word whitespace-pre-wrap text-emerald-600 dark:text-emerald-400">
                                                {text()}
                                            </p>
                                        )}
                                    </Show>

                                    <Show when={!busy() && shownError()}>
                                        {error => (
                                            <p class="mt-2 max-h-32 overflow-auto text-xs leading-snug wrap-break-word whitespace-pre-wrap text-danger-text">
                                                {error()}
                                            </p>
                                        )}
                                    </Show>
                                </div>
                            </div>
                        </Show>
                    )}
                </Show>
            </Show>
        </div>
    );
}

function ChangeGroup(props: {
    title: string;
    changes: GitChange[];
    onOpen: (path: string) => void;
}) {
    return (
        <div>
            <div class="sticky top-0 z-10 flex h-7 items-center justify-between border-b border-surface-300/60 bg-surface-100 px-2 text-[11px] font-semibold tracking-wide text-surface-500 uppercase">
                <span>{props.title}</span>
                <span>{props.changes.length}</span>
            </div>
            <For each={props.changes}>
                {change => <ChangeRow change={change} onOpen={props.onOpen} />}
            </For>
        </div>
    );
}

function ChangeRow(props: {change: GitChange; onOpen: (path: string) => void}) {
    const openable = () => props.change.status !== "D";
    const directory = () => parentDirectory(props.change.path);
    const title = () =>
        props.change.origPath
            ? `${props.change.origPath} → ${props.change.path}`
            : props.change.path;

    return (
        <Button
            class="flex h-7 w-full items-center gap-2 px-2 text-left text-sm transition-colors"
            classList={{
                "hover:bg-surface-200": openable(),
                "cursor-default": !openable(),
            }}
            disabled={!openable()}
            title={title()}
            onClick={() => {
                if (openable()) {
                    props.onOpen(props.change.path);
                }
            }}
        >
            <span class="w-4 shrink-0 text-center font-mono text-xs font-bold">
                <span class={statusColor(props.change.status)}>
                    {badgeLabel(props.change.status)}
                </span>
            </span>
            <span class="min-w-0 flex-1 truncate text-surface-800">
                {fileName(props.change.path)}
            </span>
            <Show when={directory()}>
                {parent => (
                    <span class="max-w-[45%] shrink-0 truncate text-xs text-surface-500">
                        {parent()}
                    </span>
                )}
            </Show>
        </Button>
    );
}

function PanelNotice(props: {
    icon?: JSX.Element;
    title: string;
    description: string;
    error?: string | null;
    children?: JSX.Element;
}) {
    return (
        <div class="flex h-full flex-col items-center justify-center px-4 text-center">
            {props.icon}
            <p class="text-sm font-medium text-surface-700">{props.title}</p>
            <p class="mt-1 text-xs leading-relaxed text-surface-500">
                {props.description}
            </p>
            {props.children}
            <Show when={props.error}>
                {error => (
                    <p class="mt-2 text-xs leading-snug wrap-break-word whitespace-pre-wrap text-danger-text">
                        {error()}
                    </p>
                )}
            </Show>
        </div>
    );
}

function PanelError(props: {error: string; onRetry: () => void}) {
    return (
        <div class="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <p class="text-xs leading-snug wrap-break-word whitespace-pre-wrap text-danger-text">
                {props.error}
            </p>
            <Button
                class="inline-flex h-8 items-center rounded-md border border-surface-300 px-3 text-sm text-surface-700 transition hover:border-surface-400 hover:bg-surface-200"
                onClick={props.onRetry}
            >
                Retry
            </Button>
        </div>
    );
}

/**
 * The containing directory of a relative path, or an empty string.
 */
function parentDirectory(path: string): string {
    const slash = path.lastIndexOf("/");
    return slash === -1 ? "" : path.slice(0, slash);
}

/**
 * Visual Studio Code shows untracked files as "U".
 */
function badgeLabel(status: string): string {
    return status === "?" ? "U" : status;
}

function statusColor(status: string): string {
    switch (status) {
        case "M":
            return "text-amber-600 dark:text-amber-400";
        case "A":
            return "text-emerald-600 dark:text-emerald-400";
        case "D":
            return "text-danger-text";
        case "R":
            return "text-blue-600 dark:text-blue-400";
        case "C":
            return "text-cyan-600 dark:text-cyan-400";
        case "U":
            return "text-danger-text-strong";
        default:
            return "text-surface-500";
    }
}
