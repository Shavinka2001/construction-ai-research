/**
 * Shared contracts for the public research landing page.
 *
 * Everything the page renders is data-driven from `./data/*` so content can be
 * updated without touching layout or animation code.
 */

import type { LucideIcon } from "lucide-react";

/**
 * How much of a research component is actually running in the platform.
 *
 * - `live`      — end-to-end implemented (backend service + UI + exports).
 * - `prototype` — UI and data contracts complete; the model/pipeline behind it
 *                 is still illustrative. Labelled honestly on the card.
 */
export type EngineMaturity = "live" | "prototype";

export type EngineCapability = {
  /** Short capability name, e.g. "Closed-loop GCR". */
  label: string;
  /** One line on what it does. Keep under ~120 chars for card layout. */
  detail: string;
};

export type EngineMetric = {
  label: string;
  value: string;
  /** Optional unit rendered in a lighter weight next to the value. */
  unit?: string;
};

export type Engine = {
  /** Anchor-safe id, also used as the React key. */
  id: string;
  /** Research component number (1-4). */
  index: number;
  title: string;
  /** Formal module name as written in the dissertation. */
  academicName: string;
  tagline: string;
  icon: LucideIcon;
  maturity: EngineMaturity;
  capabilities: readonly EngineCapability[];
  metrics: readonly EngineMetric[];
  /** Named tech actually present in the repo for this component. */
  stack: readonly string[];
  /** In-app route this engine ships behind (requires sign-in). */
  href: string;
  /** Bento span class — kept in data so the grid rhythm is declarative. */
  gridClass: string;
  /** Accent used for badges, glows and preview strokes. */
  accent: "gold" | "emerald";
};

export type HeroStat = {
  label: string;
  /** Numeric portion, animated by the count-up. */
  value: number;
  /** Rendered before the number, e.g. "<". */
  prefix?: string;
  /** Rendered after the number, e.g. "%" or "s". */
  suffix?: string;
  /** Decimal places to show while counting. */
  decimals?: number;
  /** Where the figure comes from — surfaced as a tooltip for examiners. */
  provenance: string;
};

export type StackLayer = "client" | "service" | "intelligence" | "persistence";

export type StackNode = {
  id: string;
  label: string;
  /** Sub-label, e.g. "App Router / RSC". */
  role: string;
  layer: StackLayer;
  icon: LucideIcon;
  /** Node ids this one sends data to. Drives the animated flow paths. */
  flowsTo: readonly string[];
  /** What travels along the outgoing edge. */
  payload: string;
};

export type NoveltyClaim = {
  id: string;
  /** Short academic handle, e.g. "Prescriptive Clash Resolution". */
  title: string;
  /** The gap in prior work. */
  priorArt: string;
  /** What this research adds. */
  contribution: string;
  /** Where it lives in the codebase — evidence for the viva. */
  evidence: string;
  icon: LucideIcon;
};

export type TeamMember = {
  id: string;
  name: string;
  /** Registration / index number, shown small under the name. */
  studentId?: string;
  /** Research component owned, e.g. "Component 2". */
  componentLabel: string;
  componentTitle: string;
  /** Git branch the member's work lands on — real, from the repository. */
  branch?: string;
  focusAreas: readonly string[];
};

export type Supervisor = {
  id: string;
  name: string;
  title: string;
  role: "Supervisor" | "Co-Supervisor";
};

export type Institution = {
  university: string;
  faculty: string;
  department: string;
  degree: string;
  academicYear: string;
};
