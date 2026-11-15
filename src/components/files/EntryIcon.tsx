import FileIcon from "lucide-solid/icons/file";
import FolderIcon from "lucide-solid/icons/folder";

import {isTexFile} from "../../lib/fileKinds";
import type {DirEntry} from "../../lib/workspace";

/**
 * Leading icon of a tree row: a folder, a TeX badge, or a generic file.
 */
export function EntryIcon(props: {entry: DirEntry}) {
    if (props.entry.isDir) {
        return (
            <FolderIcon
                class="size-4 shrink-0 text-surface-500"
                aria-hidden="true"
            />
        );
    }

    if (isTexFile(props.entry.path)) {
        return (
            <span class="grid size-4 shrink-0 place-items-center rounded-xs bg-red-600/80 text-[7px] font-bold text-always-white">
                T
            </span>
        );
    }

    return (
        <FileIcon class="size-4 shrink-0 text-surface-500" aria-hidden="true" />
    );
}
