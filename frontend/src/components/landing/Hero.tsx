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

export function Hero() {
  const showScene = useWantsThreeDimensionalScene();

  return (
    <section
      aria-labelledby="hero-heading"
      className="lp-grain relative isolate overflow-hidden bg-ink pb-16 pt-28 sm:pb-20 sm:pt-36 lg:pb-24 lg:pt-44"
    >
      <div aria-hidden className="lp-grid lp-grid-mask absolute inset-0 -z-10" />

      <Container>
        <div className="grid items-start gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            {/* Standfirst line instead of a pill badge. */}
            <p className="flex items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-slate-500">
              <span aria-hidden className="h-px w-8 bg-gold" />
              Pre-construction intelligence
            </p>

            <h1
              id="hero-heading"
              className="mt-7 max-w-[20ch] font-display text-[2.125rem] font-bold leading-[1.05] tracking-[-0.03em] text-white sm:text-[3rem] lg:text-[3.75rem]"
            >
              Know what a site will cost you{" "}
              <span className="text-gold">before you own it.</span>
            </h1>

            <p className="mt-7 max-w-xl text-[1.0625rem] leading-[1.65] text-slate-400 sm:text-lg">
              Most of what goes wrong on a building project was already decided
              before anyone broke ground: the slope nobody measured, the column
              that lands in a doorway, the clearance nobody knew was required.
              This platform checks all of it from the drawings you already have.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <Link
                href="/login"
                className="lp-focus group inline-flex min-h-touch items-center justify-center gap-2 bg-gold px-7 text-[0.9375rem] font-bold text-ink transition-colors hover:bg-gold-light ring-offset-ink"
              >
                Open the platform
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                />
              </Link>

              <Link
                href="/domain"
                className="lp-focus inline-flex min-h-touch items-center justify-center text-[0.9375rem] font-semibold text-slate-300 underline decoration-slate-600 decoration-1 underline-offset-[6px] transition-colors hover:text-white hover:decoration-gold ring-offset-ink"
              >
                Read the research domain
              </Link>
            </div>
          </div>

          {/* Scene column. Reserves its box so the hero never reflows when
              WebGL arrives. */}
          <div className="relative hidden h-[24rem] lg:col-span-5 lg:block xl:h-[27rem]">
            {showScene ? (
              <HeroScene />
            ) : (
              <div aria-hidden className="lp-grid h-full w-full opacity-30" />
            )}
          </div>
        </div>

        <div className="mt-16 sm:mt-20 lg:mt-24">
          <StatsStrip />
        </div>
      </Container>
    </section>
  );
}
