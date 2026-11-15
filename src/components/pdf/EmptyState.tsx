export function EmptyState() {
    return (
        <div class="grid h-full place-items-center text-center">
            <div class="max-w-sm">
                <div class="mx-auto mb-3 grid size-12 place-items-center rounded-lg bg-surface-300/50 text-2xl">
                    PDF
                </div>
                <p class="text-sm font-medium text-surface-700">
                    No preview yet
                </p>
                <p class="mt-1 text-xs text-surface-500">
                    Press Compile to render your LaTeX document here.
                </p>
            </div>
        </div>
    );
}
