import { SiteNav } from "@/components/landing/SiteNav";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingScrollScope } from "@/components/landing/LandingScrollScope";

/**
 * Shell for the public project website.
 *
 * Applies to the seven tabs required by the project web guidelines (Home,
 * Domain, Milestones, Documents, Presentations, About us, Contact us) and to
 * nothing else — the dashboard and auth routes sit outside this group and keep
 * their own chrome.
 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <LandingScrollScope />

      <a
        href="#main"
        className="lp-focus sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-gold focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-ink"
      >
        Skip to content
      </a>

      <SiteNav />

      <main id="main" className="bg-white">
        {children}
      </main>

      <LandingFooter />
    </>
  );
}
