import {
    createEffect,
    createMemo,
    createSignal,
    on,
    onCleanup,
    onMount,
} from "solid-js";

import {errorMessage} from "../../lib/errors";
import {
    commitAndPush,
    fetchAndPull,
    initRepository,
    readGitStatus,
    setOrigin,
    type GitStatus,
} from "../../lib/git";
import {isStaged, isUnstaged} from "../../lib/gitStatus";

export type BusyKind = "init" | "remote" | "commit" | "pull" | null;

const REFRESH_INTERVAL_MS = 5000;

interface GitPanelOptions {
    workspace: {name: string; root: string} | null;
    /**
     * Save pending editor changes before a Git operation touches the working
     * tree. Returns false when saving failed, which cancels the operation.
     */
    onBeforeAction: () => Promise<boolean>;
}

/**
 * State and actions behind the source-control panel.
 *
 * The panel polls Git while it is visible, so the `setPanel` ref setter must be
 * attached to the element whose visibility decides whether polling continues.
 */
export function useGitPanel(props: GitPanelOptions) {
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

    const setPanel = (element: HTMLDivElement) => {
        panel = element;
    };

    const setRemoteInput = (element: HTMLInputElement) => {
        remoteInput = element;
    };

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
        () => status()?.changes.filter(isUnstaged) ?? [],
    );

    const stagedChanges = createMemo(
        () => status()?.changes.filter(isStaged) ?? [],
    );

    const hasChanges = () => (status()?.changes.length ?? 0) > 0;

    const repoReady = () => {
        const current = status();

        return current?.isRepo === true && !current.detached && busy() === null;
    };

    const canCommit = () => repoReady() && commitMessage().trim().length > 0;

    const canPull = () => repoReady() && status()?.originUrl !== null;

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

    return {
        status,
        loading,
        busy,
        loadError,
        actionError,
        message,
        commitMessage,
        setCommitMessage,
        editingRemote,
        remoteUrl,
        setRemoteUrl,
        unstagedChanges,
        stagedChanges,
        hasChanges,
        canCommit,
        canPull,
        shownError,
        refresh,
        initialize,
        startRemoteEdit,
        cancelRemoteEdit,
        saveRemote,
        commit,
        pull,
        setPanel,
        setRemoteInput,
    };
}
