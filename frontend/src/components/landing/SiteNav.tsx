"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { PROJECT_TITLE, SITE_TABS } from "@/components/landing/data/site";

export function SiteNav() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Condense the bar once the page scrolls.
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 16);
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

  /** Home only matches exactly; every other tab also matches its subpaths. */
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 bg-ink transition-shadow duration-300",
        isScrolled && "shadow-[0_1px_0_0_rgba(255,255,255,0.1)]"
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-shell items-center justify-between gap-4 px-5 sm:px-8 lg:h-[4.5rem] lg:px-12"
      >
        <Link
          href="/"
          className="lp-focus group flex shrink-0 items-center gap-2.5 ring-offset-ink"
        >
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center bg-gold font-display text-caption font-bold text-ink"
          >
            CA
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-body font-bold tracking-snug text-white">
              {PROJECT_TITLE}
            </span>
            <span className="mt-1 font-mono text-label-xs uppercase tracking-label-wide text-slate-500">
              Research project
            </span>
          </span>
        </Link>

        {/* Desktop tabs. */}
        <ul className="hidden items-center lg:flex">
          {SITE_TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "lp-focus relative flex h-[4.5rem] items-center px-3.5 text-caption font-medium transition-colors ring-offset-ink xl:px-4",
                    active ? "text-white" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  {tab.label}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-3.5 bottom-0 h-0.5 bg-gold transition-transform duration-200 xl:inset-x-4",
                      active ? "scale-x-100" : "scale-x-0"
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
            className="lp-focus hidden min-h-touch items-center gap-1.5 bg-gold px-4 text-caption font-bold text-ink transition-colors hover:bg-gold-light ring-offset-ink sm:inline-flex"
          >
            Platform
            <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
          </Link>

          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-controls="site-mobile-menu"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            className="lp-focus grid h-11 w-11 place-items-center border border-white/15 text-slate-200 transition-colors hover:bg-white/5 ring-offset-ink lg:hidden"
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
        <ul className="mx-auto max-w-shell px-5 py-2 sm:px-8">
          {SITE_TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "lp-focus flex min-h-touch flex-col justify-center border-b border-white/5 py-3 ring-offset-ink",
                    active ? "text-white" : "text-slate-400"
                  )}
                >
                  <span className="flex items-center gap-2 text-body font-semibold">
                    {active ? (
                      <span aria-hidden className="h-3 w-0.5 bg-gold" />
                    ) : null}
                    {tab.label}
                  </span>
                  <span className="mt-0.5 text-micro leading-snug text-slate-500">
                    {tab.blurb}
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="py-4">
            <Link
              href="/login"
              className="lp-focus flex min-h-touch items-center justify-center gap-1.5 bg-gold px-4 text-body font-bold text-ink ring-offset-ink"
            >
              Open the platform
              <ArrowUpRight aria-hidden className="h-4 w-4" />
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
}
