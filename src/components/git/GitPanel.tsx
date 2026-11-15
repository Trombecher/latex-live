import {Button} from "@kobalte/core/button";
import GitBranchPlusIcon from "lucide-solid/icons/git-branch-plus";
import {Show} from "solid-js";

import {PanelError, PanelNotice} from "../PanelMessage";
import {Spinner} from "../Spinner";
import {primaryButton} from "../ui/buttonStyles";
import {ChangeList} from "./ChangeList";
import {CommitBox} from "./CommitBox";
import {GitBranchBar} from "./GitBranchBar";
import {GitRemoteSection} from "./GitRemoteSection";
import {useGitPanel} from "./useGitPanel";

interface GitPanelProps {
    workspace: {name: string; root: string} | null;
    onOpenFile: (path: string) => void;
    /**
     * Save pending editor changes before a Git operation touches the working
     * tree. Returns false when saving failed, which cancels the operation.
     */
    onBeforeAction: () => Promise<boolean>;
}

export function GitPanel(props: GitPanelProps) {
    const git = useGitPanel(props);

    return (
        <div ref={git.setPanel} class="flex h-full min-h-0 flex-col">
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
                    when={git.status()}
                    fallback={
                        <Show
                            when={git.loadError()}
                            fallback={
                                <div class="grid h-full place-items-center">
                                    <Show when={git.loading()}>
                                        <Spinner />
                                    </Show>
                                </div>
                            }
                        >
                            {error => (
                                <PanelError
                                    error={error()}
                                    onRetry={() => void git.refresh(true)}
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
                                    error={git.actionError()}
                                >
                                    <Button
                                        class={`${primaryButton} mt-3 h-8 px-3 text-sm`}
                                        disabled={git.busy() !== null}
                                        onClick={() => void git.initialize()}
                                    >
                                        <GitBranchPlusIcon
                                            class="size-4"
                                            aria-hidden="true"
                                        />
                                        {git.busy() === "init"
                                            ? "Initializing…"
                                            : "Initialize Repository"}
                                    </Button>
                                </PanelNotice>
                            }
                        >
                            <div class="flex h-full min-h-0 flex-col">
                                <GitBranchBar
                                    status={current()}
                                    loading={git.loading()}
                                    busy={git.busy()}
                                    onRefresh={() => void git.refresh(true)}
                                />
                                <GitRemoteSection
                                    status={current()}
                                    busy={git.busy()}
                                    editing={git.editingRemote()}
                                    url={git.remoteUrl()}
                                    onEdit={git.startRemoteEdit}
                                    onCancel={git.cancelRemoteEdit}
                                    onSave={git.saveRemote}
                                    onUrlInput={git.setRemoteUrl}
                                    setInput={git.setRemoteInput}
                                />
                                <div class="min-h-0 flex-1 overflow-auto">
                                    <ChangeList
                                        unstaged={git.unstagedChanges()}
                                        staged={git.stagedChanges()}
                                        onOpen={props.onOpenFile}
                                    />
                                </div>
                                <CommitBox
                                    status={current()}
                                    busy={git.busy()}
                                    message={git.commitMessage()}
                                    onMessageInput={git.setCommitMessage}
                                    canCommit={git.canCommit()}
                                    canPull={git.canPull()}
                                    notice={git.message()}
                                    error={git.shownError()}
                                    onCommit={() => void git.commit()}
                                    onPull={() => void git.pull()}
                                />
                            </div>
                        </Show>
                    )}
                </Show>
            </Show>
        </div>
    );
}
