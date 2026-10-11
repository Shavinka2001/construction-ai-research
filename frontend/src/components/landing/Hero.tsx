import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/landing/primitives/Section";
import { StatsStrip } from "@/components/landing/StatsStrip";

/** Corner tick, as found on a drawing sheet. Four of these frame the hero. */
function RegistrationMark({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute h-4 w-4 border-gold/35 ${className}`}
    />
  );
}

/**
 * Home hero.
 *
 * A centred column of type on a quiet ground — no illustration, no render.
 * The serif headline carries the section on its own, which is what makes the
 * first screen feel composed rather than decorated.
 *
 * Sized against the small viewport unit so mobile browser chrome cannot crop
 * it, with the figures pinned to the foot. This is a server component: there
 * is nothing interactive here beyond the two links, and the entrance is plain
 * CSS, so the copy renders whether or not hydration happens.
 * `prefers-reduced-motion` neutralises the motion through globals.css.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="lp-grain relative isolate flex min-h-[80svh] flex-col overflow-hidden bg-ink pb-12 pt-28 sm:pt-32 lg:min-h-[88svh] lg:pb-16 lg:pt-36"
    >
      <div aria-hidden className="lp-grid lp-grid-mask absolute inset-0 -z-20" />

      {/* A single soft lift behind the headline, so the centred column sits on
          something rather than floating on flat ink. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-[38%] -z-10 h-[32rem] w-[48rem] max-w-[120vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/[0.055] blur-[120px]"
      />

      {/* Sheet registration marks. */}
      <RegistrationMark className="left-5 top-20 border-l border-t sm:left-8 lg:left-12" />
      <RegistrationMark className="right-5 top-20 border-r border-t sm:right-8 lg:right-12" />
      <RegistrationMark className="bottom-6 left-5 border-b border-l sm:left-8 lg:left-12" />
      <RegistrationMark className="bottom-6 right-5 border-b border-r sm:right-8 lg:right-12" />

      <Container className="relative flex flex-1 items-center">
        <div className="mx-auto w-full max-w-4xl py-12 text-center lg:py-16">
          <p className="lp-label animate-fade-up text-slate-500">
            Pre-construction intelligence
          </p>

          <h1
            id="hero-heading"
            className="mt-7 animate-fade-up font-display text-display-sm font-normal tracking-display text-white sm:text-display-lg lg:text-display-xl"
            style={{ animationDelay: "60ms" }}
          >
            Check the build{" "}
            <em className="not-italic text-gold">before you break ground.</em>
          </h1>

          <p
            className="mx-auto mt-8 max-w-xl animate-fade-up text-lg leading-[1.6] text-slate-400 sm:text-xl"
            style={{ animationDelay: "140ms" }}
          >
            Site, plan, approvals and cost — checked from the drawings you
            already have.
          </p>

          <div
            className="mt-12 flex animate-fade-up flex-col items-center justify-center gap-4 sm:flex-row sm:gap-7"
            style={{ animationDelay: "220ms" }}
          >
            <Link
              href="/login"
              className="lp-focus group inline-flex min-h-touch w-full items-center justify-center gap-2 bg-gold px-7 text-body font-bold text-ink transition-colors hover:bg-gold-light ring-offset-ink sm:w-auto"
            >
              Open the platform
              <ArrowRight
                aria-hidden
                className="h-4 w-4 transition-transform duration-300 ease-out-expo group-hover:translate-x-1"
              />
            </Link>

            <Link
              href="/domain"
              className="lp-focus group inline-flex min-h-touch items-center gap-2 text-body font-medium text-slate-400 transition-colors hover:text-white ring-offset-ink"
            >
              Read the research
              <ArrowRight
                aria-hidden
                className="h-3.5 w-3.5 text-gold transition-transform duration-300 ease-out-expo group-hover:translate-x-1"
              />
            </Link>
          </div>
        </div>
      </Container>

      {/* Figures, pinned to the foot of the first screen. */}
      <Container
        className="relative animate-fade-up"
        style={{ animationDelay: "320ms" }}
      >
        <StatsStrip />
      </Container>
    </section>
  );
}
