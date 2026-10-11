"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { PROJECT_TITLE, SITE_TABS } from "@/components/landing/data/site";

/**
 * Site navigation.
 *
 * Deliberately light: a compact bar, small links, and a hairline that only
 * appears once the page has scrolled, so the hero reads as one surface with
 * the bar rather than sitting beneath a heavy header.
 */
export function SiteNav() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the sheet whenever the route changes.
  useEffect(() => setIsMenuOpen(false), [pathname]);

  // Lock background scrolling while the sheet is open.
  useEffect(() => {
    if (!isMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMenuOpen]);

  /** Home matches exactly; every other tab also matches its subpaths. */
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-300",
        isScrolled
          ? "border-white/10 bg-ink/80 backdrop-blur-xl"
          : "border-transparent bg-ink"
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-14 w-full max-w-shell items-center gap-6 px-5 sm:px-8 lg:h-16 lg:px-12"
      >
        <Link
          href="/"
          className="lp-focus flex shrink-0 items-center gap-2 rounded-md ring-offset-ink"
        >
          {/* Mark: a plan outline with a setback line, drawn rather than
              lettered, so the wordmark beside it carries the name. */}
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-[1.375rem] w-[1.375rem] shrink-0"
          >
            <rect width="24" height="24" rx="5" className="fill-gold" />
            <path
              d="M6.5 17V8.6L12 6l5.5 2.6V17"
              fill="none"
              stroke="#0F172A"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path
              d="M6.5 13.4h11"
              stroke="#0F172A"
              strokeWidth="1.7"
              strokeLinecap="round"
              opacity="0.45"
            />
          </svg>
          <span className="font-display text-[0.9375rem] font-semibold tracking-snug text-white">
            {PROJECT_TITLE}
          </span>
        </Link>

        {/* Desktop tabs, grouped to the right rather than stretched across. */}
        <ul className="ml-auto hidden items-center gap-0.5 lg:flex">
          {SITE_TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "lp-focus rounded-md px-2.5 py-1.5 text-caption font-medium transition-colors ring-offset-ink",
                    active
                      ? "bg-white/[0.07] text-white"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex items-center gap-1 lg:ml-5">
          <Link
            href="/login"
            className="lp-focus hidden h-9 items-center rounded-md border border-white/15 px-3.5 text-caption font-semibold text-slate-200 transition-colors hover:border-white/30 hover:text-white ring-offset-ink sm:inline-flex"
          >
            Platform
          </Link>

          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-controls="site-mobile-menu"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            className="lp-focus -mr-2 grid h-11 w-11 place-items-center rounded-md text-slate-300 transition-colors hover:text-white ring-offset-ink lg:hidden"
          >
            {isMenuOpen ? (
              <X aria-hidden className="h-5 w-5" />
            ) : (
              <Menu aria-hidden className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile sheet. */}
      <div
        id="site-mobile-menu"
        hidden={!isMenuOpen}
        className="border-t border-white/10 bg-ink lg:hidden"
      >
        <ul className="mx-auto max-w-shell px-5 py-3 sm:px-8">
          {SITE_TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "lp-focus flex min-h-touch items-center justify-between gap-4 rounded-md px-3 transition-colors ring-offset-ink",
                    active ? "bg-white/[0.07] text-white" : "text-slate-400"
                  )}
                >
                  <span className="text-body font-medium">{tab.label}</span>
                  {active ? (
                    <span aria-hidden className="h-1 w-1 rounded-full bg-gold" />
                  ) : null}
                </Link>
              </li>
            );
          })}
          <li className="mt-2 border-t border-white/10 pt-3">
            <Link
              href="/login"
              className="lp-focus flex min-h-touch items-center justify-center rounded-md bg-gold px-4 text-body font-semibold text-ink ring-offset-ink"
            >
              Open the platform
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
}
