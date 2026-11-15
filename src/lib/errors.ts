/**
 * A user-facing message for a rejected promise or thrown value.
 */
export function errorMessage(cause: unknown): string {
    return typeof cause === "string"
        ? cause
        : cause instanceof Error
          ? cause.message
          : String(cause);
}
