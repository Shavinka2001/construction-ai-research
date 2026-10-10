"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ArrowRight, FileText, Sparkles } from "lucide-react";

import { Container } from "@/components/landing/primitives/Section";
import { StatsStrip } from "@/components/landing/StatsStrip";

/**
 * WebGL is heavy and purely decorative here, so the scene is split out of the
 * initial bundle and only requested once we know the viewport can use it.
 */
const HeroScene = dynamic(() => import("@/components/landing/HeroScene"), {
  ssr: false,
  loading: () => null,
});

/**
 * True only on viewports wide enough for the massing to read, and when the
 * visitor has not asked for reduced motion. Phones get the static blueprint
 * backdrop instead, which keeps the hero cheap on mobile data and battery.
 */
function useWantsThreeDimensionalScene(): boolean {
  const [wants, setWants] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(
      "(min-width: 1024px) and (prefers-reduced-motion: no-preference)"
    );

    const sync = () => setWants(query.matches);
    sync();

    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return wants;
}

export function Hero() {
  const showScene = useWantsThreeDimensionalScene();

  return (
    <section
      id="overview"
      data-landing-section
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden bg-ink pb-16 pt-28 sm:pb-20 sm:pt-32 lg:pb-28 lg:pt-40"
    >
      {/* Layered backdrop: drafting grid, then two soft brand glows. */}
      <div
        aria-hidden
        className="lp-grid-blueprint lp-grid-mask absolute inset-0 -z-10"
      />
      <div
        aria-hidden
        className="absolute -top-40 left-1/2 -z-10 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 right-0 -z-10 h-96 w-96 rounded-full bg-emerald-brand/10 blur-[120px]"
      />

      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_30rem]">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.07] px-3.5 py-1.5 text-[0.625rem] font-bold uppercase tracking-[0.16em] text-gold sm:text-[0.6875rem]">
              <Sparkles aria-hidden className="h-3.5 w-3.5" />
              Zero-human-touch pre-construction intelligence
            </p>

            <h1
              id="hero-heading"
              className="mt-6 font-display text-[2rem] font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]"
            >
              Precision feasibility, structural AI and{" "}
              <span className="lp-text-gold-gradient">generative BIM</span> in a
              single unified platform.
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Between a raw land purchase and a signed building permit sits a
              multi-million rupee gap: unverified blueprints, unread topography,
              municipal zoning rules discovered too late, and a lifecycle cost
              nobody modelled. This platform closes that gap end to end &mdash;
              validating the plan, prescribing the structural fix, mapping the
              approval pathway, and costing the build before ground is broken.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="lp-focus group inline-flex min-h-touch items-center justify-center gap-2 rounded-xl bg-gold px-6 text-[0.9375rem] font-bold text-ink shadow-glow-gold transition hover:bg-gold-light active:scale-[0.98] ring-offset-ink"
              >
                Explore live platform
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                />
              </Link>

              <Link
                href="#novelty"
                className="lp-focus inline-flex min-h-touch items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-6 text-[0.9375rem] font-semibold text-slate-200 transition hover:border-white/25 hover:bg-white/[0.08] ring-offset-ink"
              >
                <FileText aria-hidden className="h-4 w-4" />
                View research contribution
              </Link>
            </div>
          </div>

          {/* Scene column. Reserves its box on every breakpoint so the hero
              never reflows when WebGL finishes loading. */}
          <div className="relative hidden h-[22rem] lg:block xl:h-[26rem]">
            {showScene ? (
              <HeroScene />
            ) : (
              <div
                aria-hidden
                className="lp-grid-blueprint h-full w-full rounded-2xl border border-white/10 opacity-40"
              />
            )}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent"
            />
          </div>
        </div>

        <div className="mt-14 sm:mt-16 lg:mt-20">
          <StatsStrip />
        </div>
      </Container>
    </section>
  );
}
