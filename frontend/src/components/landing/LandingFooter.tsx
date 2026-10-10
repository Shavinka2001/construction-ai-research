import Link from "next/link";
import { Github } from "lucide-react";

import { Container } from "@/components/landing/primitives/Section";
import { ENGINES } from "@/components/landing/data/engines";
import { SITE_TABS, PROJECT_TITLE } from "@/components/landing/data/site";
import { INSTITUTION, REPOSITORY_URL } from "@/components/landing/data/team";

const PLATFORM_LINKS = [
  { href: "/login", label: "Sign in" },
  { href: "/register", label: "Create account" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-ink-deep text-slate-400">
      <Container className="py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] lg:gap-8">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center bg-gold font-display text-[0.8125rem] font-bold text-ink"
              >
                CA
              </span>
              <div className="leading-none">
                <p className="font-display text-[0.9375rem] font-bold tracking-[-0.01em] text-white">
                  {PROJECT_TITLE}
                </p>
                <p className="mt-1 font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-slate-500">
                  Research project
                </p>
              </div>
            </div>

            <p className="mt-5 max-w-sm text-[0.8125rem] leading-relaxed">
              Intelligent AI-driven pre-construction feasibility analyzer.
              Submitted as an undergraduate research project at{" "}
              {INSTITUTION.university}.
            </p>

            <a
              href={REPOSITORY_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="lp-focus mt-6 inline-flex min-h-touch items-center gap-2 border border-white/15 px-4 font-mono text-[0.75rem] text-slate-300 transition-colors hover:bg-white/5 ring-offset-ink"
            >
              <Github aria-hidden className="h-4 w-4" />
              Source repository
            </a>
          </div>

          <nav aria-label="Site sections">
            <h2 className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-gold">
              Pages
            </h2>
            <ul className="mt-4 space-y-2.5">
              {SITE_TABS.map((tab) => (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    className="lp-focus text-[0.8125rem] transition-colors hover:text-white ring-offset-ink"
                  >
                    {tab.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Research components">
            <h2 className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-gold">
              Components
            </h2>
            <ul className="mt-4 space-y-2.5">
              {ENGINES.map((engine) => (
                <li key={engine.id}>
                  <Link
                    href={engine.href}
                    className="lp-focus text-[0.8125rem] leading-snug transition-colors hover:text-white ring-offset-ink"
                  >
                    {engine.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Platform">
            <h2 className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-gold">
              Platform
            </h2>
            <ul className="mt-4 space-y-2.5">
              {PLATFORM_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="lp-focus text-[0.8125rem] transition-colors hover:text-white ring-offset-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 space-y-3 border-t border-white/10 pt-8 text-[0.75rem] leading-relaxed text-slate-500">
          <p>
            <span className="font-mono uppercase tracking-[0.12em] text-slate-400">
              Academic disclaimer.{" "}
            </span>
            This platform is an undergraduate research prototype. Its outputs —
            buildability scores, clash resolutions, generated structural
            layouts, compliance verdicts, cost estimates and lifecycle
            projections — are indicative and must not be relied upon for
            construction, procurement or statutory submission. All designs
            require certification by a chartered architect or engineer, and all
            approvals remain subject to the determination of the relevant
            authority.
          </p>
          <p>
            Geospatial data is derived from Google Earth Engine (SRTM, ESA
            WorldCover, JRC Global Surface Water) and Open-Meteo under their
            respective terms. Authority contact details shown in the platform
            are illustrative and must be verified independently.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-6 text-[0.75rem] sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} Construction AI Research Group. All rights reserved.
          </p>
          <p className="text-slate-500">
            {INSTITUTION.department} · {INSTITUTION.academicYear}
          </p>
        </div>
      </Container>
    </footer>
  );
}
