import Link from "next/link";
import { Github } from "lucide-react";

import { Container } from "@/components/landing/primitives/Section";
import { ENGINES } from "@/components/landing/data/engines";
import { INSTITUTION, REPOSITORY_URL } from "@/components/landing/data/team";

const SECTION_LINKS = [
  { href: "#overview", label: "Overview" },
  { href: "#engines", label: "The 4 Engines" },
  { href: "#architecture", label: "Architecture" },
  { href: "#novelty", label: "Research Novelty" },
  { href: "#team", label: "Team" },
] as const;

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
          {/* Identity + disclaimer. */}
          <div>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-gold-light to-gold-dark font-display text-sm font-black text-ink"
              >
                CA
              </span>
              <div className="leading-none">
                <p className="font-display text-[0.9375rem] font-bold tracking-tight text-white">
                  Construction AI
                </p>
                <p className="mt-0.5 text-[0.625rem] font-medium uppercase tracking-[0.16em] text-slate-500">
                  Research Platform
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
              className="lp-focus mt-5 inline-flex min-h-touch items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 text-[0.8125rem] font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.07] ring-offset-ink"
            >
              <Github aria-hidden className="h-4 w-4" />
              Source repository
            </a>
          </div>

          <nav aria-label="Page sections">
            <h2 className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-gold">
              Explore
            </h2>
            <ul className="mt-4 space-y-2.5">
              {SECTION_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="lp-focus rounded text-[0.8125rem] transition-colors hover:text-white ring-offset-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Research components">
            <h2 className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-gold">
              Components
            </h2>
            <ul className="mt-4 space-y-2.5">
              {ENGINES.map((engine) => (
                <li key={engine.id}>
                  <Link
                    href={engine.href}
                    className="lp-focus rounded text-[0.8125rem] leading-snug transition-colors hover:text-white ring-offset-ink"
                  >
                    {engine.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Platform">
            <h2 className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-gold">
              Platform
            </h2>
            <ul className="mt-4 space-y-2.5">
              {PLATFORM_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="lp-focus rounded text-[0.8125rem] transition-colors hover:text-white ring-offset-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Disclaimers. */}
        <div className="mt-12 space-y-3 border-t border-white/10 pt-8 text-[0.75rem] leading-relaxed text-slate-500">
          <p>
            <span className="font-bold uppercase tracking-[0.1em] text-slate-400">
              Academic disclaimer.{" "}
            </span>
            This platform is an undergraduate research prototype. Its outputs —
            including buildability scores, clash resolutions, generated
            structural layouts, compliance verdicts, cost estimates and
            lifecycle projections — are indicative and must not be relied upon
            for construction, procurement or statutory submission. All designs
            require certification by a chartered architect or engineer, and all
            approvals remain subject to the determination of the relevant
            authority.
          </p>
          <p>
            Geospatial data is derived from Google Earth Engine (SRTM, ESA
            WorldCover, JRC Global Surface Water) and Open-Meteo, each under
            their respective terms. Authority contact details are illustrative
            and must be verified independently.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-6 text-[0.75rem] sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} Construction AI Research Group. All rights reserved.
          </p>
          <p className="text-slate-500">
            {INSTITUTION.department} &middot; {INSTITUTION.academicYear}
          </p>
        </div>
      </Container>
    </footer>
  );
}
