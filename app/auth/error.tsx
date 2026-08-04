'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
            <h2 className="text-lg font-semibold">Terjadi kesalahan</h2>
            <p className="text-sm text-[var(--text-muted)]">{error.message || 'Sesuatu yang tidak terduga terjadi'}</p>
            <button onClick={reset} className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-medium">
                Coba Lagi
            </button>
        </div>
    );
}
