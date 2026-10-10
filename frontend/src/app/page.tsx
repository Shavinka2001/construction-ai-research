import type { Metadata } from "next";

import { LandingNav } from "@/components/landing/LandingNav";
import { LandingScrollScope } from "@/components/landing/LandingScrollScope";
import { Hero } from "@/components/landing/Hero";
import { EngineBento } from "@/components/landing/EngineBento";
import { ArchitectureFlow } from "@/components/landing/ArchitectureFlow";
import { ResearchNovelty } from "@/components/landing/ResearchNovelty";
import { TeamSection } from "@/components/landing/TeamSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ENGINES } from "@/components/landing/data/engines";
import {
  INSTITUTION,
  REPOSITORY_URL,
  TEAM,
} from "@/components/landing/data/team";

const PAGE_TITLE =
  "Construction AI — Intelligent AI-Driven Pre-Construction Feasibility Analyzer";

const PAGE_DESCRIPTION =
  "A unified research platform for pre-construction intelligence: geospatial buildability scoring, YOLOv8 and OpenCV architectural validation with closed-loop clash resolution, generative structural layout, automated regulatory compliance, and lifecycle costing.";

export const metadata: Metadata = {
  // Overrides the root layout template so the landing page carries the full
  // project title rather than "… | Construction AI".
  title: {
    absolute: PAGE_TITLE,
  },
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

/**
 * Structured data for the research artefact. Kept inline so it stays in step
 * with the same data files the page renders from.
 */
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

export default function LandingPage() {
  return (
    <>
      {/* Scopes the landing-only smooth scroll and anchor offsets in
          globals.css without affecting the dashboard or auth routes. */}
      <LandingScrollScope />

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <a
        href="#engines"
        className="lp-focus sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-ink"
      >
        Skip to research components
      </a>

      <LandingNav />

      <main className="bg-slate-50">
        <Hero />
        <EngineBento />
        <ArchitectureFlow />
        <ResearchNovelty />
        <TeamSection />
      </main>

      <LandingFooter />
    </>
  );
}
