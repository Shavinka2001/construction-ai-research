/**
 * Pure, deterministic derivations for the Site Feasibility → Analysis dashboard.
 *
 * IMPORTANT: nothing in this file invents analytical values. Every output is a
 * re-shaping of data the backend already returned in `FeasibilityResult` /
 * `BoundaryResult` (see `land_analyzer_service.py`, `boundary_geomarking_service.py`):
 *   - factor impact comes from the ✓ / ⚠ / • prefix the backend writes on every
 *     `ScoreFactor.reason`
 *   - "strengths" / "constraints" are those same backend reasons, grouped
 *   - "recommendations" / "next steps" are standard pre-construction actions,
 *     shown only when a real backend score/flag calls for them
 *   - data provenance is the backend `*.source` field ("gee" vs "synthetic",
 *     "open-meteo" vs "unavailable") and `boundary.calibrated`
 *
 * Shared by `AnalysisTab` and `feasibility-pdf.ts` so the screen and the PDF
 * never drift apart.
 */

import { SQM_PER_PERCH } from "@/lib/geo";
import type {
  BoundaryResult,
  FeasibilityResult,
  ScoreFactor,
} from "@/lib/land-validation";

export type Impact = "positive" | "neutral" | "negative";

export const IMPACT_LABEL: Record<Impact, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

/** The analyzer prefixes every factor reason with ✓ (good), ⚠ (risk) or • (n/a). */
export function factorImpact(reason: string): Impact {
  const t = (reason ?? "").trimStart();
  if (t.startsWith("✓")) return "positive"; // ✓
  if (t.startsWith("⚠")) return "negative"; // ⚠
  return "neutral";
}

