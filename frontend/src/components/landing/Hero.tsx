import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/landing/primitives/Section";
import { StatsStrip } from "@/components/landing/StatsStrip";

/** Corner tick, as found on a drawing sheet. Four of these frame the hero. */
function RegistrationMark({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute h-3.5 w-3.5 border-gold/30 ${className}`}
    />
  );
}

/**
 * Home hero.
 *
 * A centred column of type on a quiet ground — no illustration, no render.
 *
 * The section is sized by its own padding rather than by a viewport minimum
 * with the copy centred inside it. Centring in a tall box is what opened the
 * gap under the bar: the copy drifted to the middle of the screen no matter
 * how little of it there was. It now starts a measured distance below the nav
 * and the section ends where the content does.
 *
 * This is a server component — nothing here is interactive beyond two links,
 * and the entrance is plain CSS, so the copy renders whether or not hydration
 * happens. `prefers-reduced-motion` neutralises the motion via globals.css.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="lp-grain relative isolate overflow-hidden bg-ink pb-12 pt-16 sm:pt-20 lg:pb-14 lg:pt-24"
    >
      <div aria-hidden className="lp-grid lp-grid-mask absolute inset-0 -z-20" />

      {/* A single soft lift behind the headline, so the centred column sits on
          something rather than floating on flat ink. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/3 -z-10 h-[26rem] w-[44rem] max-w-[130vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/[0.05] blur-[110px]"
      />

      {/* Sheet registration marks. */}
      <RegistrationMark className="left-5 top-7 border-l border-t sm:left-8 lg:left-12" />
      <RegistrationMark className="right-5 top-7 border-r border-t sm:right-8 lg:right-12" />
      <RegistrationMark className="bottom-6 left-5 border-b border-l sm:left-8 lg:left-12" />
      <RegistrationMark className="bottom-6 right-5 border-b border-r sm:right-8 lg:right-12" />

      <Container className="relative">
        <div className="mx-auto max-w-4xl text-center">
          <p className="lp-label animate-fade-up text-slate-500">
            Pre-construction intelligence
          </p>

          <h1
            id="hero-heading"
            className="mt-6 animate-fade-up font-display text-display-sm font-semibold tracking-display text-white sm:text-display-lg lg:text-display-xl"
            style={{ animationDelay: "60ms" }}
          >
            Check the build{" "}
            <span className="sm:block">
              before you break ground.
            </span>
          </h1>

          <p
            className="mx-auto mt-7 max-w-[33rem] animate-fade-up text-lg leading-[1.6] text-slate-400"
            style={{ animationDelay: "140ms" }}
          >
            Site, plan, approvals and cost — checked from the drawings you
            already have.
          </p>

          <div
            className="mt-10 flex animate-fade-up flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6"
            style={{ animationDelay: "220ms" }}
          >
            <Link
              href="/login"
              className="lp-focus group inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-gold px-6 text-body font-semibold text-ink transition-colors hover:bg-gold-light ring-offset-ink sm:w-auto"
            >
              Open the platform
              <ArrowRight
                aria-hidden
                className="h-4 w-4 transition-transform duration-300 ease-out-expo group-hover:translate-x-1"
              />
            </Link>

            <Link
              href="/domain"
              className="lp-focus group inline-flex h-11 items-center gap-2 text-body font-medium text-slate-400 transition-colors hover:text-white ring-offset-ink"
            >
              Read the research
              <ArrowRight
                aria-hidden
                className="h-3.5 w-3.5 text-gold transition-transform duration-300 ease-out-expo group-hover:translate-x-1"
              />
            </Link>
          </div>
        </div>

        <div
          className="mt-14 animate-fade-up sm:mt-16"
          style={{ animationDelay: "320ms" }}
        >
          <StatsStrip />
        </div>
      </Container>
    </section>
  );
}
