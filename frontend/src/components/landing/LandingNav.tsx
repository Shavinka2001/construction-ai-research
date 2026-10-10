"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#overview", label: "Overview" },
  { href: "#engines", label: "The 4 Engines" },
  { href: "#architecture", label: "Architecture" },
  { href: "#novelty", label: "Research Novelty" },
  { href: "#team", label: "Team" },
] as const;

const SECTION_IDS = NAV_LINKS.map((link) => link.href.slice(1));

export function LandingNav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>(SECTION_IDS[0]);

  // Swap the bar to its condensed, frosted state once the hero scrolls away.
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-spy. The top band is discounted so a section only becomes active
  // once it sits under the sticky bar rather than merely peeking into view.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0.05, 0.25, 0.5] }
    );

    for (const id of SECTION_IDS) {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    }

    return () => observer.disconnect();
  }, []);

  // Lock background scrolling while the mobile sheet is open.
  useEffect(() => {
    if (!isMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMenuOpen]);

  // Escape closes the sheet.
  useEffect(() => {
    if (!isMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMenuOpen]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        isScrolled
          ? "border-b border-white/10 bg-ink/85 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-shell items-center justify-between gap-4 px-4 sm:h-20 sm:px-6 lg:px-8"
      >
        <Link
          href="#overview"
          className="lp-focus group flex shrink-0 items-center gap-2.5 rounded-lg ring-offset-ink"
        >
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-gold-light to-gold-dark font-display text-sm font-black text-ink shadow-glow-gold"
          >
            CA
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-[0.9375rem] font-bold tracking-tight text-white">
              Construction AI
            </span>
            <span className="mt-0.5 text-[0.625rem] font-medium uppercase tracking-[0.16em] text-slate-400">
              Research Platform
            </span>
          </span>
        </Link>

        {/* Desktop links */}
        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => {
            const isActive = activeId === link.href.slice(1);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "lp-focus relative rounded-lg px-3 py-2 text-sm font-medium transition-colors ring-offset-ink",
                    isActive
                      ? "text-white"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  {link.label}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-gold transition-transform duration-300",
                      isActive ? "scale-x-100" : "scale-x-0"
                    )}
                  />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="lp-focus hidden min-h-touch items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-bold text-ink transition hover:bg-gold-light active:scale-[0.98] ring-offset-ink sm:inline-flex"
          >
            Launch Platform
            <ArrowUpRight aria-hidden className="h-4 w-4" />
          </Link>

          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-controls="landing-mobile-menu"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            className="lp-focus grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 ring-offset-ink lg:hidden"
          >
            {isMenuOpen ? (
              <X aria-hidden className="h-5 w-5" />
            ) : (
              <Menu aria-hidden className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile sheet */}
      <div
        id="landing-mobile-menu"
        hidden={!isMenuOpen}
        className="border-t border-white/10 bg-ink/95 backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto flex max-w-shell flex-col gap-1 px-4 py-4 sm:px-6">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "lp-focus flex min-h-touch items-center rounded-xl px-4 text-base font-medium transition-colors ring-offset-ink",
                  activeId === link.href.slice(1)
                    ? "bg-white/10 text-white"
                    : "text-slate-300 hover:bg-white/5"
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li className="mt-2">
            <Link
              href="/login"
              onClick={() => setIsMenuOpen(false)}
              className="lp-focus flex min-h-touch items-center justify-center gap-1.5 rounded-xl bg-gold px-4 text-base font-bold text-ink ring-offset-ink"
            >
              Launch Platform
              <ArrowUpRight aria-hidden className="h-4 w-4" />
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
}