/** Strip the leading ✓ / ⚠ / • / whitespace so the reason reads as a sentence. */
export function cleanReason(reason: string): string {
  return (reason ?? "").replace(/^[\s✓⚠•]+/, "").trim();
}

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const v = raw.trim();
    const key = v.toLowerCase();
    if (v && !seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

function factorsByKey(f: FeasibilityResult): Record<string, ScoreFactor> {
  return Object.fromEntries(f.factors.map((x) => [x.key, x])) as Record<
    string,
    ScoreFactor
  >;
}

// --------------------------------------------------------------------------- //
// Slope — mirrors the thresholds in `_slope_score()` on the backend
// --------------------------------------------------------------------------- //
export type SlopeBand = {
  suitability: string;
  earthwork: string;
  tone: Impact;
};

export function slopeBand(slopeDeg: number): SlopeBand {
  if (slopeDeg <= 5)
    return { suitability: "Excellent", earthwork: "Minimal", tone: "positive" };
  if (slopeDeg <= 10)
    return {
      suitability: "Good",
      earthwork: "Standard cut / fill",
      tone: "positive",
    };
  if (slopeDeg <= 20)
    return {
      suitability: "Moderate",
      earthwork: "Retaining walls likely",
      tone: "negative",
    };
  return {
    suitability: "Challenging",
    earthwork: "Significant geotechnical work",
    tone: "negative",
  };
}

// --------------------------------------------------------------------------- //
// Rating / score → colour band (kept identical to BuildabilityGauge history)
// --------------------------------------------------------------------------- //
export function bandColor(score: number): string {
  if (score >= 85) return "#15803d";
  if (score >= 70) return "#4d7c0f";
  if (score >= 55) return "#B8942E";
  if (score >= 40) return "#c2410c";
  return "#b91c1c";
}

export function toneColor(tone: Impact): string {
  if (tone === "positive") return "#15803d";
  if (tone === "negative") return "#c2410c";
  return "#B8942E";
}

// --------------------------------------------------------------------------- //
// Data provenance — honest confidence signal from the backend `source` fields
// --------------------------------------------------------------------------- //
export type Provenance = {
  label: string;
  tone: Impact;
  detail: string;
};

export function gisProvenance(f: FeasibilityResult): Provenance {
  const live = f.topography.source === "gee";
  return live
    ? {
        label: "Earth Engine GIS",
        tone: "positive",
        detail:
          "Terrain, land cover and surface-water from Google Earth Engine (SRTM 30 m DEM, ESA WorldCover, JRC Global Surface Water).",
      }
    : {
        label: "Modelled terrain",
        tone: "neutral",
        detail:
          "Earth Engine key not configured — terrain, land cover and flood layers use a coordinate-seeded representative model.",
      };
}

export function weatherProvenance(f: FeasibilityResult): Provenance {
  return f.weather.source === "open-meteo"
    ? {
        label: "Open-Meteo",
        tone: "positive",
        detail: "Live forecast API — current conditions and 7-day outlook.",
      }
    : {
        label: "Unavailable",
        tone: "negative",
        detail: "Weather service could not be reached for this location.",
      };
}

export function floodSourceLabel(f: FeasibilityResult): string {
  return f.flood.source === "gee"
    ? "JRC Global Surface Water (satellite)"
    : "Modelled surface-water estimate";
}

// --------------------------------------------------------------------------- //
// Site insights — Strengths / Risks & constraints / Recommendations
// --------------------------------------------------------------------------- //
export type SiteInsights = {
  strengths: string[];
  constraints: string[];
  recommendations: string[];
};

export function deriveInsights(
  f: FeasibilityResult,
  b: BoundaryResult | null
): SiteInsights {
  const strengths: string[] = [];
  const constraints: string[] = [];
  const recommendations: string[] = [];

  let terrainSurfaced = false;
  for (const factor of f.factors) {
    const impact = factorImpact(factor.reason);
    const text = cleanReason(factor.reason);
    if (!text) continue;
    if (impact === "positive") strengths.push(text);
    else if (impact === "negative") constraints.push(text);
    if (factor.key === "terrain" && impact !== "neutral") terrainSurfaced = true;
  }

  // The penalty note is what drives the terrain factor — only surface it on its
  // own when that factor did not already carry the same point (either way).
  if (f.terrain.penalty_note && !terrainSurfaced) {
    constraints.push(f.terrain.penalty_note);
  }
  if (b && !b.calibrated) {
    constraints.push(
      "Lot area is not calibrated to a surveyed figure — boundary metrics are indicative."
    );
  }

  // Weather advisories are actions — but only when the service actually
  // responded ("unavailable" yields a non-actionable status string).
  if (f.weather.source === "open-meteo") {
    for (const advisory of f.weather.advisories) recommendations.push(advisory);
  }

  const byKey = factorsByKey(f);
  const slopeScore = byKey.slope?.factor_score ?? 100;
  const floodScore = byKey.flood?.factor_score ?? 100;
  const drainageEngineered = floodScore < 100;

  if (slopeScore < 78) {
    recommendations.push(
      "Involve a geotechnical engineer early for retaining-wall / terracing design."
    );
  } else if (slopeScore >= 100 && !drainageEngineered) {
    recommendations.push(
      "Minimal earthworks anticipated — retain the natural grade and existing drainage paths."
    );
  } else {
    recommendations.push(
      "Keep earthworks light — balance cut and fill and protect natural runoff where possible."
    );
  }
  if (drainageEngineered) {
    recommendations.push(
      "Design graded site drainage and set the finished floor level above the local flood datum."
    );
  }
  if (f.terrain.penalty_note && /tree|forest/i.test(f.terrain.penalty_note)) {
    recommendations.push(
      "Allow for site clearance, tree felling and stump removal in the enabling works."
    );
  }
  if (b) {
    recommendations.push(
      `Keep the building footprint inside the ${b.plot_coverage_pct}% buildable envelope and the UDA setbacks.`
    );
  }

  return {
    strengths: uniq(strengths),
    constraints: uniq(constraints),
    recommendations: uniq(recommendations),
  };
}

// --------------------------------------------------------------------------- //
// Next steps — standard pre-construction actions, gated on real signals
// --------------------------------------------------------------------------- //
export function deriveNextSteps(
  f: FeasibilityResult,
  b: BoundaryResult | null
): string[] {
  const byKey = factorsByKey(f);
  const steps: string[] = [
    "Detailed topographic & boundary survey by a licensed surveyor",
    "Geotechnical site investigation — boreholes / trial pits for foundation design",
  ];

  if ((byKey.slope?.factor_score ?? 100) < 78) {
    steps.push("Structural design for retaining walls / terracing on the slope");
  }
  if ((byKey.flood?.factor_score ?? 100) < 100) {
    steps.push("Stormwater and flood-mitigation drainage design");
  }
  if (f.terrain.penalty_note) {
    // Notes like "Trees / forest — budget for felling…" already read as a
    // directive; shorter ones ("Shrub clearance required") get a lead-in.
    const note = f.terrain.penalty_note;
    steps.push(
      note.includes("—")
        ? note
        : `Site preparation — ${note.charAt(0).toLowerCase()}${note.slice(1)}`
    );
  }
  if (!b || !b.calibrated) {
    steps.push("Confirm the lot extent against the title / registered survey plan");
  }

  steps.push("Detailed architectural & MEP design within the buildable envelope");
  steps.push("Planning approval submission to the UDA / local authority (Gazette 2021)");
  steps.push("Building permit application before construction starts");

  return uniq(steps);
}

// --------------------------------------------------------------------------- //
// Small formatting helpers (unit-preserving)
// --------------------------------------------------------------------------- //
export function formatSqm(sqm: number | null | undefined): string {
  if (sqm == null || !Number.isFinite(sqm)) return "Not available";
  return `${Math.round(sqm).toLocaleString()} m²`;
}

export function formatPerches(sqm: number | null | undefined): string {
  if (sqm == null || !Number.isFinite(sqm)) return "Not available";
  const perches = sqm / SQM_PER_PERCH;
  return `${perches.toFixed(perches < 100 ? 1 : 0)} perches`;
}

export function transectStats(transect: number[] | null | undefined): {
  min: number;
  max: number;
  avg: number;
  relief: number;
} | null {
  if (!transect || transect.length === 0) return null;
  const min = Math.min(...transect);
  const max = Math.max(...transect);
  const avg = transect.reduce((s, v) => s + v, 0) / transect.length;
  return { min, max, avg, relief: max - min };
}
