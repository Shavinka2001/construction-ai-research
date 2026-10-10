import type { SiteTab } from "@/components/landing/types";

/**
 * The top-level tab structure required by the project web guidelines.
 *
 * The order and the labels follow the brief: Home, Domain, Milestones,
 * Documents, Slides of past presentations, About us, Contact us. Keep them in
 * step with the routes under `src/app/(site)/`.
 */
export const SITE_TABS: readonly SiteTab[] = [
  {
    href: "/",
    label: "Home",
    blurb: "An introduction to the project in abstract.",
  },
  {
    href: "/domain",
    label: "Domain",
    blurb:
      "Literature survey, research gap, problem, objectives, methodology and technologies.",
  },
  {
    href: "/milestones",
    label: "Milestones",
    blurb: "Every assessment, with its date and the marks allocated.",
  },
  {
    href: "/documents",
    label: "Documents",
    blurb: "Documents submitted and still pending.",
  },
  {
    href: "/slides",
    label: "Presentations",
    blurb: "Slide decks from past presentations.",
  },
  {
    href: "/about",
    label: "About us",
    blurb: "The research group and supervision.",
  },
  {
    href: "/contact",
    label: "Contact us",
    blurb: "How to reach the group.",
  },
] satisfies readonly SiteTab[];

export const PROJECT_TITLE = "Construction AI";

export const PROJECT_SUBTITLE =
  "Intelligent AI-Driven Pre-Construction Feasibility Analyzer";
