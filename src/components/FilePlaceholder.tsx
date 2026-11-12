import {fileExtension, fileName} from "../lib/files";
import type {DirEntry} from "../lib/workspace";

export function FilePlaceholder(props: {entry: DirEntry}) {
    const extension = () => fileExtension(props.entry.path);

    return (
        <div class="grid h-full place-items-center px-6 text-center">
            <div class="max-w-sm">
                <div class="mx-auto mb-4 grid size-12 place-items-center rounded-lg bg-neutral-700/50 text-neutral-400">
                    <FileIcon />
                </div>
                <p class="truncate text-sm font-medium text-neutral-200">
                    {fileName(props.entry.path)}
                </p>
                <p class="mt-1 text-xs leading-relaxed text-neutral-500">
                    Preview for{" "}
                    {extension() ? `.${extension()} files` : "this file type"}{" "}
                    is not available yet.
                </p>
            </div>
        </div>
    );
}

function FileIcon() {
    return (
        <svg
            viewBox="0 0 16 16"
            class="size-6"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M4 1.75C4 1.34 4.34 1 4.75 1h4.19c.2 0 .39.08.53.22l3.31 3.31c.14.14.22.33.22.53v9.19c0 .41-.34.75-.75.75h-7.5a.75.75 0 0 1-.75-.75V1.75Z" />
        </svg>
    );
}
