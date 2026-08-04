interface DashboardWorkspaceSkeletonProps {
  title: string;
  subtitle: string;
}

export function DashboardWorkspaceSkeleton({
  title,
  subtitle,
}: DashboardWorkspaceSkeletonProps) {
  return (
    <div className="min-h-[70vh] bg-[var(--surface-0)] px-3 pb-24 pt-4 sm:px-4 md:px-6">
      <div className="mx-auto w-full max-w-none space-y-4 sm:space-y-6">
        <section className="overflow-hidden rounded-2xl border border-[var(--surface-3)] bg-[var(--surface-1)] shadow-sm">
          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="h-3 w-24 animate-pulse rounded-full bg-[var(--surface-3)]" />
                <div className="h-9 w-56 animate-pulse rounded-2xl bg-[var(--surface-3)] sm:w-72" />
                <div className="h-4 w-64 animate-pulse rounded-full bg-[var(--surface-2)] sm:w-96" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-11 w-full animate-pulse rounded-2xl bg-[var(--surface-2)] sm:w-28"
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="space-y-4 rounded-2xl border border-[var(--surface-3)] bg-[var(--surface-0)] p-4"
                >
                  <div className="h-3 w-24 animate-pulse rounded-full bg-[var(--surface-3)]" />
                  <div className="h-8 w-20 animate-pulse rounded-xl bg-[var(--surface-2)]" />
                  <div className="h-2 w-full animate-pulse rounded-full bg-[var(--surface-2)]" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
          <div className="space-y-4 rounded-2xl border border-[var(--surface-3)] bg-[var(--surface-1)] p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="h-3 w-20 animate-pulse rounded-full bg-[var(--surface-3)]" />
                <div className="h-7 w-44 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
              </div>
              <div className="h-10 w-28 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-2xl bg-[var(--surface-2)]"
                />
              ))}
            </div>
          </div>

          <aside className="space-y-4 rounded-2xl border border-[var(--surface-3)] bg-[var(--surface-1)] p-5 shadow-sm">
            <div className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded-full bg-[var(--surface-3)]" />
              <div className="h-7 w-40 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
              <p className="text-sm text-[var(--text-muted)]">{title}</p>
              <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-2xl bg-[var(--surface-2)]"
                />
              ))}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
