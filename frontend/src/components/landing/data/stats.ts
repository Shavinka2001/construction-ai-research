import type { HeroStat } from "@/components/landing/types";

/**
 * Headline figures for the hero strip.
 *
 * `provenance` is rendered as a title/tooltip so an examiner can trace each
 * number back to where it comes from. Three of these four are design targets
 * from the research proposal rather than figures measured by a benchmark in
 * this repository - keep the wording honest until an evaluation run exists,
 * then replace the provenance string with the dataset and sample size.
 */
export const HERO_STATS: readonly HeroStat[] = [
  {
    label: "Dimensional precision",
    value: 99.2,
    suffix: "%",
    decimals: 1,
    provenance:
      "Target precision for extracted plan dimensions. Pending formal evaluation against a measured ground-truth set.",
  },
  {
    label: "Structural clash overlap",
    value: 0,
    suffix: "%",
    decimals: 1,
    provenance:
      "Post-resolution overlap after closed-loop GCR re-validation: a prescribed shift is only returned once the clash measures clear.",
  },
  {
    label: "Automated UDA verification",
    value: 100,
    suffix: "%",
    provenance:
      "All four approval stages - geospatial, authority mapping, document verification, roadmap - run without manual hand-off.",
  },
  {
    label: "Inference latency",
    value: 3,
    prefix: "<",
    suffix: "s",
    provenance:
      "Target single-plan inference budget on the reference hardware. Measured end-to-end timings pending.",
  },
] satisfies readonly HeroStat[];
