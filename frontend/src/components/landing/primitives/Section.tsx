import { cn } from "@/lib/utils";

import { Reveal } from "@/components/landing/primitives/Reveal";

/** Centres content on the shared landing measure with mobile-first gutters. */
export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-shell px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}

type SectionProps = {
  /** Smooth-scroll anchor target. */
  id: string;
  children: React.ReactNode;
  className?: string;
  /** Dark ink sections alternate with light slate ones down the page. */
  tone?: "light" | "ink";
  /** Accessible name for the landmark, when no visible heading is inside. */
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
        "relative py-20 sm:py-24 lg:py-32",
        tone === "ink" ? "bg-ink text-slate-200" : "bg-slate-50 text-ink",
        className
      )}
    >
      {children}
    </section>
  );
}

type SectionHeadingProps = {
  /** Must match the owning section id so aria-labelledby resolves. */
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  tone?: "light" | "ink";
  align?: "start" | "center";
  className?: string;
};

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  tone = "light",
  align = "start",
  className,
}: SectionHeadingProps) {
  const isInk = tone === "ink";

  return (
    <Reveal
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        className
      )}
    >
      <p
        className={cn(
          "flex items-center gap-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-gold",
          align === "center" && "justify-center"
        )}
      >
        <span aria-hidden className="h-1 w-1 rounded-full bg-gold" />
        {eyebrow}
      </p>

      <h2
        id={`${id}-heading`}
        className={cn(
          "mt-4 font-display text-[1.75rem] font-bold leading-[1.15] tracking-tight sm:text-4xl lg:text-[2.75rem]",
          isInk ? "text-white" : "text-ink"
        )}
      >
        {title}
      </h2>

      {description ? (
        <p
          className={cn(
            "mt-5 text-base leading-relaxed sm:text-lg",
            isInk ? "text-slate-400" : "text-slate-600"
          )}
        >
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}
