import {Button} from "@kobalte/core/button";
import {Tabs} from "@kobalte/core/tabs";
import FilesIcon from "lucide-solid/icons/files";
import FolderOpenIcon from "lucide-solid/icons/folder-open";
import GitBranchIcon from "lucide-solid/icons/git-branch";
import {Show, createSignal} from "solid-js";

import type {DirEntry} from "../lib/workspace";
import {FileTree} from "./FileTree";
import {GitPanel} from "./GitPanel";
import {Logo} from "./Logo";

interface SidebarProps {
    workspace: {name: string; root: string} | null;
    entries: DirEntry[];
    selectedPath: string | null;
    dirty: boolean;
    error: string | null;
    onOpenFolder: () => void;
    onSelectFile: (entry: DirEntry) => void;
    onRefreshRoot: () => Promise<void>;
    onRenamed: (oldPath: string, newPath: string) => void;
    onDeleted: (path: string) => void;
    onGitOpenFile: (path: string) => void;
    onBeforeGitAction: () => Promise<boolean>;
}

const TAB_CLASS =
    "flex flex-1 items-center justify-center gap-1.5 border-b-2 border-transparent text-xs font-medium text-surface-500 transition hover:text-surface-800 data-selected:border-blue-500 data-selected:text-surface-900";

export function Sidebar(props: SidebarProps) {
    const [treeError, setTreeError] = createSignal<string | null>(null);

    const shownError = () => treeError() ?? props.error;

    return (
        <aside class="flex w-60 shrink-0 flex-col border-r border-surface-300 bg-surface-100">
            <div class="flex h-12 shrink-0 items-center gap-2 border-b border-surface-300 px-3">
                <Logo class="size-6 rounded" />
                <h1 class="text-xl font-semibold tracking-tight text-surface-900">
                    Latex Live
                </h1>
            </div>

            <Tabs defaultValue="files" class="flex min-h-0 flex-1 flex-col">
                <Tabs.List
                    aria-label="Sidebar view"
                    class="flex h-9 shrink-0 border-b border-surface-300"
                >
                    <Tabs.Trigger value="files" class={TAB_CLASS}>
                        <FilesIcon class="size-3.5" aria-hidden="true" />
                        Files
                    </Tabs.Trigger>
                    <Tabs.Trigger value="git" class={TAB_CLASS}>
                        <GitBranchIcon class="size-3.5" aria-hidden="true" />
                        Git
                    </Tabs.Trigger>
                </Tabs.List>

                <div class="flex h-10 shrink-0 items-center px-2">
                    <span
                        class="min-w-0 flex-1 truncate text-xs font-semibold tracking-wide text-surface-600 uppercase"
                        title={props.workspace?.root}
                    >
                        {props.workspace?.name ?? "No folder open"}
                    </span>
                </div>

                <div class="shrink-0 border-b border-surface-300 p-2">
                    <Button
                        class="inline-flex h-8 w-full items-center justify-center gap-2 rounded-md border border-surface-300 bg-surface-200 px-3 text-sm font-medium text-surface-800 transition hover:border-surface-400 hover:bg-surface-300"
                        onClick={props.onOpenFolder}
                    >
                        <FolderOpenIcon class="size-4" aria-hidden="true" />
                        {props.workspace ? "Change Folder" : "Open Folder"}
                    </Button>
                </div>

                <Tabs.Content
                    value="files"
                    forceMount
                    class="hidden min-h-0 flex-1 overflow-auto data-selected:block"
                >
                    <Show
                        when={props.workspace}
                        fallback={
                            <div class="flex h-full flex-col items-center justify-center px-4 text-center">
                                <p class="text-sm leading-relaxed text-surface-500">
                                    Open a folder to browse your LaTeX project.
                                </p>
                            </div>
                        }
                    >
                        <FileTree
                            entries={props.entries}
                            workspaceRoot={props.workspace?.root ?? null}
                            selectedPath={props.selectedPath}
                            dirty={props.dirty}
                            onSelect={props.onSelectFile}
                            onRefreshRoot={props.onRefreshRoot}
                            onRenamed={props.onRenamed}
                            onDeleted={props.onDeleted}
                            onError={setTreeError}
                        />
                    </Show>
                </Tabs.Content>

                <Tabs.Content
                    value="git"
                    forceMount
                    class="hidden min-h-0 flex-1 overflow-hidden data-selected:block"
                >
                    <GitPanel
                        workspace={props.workspace}
                        onOpenFile={props.onGitOpenFile}
                        onBeforeAction={props.onBeforeGitAction}
                    />
                </Tabs.Content>
            </Tabs>

            <Show when={shownError()}>
                <div class="shrink-0 border-t border-red-500/30 bg-danger-surface/40 p-2 text-xs leading-snug wrap-break-word text-danger-text">
                    {shownError()}
                </div>
            </Show>
        </aside>
    );
}
