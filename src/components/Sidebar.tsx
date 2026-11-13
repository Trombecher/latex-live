import {Button} from "@kobalte/core/button";
import {Show, createSignal} from "solid-js";

import type {DirEntry} from "../lib/workspace";
import {FileTree} from "./FileTree";
import {Logo} from "./Logo";

interface SidebarProps {
    workspace: {name: string; root: string} | null;
    entries: DirEntry[];
    selectedPath: string | null;
    dirty: boolean;
    error: string | null;
    onOpenFolder: () => void;
    onSelectFile: (entry: DirEntry) => void;
}

export function Sidebar(props: SidebarProps) {
    const [treeError, setTreeError] = createSignal<string | null>(null);

    const shownError = () => treeError() ?? props.error;

    return (
        <aside class="flex w-60 shrink-0 flex-col border-r border-neutral-700 bg-neutral-900">
            <div class="flex h-12 shrink-0 items-center gap-2 border-b border-neutral-700 px-3">
                <Logo class="size-6 rounded" />
                <h1 class="text-xl font-semibold tracking-tight text-neutral-100">
                    Latex Live
                </h1>
            </div>

            <div class="flex h-10 shrink-0 items-center px-2">
                <span
                    class="min-w-0 flex-1 truncate text-xs font-semibold tracking-wide text-neutral-400 uppercase"
                    title={props.workspace?.root}
                >
                    {props.workspace?.name ?? "No folder open"}
                </span>
            </div>

            <div class="shrink-0 border-b border-neutral-700 p-2">
                <Button
                    class="inline-flex h-8 w-full items-center justify-center gap-2 rounded-md border border-neutral-700 bg-neutral-800 px-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-700"
                    onClick={props.onOpenFolder}
                >
                    <FolderOpenIcon />
                    {props.workspace ? "Change Folder" : "Open Folder"}
                </Button>
            </div>

            <div class="min-h-0 flex-1 overflow-auto">
                <Show
                    when={props.workspace}
                    fallback={
                        <div class="flex h-full flex-col items-center justify-center px-4 text-center">
                            <p class="text-sm leading-relaxed text-neutral-500">
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
                        onError={setTreeError}
                    />
                </Show>
            </div>

            <Show when={shownError()}>
                <div class="wrap-break-words shrink-0 border-t border-red-500/30 bg-red-950/40 px-2 py-2 text-xs leading-snug text-red-200">
                    {shownError()}
                </div>
            </Show>
        </aside>
    );
}

function FolderOpenIcon() {
    return (
        <svg
            viewBox="0 0 16 16"
            class="size-4"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M1.5 3.25c0-.69.56-1.25 1.25-1.25h3.2c.33 0 .65.13.88.37l.96.96c.1.1.23.17.37.17h5.09c.69 0 1.25.56 1.25 1.25v.75H2.75c-.69 0-1.25.56-1.25 1.25v-3.5Z" />
            <path d="M1.5 6.5c0-.69.56-1.25 1.25-1.25h11.5c.69 0 1.25.56 1.25 1.25v6.25c0 .69-.56 1.25-1.25 1.25H2.75c-.69 0-1.25-.56-1.25-1.25V6.5Z" />
        </svg>
    );
}
