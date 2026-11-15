import {Logo} from "./Logo";

export function EditorEmptyState(props: {hasWorkspace: boolean}) {
    return (
        <div class="grid h-full place-items-center px-6 text-center">
            <div class="max-w-sm">
                <Logo class="mx-auto mb-4 block size-12 rounded-lg" />
                <p class="text-sm font-medium text-surface-700">
                    {props.hasWorkspace ? "No file selected" : "No folder open"}
                </p>
                <p class="mt-1 text-xs leading-relaxed text-surface-500">
                    {props.hasWorkspace
                        ? "Choose a text file from the sidebar to start editing."
                        : "Open a folder to browse your LaTeX project."}
                </p>
            </div>
        </div>
    );
}
