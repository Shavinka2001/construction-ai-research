"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/landing/primitives/Section";
import { StatsStrip } from "@/components/landing/StatsStrip";

/**
 * WebGL is heavy and decorative here, so the scene is split out of the initial
 * bundle and only requested once we know the viewport can use it.
 */
const HeroScene = dynamic(() => import("@/components/landing/HeroScene"), {
  ssr: false,
  loading: () => null,
});

/**
 * True only on viewports wide enough for the massing to read, and when the
 * visitor has not asked for reduced motion.
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

/**
 * Home hero.
 *
 * Single column of type with the massing bleeding off the right edge rather
 * than sitting in a reserved column beside it, so the section reads as one
 * composition instead of two boxes. The scene is purely ambient: it is behind
 * the content, masked at both edges, and never carries information.
 *
 * Entrance uses CSS animation with no JavaScript gate, so the copy is visible
 * whether or not hydration happens, and `prefers-reduced-motion` neutralises
 * it via the rule in globals.css.
 */
export function Hero() {
  const showScene = useWantsThreeDimensionalScene();

  return (
    <section
      aria-labelledby="hero-heading"
      className="lp-grain relative isolate overflow-hidden bg-ink pb-14 pt-24 sm:pb-16 sm:pt-32 lg:pb-20 lg:pt-40"
    >
      {/* Layered back to front: drafting grid, massing, scrim, content. */}
      <div aria-hidden className="lp-grid lp-grid-mask absolute inset-0 -z-30" />

      {/* Ambient massing. Runs off the right edge and fades into the ground on
          both sides, so there is no visible frame around it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-[-8%] -z-20 hidden w-[58%] lg:block"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, #000 30%, #000 74%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, #000 30%, #000 74%, transparent)",
        }}
      >
        {showScene ? <HeroScene /> : null}
      </div>

      {/* Scrim. The massing is wide enough to pass under the headline on some
          viewports, so the copy keeps its contrast from this rather than from
          the scene happening to stay clear of it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 -z-10 hidden w-[78%] bg-gradient-to-r from-ink via-ink/85 to-transparent lg:block"
      />

      <Container className="relative">
        <div className="max-w-[46rem]">
          <h1
            id="hero-heading"
            className="animate-fade-up font-display text-display-sm font-bold leading-[1.02] tracking-display text-white sm:text-display-lg lg:text-display-xl"
          >
            Check the build{" "}
            <span className="text-gold">before you break ground.</span>
          </h1>

          <p
            className="mt-8 max-w-lg animate-fade-up text-lg leading-[1.55] text-slate-400 sm:text-xl"
            style={{ animationDelay: "90ms" }}
          >
            Site, plan, approvals and cost — checked from the drawings you
            already have.
          </p>

          <div
            className="mt-11 flex animate-fade-up flex-col gap-4 sm:flex-row sm:items-center sm:gap-7"
            style={{ animationDelay: "180ms" }}
          >
            <Link
              href="/login"
              className="lp-focus group inline-flex min-h-touch items-center justify-center gap-2 bg-gold px-7 text-body font-bold text-ink transition-colors hover:bg-gold-light ring-offset-ink"
            >
              Open the platform
              <ArrowRight
                aria-hidden
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
              />
            </Link>

            <Link
              href="/domain"
              className="lp-focus group inline-flex min-h-touch items-center gap-2 text-body font-medium text-slate-400 transition-colors hover:text-white ring-offset-ink"
            >
              Read the research
              <ArrowRight
                aria-hidden
                className="h-3.5 w-3.5 text-gold transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>
        </div>

        <div
          className="mt-20 animate-fade-up sm:mt-24 lg:mt-28"
          style={{ animationDelay: "280ms" }}
        >
          <StatsStrip />
        </div>
      </Container>
    </section>
  );
}
