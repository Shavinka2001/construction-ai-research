import { cn } from "@/lib/utils";

/** Centres content on the shared measure with mobile-first gutters. */
export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("mx-auto w-full max-w-shell px-5 sm:px-8 lg:px-12", className)}
    >
      {children}
    </div>
  );
}

type SectionProps = {
  /** Smooth-scroll anchor target. */
  id: string;
  children: React.ReactNode;
  className?: string;
  tone?: "light" | "ink";
  /** Accessible name when the section has no visible heading. */
  ariaLabel?: string;
};

export function Section({
  id,
  children,
  className,
  tone = "light",
  ariaLabel,
}: SectionProps) {
  return (
    <section
      id={id}
      data-landing-section
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : `${id}-heading`}
      className={cn(
        "relative",
        tone === "ink" ? "bg-ink text-slate-300" : "bg-white text-ink",
        className
      )}
    >
      {children}
    </section>
  );
}

/**
 * Section masthead: a hanging index and rule, then the title.
 *
 * Deliberately plainer than a typical marketing heading block — no eyebrow
 * pill, no gradient word. The index and hairline carry the hierarchy, which
 * leaves the headline free to be short.
 */
export function SectionMasthead({
  id,
  index,
  label,
  title,
  lede,
  tone = "light",
  className,
}: {
  id: string;
  /** Two-digit section number, e.g. "02". */
  index: string;
  /** Short category word, set in mono beside the index. */
  label: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  tone?: "light" | "ink";
  className?: string;
}) {
  const isInk = tone === "ink";

  return (
    <div className={className}>
      <div
        className={cn(
          "flex items-center gap-3 border-b pb-4",
          isInk ? "border-white/10" : "border-slate-200"
        )}
      >
        <span className="lp-index">{index}</span>
        <span
          className={cn(
            "font-mono text-[0.6875rem] uppercase tracking-[0.18em]",
            isInk ? "text-slate-500" : "text-slate-400"
          )}
        >
          {label}
        </span>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <h2
          id={`${id}-heading`}
          className={cn(
            "max-w-xl font-display text-[1.75rem] font-bold leading-[1.12] tracking-[-0.02em] sm:text-[2.125rem] lg:text-[2.5rem]",
            isInk ? "text-white" : "text-ink"
          )}
        >
          {title}
        </h2>

        {lede ? (
          <div
            className={cn(
              "max-w-xl self-end text-[0.9375rem] leading-[1.7] sm:text-base",
              isInk ? "text-slate-400" : "text-slate-500"
            )}
          >
            {lede}
          </div>
        ) : null}
      </div>
    </div>
  );
}
