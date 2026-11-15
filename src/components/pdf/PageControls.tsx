import ChevronLeftIcon from "lucide-solid/icons/chevron-left";
import ChevronRightIcon from "lucide-solid/icons/chevron-right";

import {IconButton} from "../ui/TooltipButton";

interface PageControlsProps {
    pageNumber: number;
    pageCount: number;
    onPreviousPage: () => void;
    onNextPage: () => void;
}

/**
 * Previous/next page buttons plus the compact page counter shown until the
 * toolbar is wide enough for the full controls.
 */
export function PageControls(props: PageControlsProps) {
    return (
        <>
            <div class="hidden items-center gap-1 @min-[38rem]:flex">
                <IconButton
                    label="Previous page"
                    disabled={props.pageNumber <= 1}
                    onClick={props.onPreviousPage}
                >
                    <ChevronLeftIcon class="size-3.5" aria-hidden="true" />
                </IconButton>

                <span class="inline-flex h-7 min-w-12 items-center justify-center rounded-md border border-surface-300 bg-surface-200 px-1.5 text-[11px] text-surface-700 tabular-nums">
                    {props.pageNumber} / {props.pageCount}
                </span>

                <IconButton
                    label="Next page"
                    disabled={props.pageNumber >= props.pageCount}
                    onClick={props.onNextPage}
                >
                    <ChevronRightIcon class="size-3.5" aria-hidden="true" />
                </IconButton>
            </div>

            <span class="hidden rounded bg-surface-200 px-2 py-1 text-[11px] text-surface-600 @sm:inline-block @min-[38rem]:hidden">
                {props.pageCount} {props.pageCount === 1 ? "page" : "pages"}
            </span>
        </>
    );
}
