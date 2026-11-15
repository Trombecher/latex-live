import {Button} from "@kobalte/core/button";
import {Tooltip} from "@kobalte/core/tooltip";
import type {JSX} from "solid-js";

import {iconButton} from "./buttonStyles";

interface TooltipButtonProps {
    label: string;
    class: string;
    disabled?: boolean;
    onClick: () => void;
    children: JSX.Element;
}

/**
 * A button that reveals its label in a tooltip on hover.
 */
export function TooltipButton(props: TooltipButtonProps) {
    return (
        <Tooltip openDelay={400}>
            <Tooltip.Trigger
                as={Button}
                class={props.class}
                disabled={props.disabled}
                aria-label={props.label}
                onClick={props.onClick}
            >
                {props.children}
            </Tooltip.Trigger>
            <Tooltip.Portal>
                <Tooltip.Content class="z-50 rounded-md border border-surface-300 bg-surface-100 px-2 py-1 text-[11px] text-surface-800 shadow-lg">
                    {props.label}
                </Tooltip.Content>
            </Tooltip.Portal>
        </Tooltip>
    );
}

interface IconButtonProps {
    label: string;
    disabled?: boolean;
    onClick: () => void;
    children: JSX.Element;
}

/**
 * A small bordered icon button with a tooltip, used in toolbars.
 */
export function IconButton(props: IconButtonProps) {
    return (
        <TooltipButton
            label={props.label}
            disabled={props.disabled}
            class={iconButton}
            onClick={props.onClick}
        >
            {props.children}
        </TooltipButton>
    );
}
