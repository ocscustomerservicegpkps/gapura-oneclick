'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
            <h2 className="text-lg font-semibold">Embed Error</h2>
            <p className="text-sm text-[var(--text-muted)]">{error.message || 'Failed to load embed'}</p>
            <button onClick={reset} className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-medium">
                Try Again
            </button>
        </div>
    );
}
