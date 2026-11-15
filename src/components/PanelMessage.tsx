import {Button} from "@kobalte/core/button";
import {Show, type JSX} from "solid-js";

import {outlineButton} from "./ui/buttonStyles";

interface PanelNoticeProps {
    icon?: JSX.Element;
    title: string;
    description: string;
    error?: string | null;
    children?: JSX.Element;
}

/**
 * Centered empty or setup state for a sidebar panel.
 */
export function PanelNotice(props: PanelNoticeProps) {
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

interface PanelErrorProps {
    error: string;
    onRetry: () => void;
}

/**
 * Centered load error with a retry button.
 */
export function PanelError(props: PanelErrorProps) {
    return (
        <div class="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <p class="text-xs leading-snug wrap-break-word whitespace-pre-wrap text-danger-text">
                {props.error}
            </p>
            <Button
                class={`${outlineButton} h-8 px-3 text-sm`}
                onClick={props.onRetry}
            >
                Retry
            </Button>
        </div>
    );
}
