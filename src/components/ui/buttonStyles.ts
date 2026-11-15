/**
 * Shared button recipes.
 *
 * These are class strings rather than components: every call site still picks
 * its own height, padding and width, while the color, border and disabled
 * behavior stay consistent across panels.
 */
const TEXT_BUTTON =
    "inline-flex items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Filled blue call-to-action. Pair with a height and padding.
 */
export const primaryButton = `${TEXT_BUTTON} gap-2 bg-blue-600 font-medium text-always-white hover:bg-blue-500`;

/**
 * Bordered button on a raised surface. Pair with a height and padding.
 */
export const secondaryButton = `${TEXT_BUTTON} gap-2 border border-surface-300 bg-surface-200 font-medium text-surface-800 hover:border-surface-400 hover:bg-surface-300`;

/**
 * Bordered button on the panel background. Pair with a height and padding.
 */
export const outlineButton = `${TEXT_BUTTON} border border-surface-300 text-surface-700 hover:border-surface-400 hover:bg-surface-200`;

/**
 * Compact bordered icon button used in toolbars.
 */
export const iconButton =
    "inline-flex size-7 items-center justify-center rounded-md border border-surface-300 bg-surface-200 text-surface-700 transition hover:border-surface-400 hover:bg-surface-300 disabled:cursor-not-allowed disabled:opacity-50 hover:disabled:border-surface-300 hover:disabled:bg-surface-200";
