import type { Metadata } from "next";

import { PageHeader } from "@/components/landing/primitives/PageHeader";
import {
  Container,
  Section,
} from "@/components/landing/primitives/Section";
import { Reveal } from "@/components/landing/primitives/Reveal";
import { ArchitectureFlow } from "@/components/landing/ArchitectureFlow";
import { ResearchNovelty } from "@/components/landing/ResearchNovelty";
import { DOMAIN_SECTIONS, METHODOLOGY } from "@/components/landing/data/domain";

export const metadata: Metadata = {
  title: "Domain",
  description:
    "Literature survey, research gap, research problem, objectives, methodology and the technologies used in the Construction AI research project.",
};

/** In-page contents, so a long read stays navigable. */
const CONTENTS = [
  { href: "#literature-survey", label: "Literature survey" },
  { href: "#research-gap", label: "Research gap" },
  { href: "#research-problem", label: "Research problem" },
  { href: "#research-objectives", label: "Research objectives" },
  { href: "#methodology", label: "Methodology" },
  { href: "#novelty", label: "Research contribution" },
  { href: "#architecture", label: "Technologies used" },
] as const;

export default function DomainPage() {
  return (
    <>
      <PageHeader
        eyebrow="Domain"
        title="The research domain."
        lede="What has already been published, where it stops, the problem that leaves open, and how this project answers it."
      />

      <Section id="domain" className="py-16 sm:py-20">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            {/* Contents rail. */}
            <nav
              aria-label="On this page"
              className="lg:col-span-3 lg:sticky lg:top-28 lg:self-start"
            >
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-slate-400">
                On this page
              </p>
              <ul className="mt-4 space-y-2.5 border-l border-slate-200 pl-4">
                {CONTENTS.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="lp-focus text-[0.8125rem] text-slate-500 transition-colors hover:text-ink ring-offset-white"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Write-up. */}
            <div className="lg:col-span-9">
              {DOMAIN_SECTIONS.map((section, index) => (
                <Reveal key={section.id}>
                  <section
                    id={section.id}
                    data-landing-section
                    aria-labelledby={`${section.id}-heading`}
                    className="border-t border-slate-200 py-10 first:border-t-0 first:pt-0 sm:py-12"
                  >
                    <div className="flex items-center gap-3">
                      <span className="lp-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h2
                        id={`${section.id}-heading`}
                        className="font-display text-xl font-bold tracking-[-0.02em] text-ink sm:text-2xl"
                      >
                        {section.title}
                      </h2>
                    </div>

                    <div className="mt-6 max-w-2xl space-y-4">
                      {section.body.map((paragraph) => (
                        <p
                          key={paragraph.slice(0, 40)}
                          className="text-[0.9375rem] leading-[1.75] text-slate-600 sm:text-base"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>

                    {section.points ? (
                      <ol className="mt-7 max-w-2xl space-y-3 border-t border-slate-200 pt-6">
                        {section.points.map((point, pointIndex) => (
                          <li key={point.slice(0, 40)} className="flex gap-4">
                            <span className="mt-0.5 shrink-0 font-mono text-[0.6875rem] tabular-nums text-gold">
                              {String(pointIndex + 1).padStart(2, "0")}
                            </span>
                            <span className="text-[0.9375rem] leading-[1.7] text-slate-600">
                              {point}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </section>
                </Reveal>
              ))}

              {/* Methodology, as an ordered pipeline. */}
              <Reveal>
                <section
                  id="methodology"
                  data-landing-section
                  aria-labelledby="methodology-heading"
                  className="border-t border-slate-200 py-10 sm:py-12"
                >
                  <div className="flex items-center gap-3">
                    <span className="lp-index">
                      {String(DOMAIN_SECTIONS.length + 1).padStart(2, "0")}
                    </span>
                    <h2
                      id="methodology-heading"
                      className="font-display text-xl font-bold tracking-[-0.02em] text-ink sm:text-2xl"
                    >
                      Methodology
                    </h2>
                  </div>

                  <p className="mt-6 max-w-2xl text-[0.9375rem] leading-[1.75] text-slate-600 sm:text-base">
                    The pipeline runs in order. Each phase consumes the output
                    of the one before it, so a failure is isolated to a stage
                    rather than to the system.
                  </p>

                  <ol className="mt-8 border-t border-slate-200">
                    {METHODOLOGY.map((phase, index) => (
                      <li
                        key={phase.id}
                        className="grid gap-2 border-b border-slate-200 py-5 sm:grid-cols-12 sm:gap-6"
                      >
                        <div className="flex items-baseline gap-3 sm:col-span-4">
                          <span className="font-mono text-[0.6875rem] tabular-nums text-gold">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <h3 className="text-[0.9375rem] font-semibold text-ink">
                            {phase.name}
                          </h3>
                        </div>
                        <p className="text-[0.875rem] leading-[1.7] text-slate-600 sm:col-span-8">
                          {phase.detail}
                        </p>
                      </li>
                    ))}
                  </ol>
                </section>
              </Reveal>
            </div>
          </div>
        </Container>
      </Section>

      {/* Research contribution and the technology stack. */}
      <ResearchNovelty />
      <ArchitectureFlow />
    </>
  );
}
