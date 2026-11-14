import FileIcon from "lucide-solid/icons/file";

import {fileExtension, fileName} from "../lib/files";
import type {DirEntry} from "../lib/workspace";

export function FilePlaceholder(props: {entry: DirEntry}) {
    const extension = () => fileExtension(props.entry.path);

    return (
        <div class="grid h-full place-items-center px-6 text-center">
            <div class="max-w-sm">
                <div class="mx-auto mb-4 grid size-12 place-items-center rounded-lg bg-surface-300/50 text-surface-600">
                    <FileIcon class="size-6" aria-hidden="true" />
                </div>
                <p class="truncate text-sm font-medium text-surface-800">
                    {fileName(props.entry.path)}
                </p>
                <p class="mt-1 text-xs leading-relaxed text-surface-500">
                    Preview for{" "}
                    {extension() ? `.${extension()} files` : "this file type"}{" "}
                    is not available yet.
                </p>
            </div>
        </div>
    );
}
