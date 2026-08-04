'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Dashboard Error</h2>
            <p className="text-sm text-[var(--text-muted)]">{error.message || 'Failed to load dashboard'}</p>
            <button onClick={reset} className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                Try Again
            </button>
        </div>
    );
}
