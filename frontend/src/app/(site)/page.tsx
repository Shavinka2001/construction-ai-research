import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Hero } from "@/components/landing/Hero";
import { EngineBento } from "@/components/landing/EngineBento";
import {
  Container,
  Section,
  SectionMasthead,
} from "@/components/landing/primitives/Section";
import { Reveal } from "@/components/landing/primitives/Reveal";
import { PROJECT_ABSTRACT } from "@/components/landing/data/domain";
import { ENGINES } from "@/components/landing/data/engines";
import {
  INSTITUTION,
  REPOSITORY_URL,
  TEAM,
} from "@/components/landing/data/team";
import { PROJECT_SUBTITLE } from "@/components/landing/data/site";

const PAGE_TITLE = `Construction AI — ${PROJECT_SUBTITLE}`;

const PAGE_DESCRIPTION =
  "An undergraduate research platform for pre-construction intelligence: geospatial buildability scoring, architectural validation with closed-loop clash resolution, generative structural layout, automated regulatory compliance, and lifecycle costing.";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  keywords: [
    "pre-construction feasibility",
    "generative BIM",
    "clash detection",
    "YOLOv8",
    "building code compliance",
    "buildability score",
    "construction AI research",
  ],
  openGraph: {
    type: "website",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    siteName: "Construction AI",
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

/** Structured data for the research artefact. */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareSourceCode",
  name: "Construction AI",
  description: PAGE_DESCRIPTION,
  codeRepository: REPOSITORY_URL,
  programmingLanguage: ["TypeScript", "Python"],
  runtimePlatform: ["Next.js 14", "FastAPI"],
  about: ENGINES.map((engine) => ({
    "@type": "Thing",
    name: engine.academicName,
    description: engine.tagline,
  })),
  author: TEAM.map((member) => ({
    "@type": "Person",
    name: member.name,
    affiliation: {
      "@type": "CollegeOrUniversity",
      name: INSTITUTION.university,
    },
  })),
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Hero />

      {/* Abstract. The guidelines ask the home page to introduce the project
          in abstract, concisely — so it is set once, as prose, and the detail
          lives on the Domain tab. */}
      <Section id="abstract" className="py-20 sm:py-24">
        <Container>
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                <span className="lp-index">00</span>
                <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-slate-400">
                  Abstract
                </span>
              </div>
              <h2
                id="abstract-heading"
                className="mt-8 font-display text-[1.75rem] font-bold leading-[1.12] tracking-[-0.02em] text-ink sm:text-[2rem]"
              >
                The gap this closes.
              </h2>
            </div>

            <div className="lg:col-span-8">
              <p className="text-[1.0625rem] leading-[1.75] text-slate-600 sm:text-lg">
                {PROJECT_ABSTRACT}
              </p>

              <Link
                href="/domain"
                className="lp-focus group mt-8 inline-flex min-h-touch items-center gap-2 border-b border-ink/20 text-[0.9375rem] font-semibold text-ink transition-colors hover:border-gold ring-offset-white"
              >
                Read the full research domain
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 text-gold transition-transform group-hover:translate-x-1"
                />
              </Link>
            </div>
          </div>
        </Container>
      </Section>

      <EngineBento />

      {/* Pointer to the rest of the site. */}
      <Section id="next" tone="ink" className="py-20 sm:py-24">
        <Container>
          <SectionMasthead
            id="next"
            index="02"
            label="Project record"
            tone="ink"
            title="Assessments, documents and the group."
            lede="The project timeline, every document produced so far, the slide decks from each presentation, and the people behind the four components."
          />

          <Reveal className="mt-12 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                href: "/milestones",
                title: "Milestones",
                detail: "Each assessment, its date and the marks allocated.",
              },
              {
                href: "/documents",
                title: "Documents",
                detail: "Charter, proposal, checklists and final submissions.",
              },
              {
                href: "/slides",
                title: "Presentations",
                detail: "Slide decks from proposal through to final.",
              },
              {
                href: "/about",
                title: "About us",
                detail: "The four researchers and academic supervision.",
              },
            ].map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="lp-focus group flex min-h-[9rem] flex-col justify-between bg-ink p-6 transition-colors hover:bg-ink-light ring-offset-ink"
              >
                <h3 className="font-display text-base font-bold tracking-[-0.01em] text-white">
                  {card.title}
                </h3>
                <div>
                  <p className="text-[0.8125rem] leading-snug text-slate-400">
                    {card.detail}
                  </p>
                  <ArrowRight
                    aria-hidden
                    className="mt-4 h-4 w-4 text-gold transition-transform group-hover:translate-x-1"
                  />
                </div>
              </Link>
            ))}
          </Reveal>
        </Container>
      </Section>
    </>
  );
}
