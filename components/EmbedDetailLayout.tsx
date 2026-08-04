import React, { useEffect, useState } from "react";
import { ArrowLeft, Filter, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface EmbedDetailLayoutProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
  className?: string;
  isStatic?: boolean;
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    hub?: string;
    branch?: string;
    airlines?: string;
    area?: string;
  };
}

export function EmbedDetailLayout({
  title,
  subtitle,
  onBack,
  children,
  className,
  isStatic = false,
  filters,
}: EmbedDetailLayoutProps) {
  const [scrolled, setScrolled] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleShare = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('viewMode', 'static');
    navigator.clipboard.writeText(url.toString()).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const hasActiveFilters =
    filters &&
    (filters.hub !== "all" ||
      filters.branch !== "all" ||
      filters.airlines !== "all" ||
      filters.area !== "all");
  const dateRange =
    filters?.dateFrom && filters?.dateTo
      ? `${filters.dateFrom} - ${filters.dateTo}`
      : null;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (isStatic) {
    return (
      <div className={cn("cf-root min-h-screen p-0", className)}>
        <div className="max-w-none mx-auto">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn("cf-root min-h-screen overflow-x-hidden", className)}>
      {}
      <motion.header
        initial={{ y: -60 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cn(
          "sticky top-0 z-50 border-b transition-all duration-300 ease-out",
          scrolled
            ? "border-[var(--cf-line)] bg-[var(--cf-card)]/90 backdrop-blur-xl shadow-[var(--cf-shadow-sm)] py-2.5"
            : "border-transparent bg-[var(--cf-canvas)] py-4",
        )}
      >
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            {onBack && (
              <motion.button
                whileHover={{ scale: 1.05, x: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={onBack}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[var(--cf-line)] bg-[var(--cf-card)] text-[var(--cf-ink-2)] shadow-[var(--cf-shadow-sm)] transition-all hover:border-[var(--cf-teal)] hover:text-[var(--cf-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--cf-teal)] focus:ring-offset-2 sm:h-10 sm:w-10"
                aria-label="Go back"
              >
                <ArrowLeft size={17} strokeWidth={2.5} />
              </motion.button>
            )}

            <motion.div layout className="flex min-w-0 flex-col">
              <div className="cf-eyebrow">
                <span className="cf-eyebrow-idx">•</span>
                <span>Detail View</span>
              </div>
              <motion.h1
                layout
                className="cf-display truncate text-lg font-semibold leading-tight tracking-tight text-[var(--cf-ink)] sm:text-2xl"
              >
                {title}
              </motion.h1>
              <AnimatePresence>
                {subtitle && !scrolled && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: 2 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="hidden truncate text-xs font-medium tracking-wide text-[var(--cf-ink-3)] sm:block"
                  >
                    {subtitle}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
            {}
            <AnimatePresence>
              {(hasActiveFilters || dateRange) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="hidden items-center gap-2 rounded-full border border-[var(--cf-line)] bg-[var(--cf-card)] px-3 py-1.5 shadow-[var(--cf-shadow-sm)] md:flex"
                >
                  <Filter size={12} className="text-[var(--cf-amber)]" />
                  <span className="text-[11px] font-semibold tracking-wide text-[var(--cf-ink-2)]">
                    {dateRange ? dateRange : "Active Filters"}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={handleShare}
              className="flex h-9 items-center justify-center gap-2 rounded-full border border-[var(--cf-line)] bg-[var(--cf-card)] px-3 text-[var(--cf-ink-2)] shadow-[var(--cf-shadow-sm)] transition-colors hover:border-[var(--cf-teal)] hover:text-[var(--cf-teal)] sm:h-10"
              title="Copy public share link"
            >
              <Share2 size={16} strokeWidth={2} />
              <AnimatePresence mode="wait">
                {linkCopied && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="hidden overflow-hidden whitespace-nowrap text-[11px] font-semibold sm:inline"
                  >
                    Link copied
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </motion.header>

      <main className="w-full px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.08 }}
          className="mx-auto max-w-[1600px] space-y-6 sm:space-y-8"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
