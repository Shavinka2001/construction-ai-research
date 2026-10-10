import { cn } from "@/lib/utils";

type BadgeProps = {
  children: React.ReactNode;
  variant?: "gold" | "emerald" | "neutral" | "outline";
  className?: string;
  /** Small leading dot — used for the live/prototype status pills. */
  withDot?: boolean;
};

const VARIANTS: Record<NonNullable<BadgeProps["variant"]>, string> = {
  gold: "border-gold/30 bg-gold/10 text-gold",
  emerald: "border-emerald-brand/30 bg-emerald-brand-muted text-emerald-brand",
  neutral: "border-slate-700/60 bg-white/5 text-slate-300",
  outline: "border-slate-300 bg-white text-slate-600",
};

export function Badge({
  children,
  variant = "neutral",
  className,
  withDot = false,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em]",
        VARIANTS[variant],
        className
      )}
    >
      {withDot ? (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  );
}
