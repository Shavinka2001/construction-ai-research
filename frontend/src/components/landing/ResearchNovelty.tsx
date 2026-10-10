import {
  Container,
  Section,
  SectionHeading,
} from "@/components/landing/primitives/Section";
import { Reveal } from "@/components/landing/primitives/Reveal";
import { NOVELTY_CLAIMS } from "@/components/landing/data/novelty";

/**
 * Academic contribution section.
 *
 * Each claim is deliberately laid out as prior art beside contribution, with a
 * source pointer underneath, so an examiner can jump straight to the module
 * that substantiates it.
 */
export function ResearchNovelty() {
  return (
    <Section id="novelty">
      <Container>
        <SectionHeading
          id="novelty"
          eyebrow="Academic novelty"
          title={
            <>
              Where this work{" "}
              <span className="lp-text-gold-gradient">departs</span> from prior
              art.
            </>
          }
          description="Three contributions distinguish this platform from existing pre-construction and BIM coordination tooling. Each is paired with the module that implements it."
        />

        <ol className="mt-12 space-y-5 sm:mt-14 sm:space-y-6">
          {NOVELTY_CLAIMS.map((claim, index) => {
            const Icon = claim.icon;

            return (
              <Reveal as="li" key={claim.id} delay={index * 100}>
                <article className="lp-glass-light overflow-hidden rounded-2xl shadow-luxury">
                  <header className="flex items-start gap-3.5 border-b border-slate-200/80 p-5 sm:items-center sm:p-6">
                    <span
                      aria-hidden
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold-dark"
                    >
                      <Icon className="h-5 w-5" />
                    </span>

                    <div className="min-w-0">
                      <p className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-slate-400">
                        Contribution {String(index + 1).padStart(2, "0")}
                      </p>
                      <h3 className="mt-0.5 font-display text-base font-bold leading-tight tracking-tight text-ink sm:text-xl">
                        {claim.title}
                      </h3>
                    </div>
                  </header>

                  <div className="grid divide-y divide-slate-200/80 md:grid-cols-2 md:divide-x md:divide-y-0">
                    <div className="p-5 sm:p-6">
                      <p className="flex items-center gap-2 text-[0.625rem] font-bold uppercase tracking-[0.14em] text-slate-400">
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 rounded-full bg-slate-300"
                        />
                        Existing approach
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-slate-500">
                        {claim.priorArt}
                      </p>
                    </div>

                    <div className="relative bg-gradient-to-br from-emerald-brand-muted/60 to-transparent p-5 sm:p-6">
                      <p className="flex items-center gap-2 text-[0.625rem] font-bold uppercase tracking-[0.14em] text-emerald-brand-dark">
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 rounded-full bg-emerald-brand"
                        />
                        This research
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-ink">
                        {claim.contribution}
                      </p>
                    </div>
                  </div>

                  <footer className="border-t border-slate-200/80 bg-slate-100/60 px-5 py-3.5 sm:px-6">
                    <p className="text-[0.6875rem] leading-relaxed text-slate-500">
                      <span className="font-bold uppercase tracking-[0.1em] text-slate-400">
                        Implemented in{" "}
                      </span>
                      <code className="break-words font-mono text-[0.6875rem] text-ink">
                        {claim.evidence}
                      </code>
                    </p>
                  </footer>
                </article>
              </Reveal>
            );
          })}
        </ol>
      </Container>
    </Section>
  );
}
