import { Container } from "@/components/landing/primitives/Section";

/**
 * Masthead shared by every tab except Home.
 *
 * The guidelines ask for a consistent layout across pages, so each tab opens
 * the same way: eyebrow, title, lede, on the same dark band. Only Home differs,
 * because it carries the hero.
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede?: React.ReactNode;
}) {
  return (
    <header className="lp-grain relative isolate overflow-hidden bg-ink pb-14 pt-16 sm:pb-16 sm:pt-20">
      <div aria-hidden className="lp-grid lp-grid-mask absolute inset-0 -z-10" />

      <Container>
        <p className="flex items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-slate-500">
          <span aria-hidden className="h-px w-8 bg-gold" />
          {eyebrow}
        </p>

        <h1 className="mt-6 max-w-3xl font-display text-[1.875rem] font-bold leading-[1.1] tracking-[-0.025em] text-white sm:text-[2.5rem] lg:text-[3rem]">
          {title}
        </h1>

        {lede ? (
          <div className="mt-6 max-w-2xl text-[1rem] leading-[1.7] text-slate-400 sm:text-[1.0625rem]">
            {lede}
          </div>
        ) : null}
      </Container>
    </header>
  );
}
