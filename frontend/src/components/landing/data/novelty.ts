import { GitMerge, Leaf, Wand2 } from "lucide-react";

import type { NoveltyClaim } from "@/components/landing/types";

/**
 * Research gap contributions, each with a pointer to the implementing module so
 * a claim can be demonstrated on the spot during the viva.
 */
export const NOVELTY_CLAIMS: readonly NoveltyClaim[] = [
  {
    id: "prescriptive-clash",
    title: "Prescriptive, not descriptive, clash resolution",
    priorArt:
      "Commercial BIM coordination reports a clash and stops there. The engineer is left to decide what to move, by how much, and whether the move introduces a new conflict.",
    contribution:
      "A closed loop computes the minimal clearance shift, applies it, and re-measures the overlap before the recommendation is ever surfaced. A fix is only proposed once it has been proven to resolve the clash.",
    evidence:
      "compute_minimal_clearance_shift / closed_loop_revalidate / build_verified_gcr_recommendation in backend/app/services/clash_detection.py",
    icon: GitMerge,
  },
  {
    id: "single-plan-synthesis",
    title: "Structural synthesis from a single 2D plan (AI-GSL)",
    priorArt:
      "Clash detection presumes that both an architectural and a structural model already exist. Small practices and self-builders rarely have the second one.",
    contribution:
      "When no structural sheet is supplied, a clash-free column grid is generated from the architectural plan alone: wall corner and L/T/X junctions seed candidates, any candidate intersecting a door or window clear opening is rejected, and 3-5 m bay spacing is enforced along long spans.",
    evidence:
      "generate_structural_grid in backend/app/services/generative_structural_layout.py",
    icon: Wand2,
  },
  {
    id: "passive-design-verification",
    title: "Automated green building & passive design verification",
    priorArt:
      "Natural ventilation and daylight provisions are audited by hand against the building code, late in the approval cycle, long after the design has been committed.",
    contribution:
      "Passive performance is derived straight from plan geometry: window-to-floor ratio against the 10% daylight minimum, cross-ventilation from opposite openings per room contour, west-facing solar heat gain, and minimum room area and clear width.",
    evidence:
      "analyze_cross_ventilation / analyze_solar_gain / analyze_room_code_compliance in backend/app/services/architectural_audit.py",
    icon: Leaf,
  },
] satisfies readonly NoveltyClaim[];
