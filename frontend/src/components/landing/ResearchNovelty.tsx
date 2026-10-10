import {
  Container,
  Section,
  SectionMasthead,
} from "@/components/landing/primitives/Section";
import { Reveal } from "@/components/landing/primitives/Reveal";
import { NOVELTY_CLAIMS } from "@/components/landing/data/novelty";

/**
 * Academic contribution section.
 *
 * Prior art is set in the left column at lower contrast, the contribution in
 * the right at full contrast, with the implementing module named underneath so
 * a claim can be demonstrated on the spot during the viva.
 */
export function ResearchNovelty() {
  return (
    <Section id="novelty" className="py-20 sm:py-24 lg:py-28">
      <Container>
        <SectionMasthead
          id="novelty"
          index="06"
          label="Contribution"
          title="Three places this departs from prior art."
          lede="Existing pre-construction and BIM coordination tools stop short in the same three ways. Each claim below names the module that answers it."
        />

        <ol className="mt-14 sm:mt-16">
          {NOVELTY_CLAIMS.map((claim, index) => {
            const Icon = claim.icon;

            return (
              <Reveal as="li" key={claim.id}>
                <article className="grid gap-8 border-t border-slate-200 py-12 lg:grid-cols-12 lg:gap-12 lg:py-16">
                  {/* Index + title rail. */}
                  <header className="lg:col-span-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs tabular-nums text-gold">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Icon aria-hidden className="h-4 w-4 text-slate-300" />
                    </div>

                    <h3 className="mt-4 max-w-sm font-display text-lg font-bold leading-snug tracking-[-0.015em] text-ink sm:text-xl">
                      {claim.title}
                    </h3>
                  </header>

                  <div className="lg:col-span-8">
                    <div className="grid gap-8 sm:grid-cols-2 sm:gap-10">
                      <div>
                        <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-slate-400">
                          Where it stands
                        </p>
                        <p className="mt-3 text-[0.875rem] leading-[1.7] text-slate-500">
                          {claim.priorArt}
                        </p>
                      </div>

                      <div className="border-l-2 border-gold pl-5 sm:pl-6">
                        <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-ink">
                          What this adds
                        </p>
                        <p className="mt-3 text-[0.875rem] leading-[1.7] text-ink">
                          {claim.contribution}
                        </p>
                      </div>
                    </div>

                    <p className="mt-8 border-t border-slate-200 pt-4">
                      <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-slate-400">
                        Source{" "}
                      </span>
                      <code className="ml-1 break-words font-mono text-[0.75rem] leading-relaxed text-slate-600">
                        {claim.evidence}
                      </code>
                    </p>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </ol>
      </Container>
    </Section>
  );
}
