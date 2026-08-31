"use client";

import { useState } from "react";
import {
  Box,
  FileDown,
  Loader2,
  Map as MapIcon,
  RefreshCw,
  Satellite,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildFeasibilityLedgerPdf,
  downloadBlob,
  LEDGER_FILENAME,
} from "@/lib/feasibility-pdf";
import { gisProvenance, type Impact } from "@/lib/feasibility-insights";
import { useFeasibility } from "./FeasibilityContext";
import { DynamicSatelliteMap } from "./DynamicSatelliteMap";
import { DynamicLand3DViewer } from "./DynamicLand3DViewer";
import { BuildabilityGauge } from "./BuildabilityGauge";
import { SiteMetricGrid } from "./SiteMetricGrid";
import { SiteInsightsPanel } from "./SiteInsightsPanel";
import { NextStepsPanel } from "./NextStepsPanel";
import { SurveyMistakesCard } from "./SurveyMistakesCard";

const PROVENANCE_DOT: Record<Impact, string> = {
  positive: "bg-emerald-500",
  neutral: "bg-amber-500",
  negative: "bg-orange-500",
};

export function AnalysisTab() {
  const {
    anchor,
    address,
    feasibility,
    boundary,
    audit,
    analyzing,
    activeProject,
    ledger,
    setAnchor,
    refreshAnalysis,
  } = useFeasibility();
  const [view, setView] = useState<"2d" | "3d">("3d");

  if (!anchor) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
        <MapIcon className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm text-slate-500">
          Set a Satellite Anchor in <strong>Parcel Search</strong> to run the
          multi-factor feasibility analysis.
        </p>
      </div>
    );
  }

  const handlePdf = () => {
    if (!ledger) return;
    downloadBlob(
      buildFeasibilityLedgerPdf(ledger, activeProject?.name ?? "Untitled"),
      LEDGER_FILENAME
    );
  };

  // The 2D map needs only an anchor; the 3D model needs a completed analysis.
  // Fall back to the map only when there is no analysis in flight to wait for.
  const showMap = view === "2d" || (!feasibility && !analyzing);
  const provenance = feasibility ? gisProvenance(feasibility) : null;
  const viewerKey = `${anchor.lat.toFixed(5)},${anchor.lon.toFixed(5)}:${Math.round(
    (boundary?.lot_area_sqm ?? 0) / 50
  )}`;

  return (
    <div className="space-y-6">
      {/* ---- Top bar ---- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-slate-400">
            {address || "Custom coordinate"}
          </p>
          <p className="font-mono text-sm font-semibold text-slate-700">
            {anchor.lat.toFixed(6)}, {anchor.lon.toFixed(6)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {provenance && (
              <span
                title={provenance.detail}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600"
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    PROVENANCE_DOT[provenance.tone]
                  )}
                />
                Analysis basis: {provenance.label}
              </span>
            )}
            {feasibility && (
              <span className="text-[11px] text-slate-400">
                Generated{" "}
                {new Date(feasibility.generated_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setView("2d")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold",
                showMap
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500"
              )}
            >
              <Satellite className="h-3.5 w-3.5" /> 2D
            </button>
            <button
              type="button"
              onClick={() => setView("3d")}
              disabled={!feasibility}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold disabled:opacity-40",
                !showMap
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500"
              )}
            >
              <Box className="h-3.5 w-3.5" /> 3D
            </button>
          </div>
          <button
            type="button"
            onClick={() => void refreshAnalysis()}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:border-gold/40 disabled:opacity-50"
          >
            {analyzing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </button>
          <button
            type="button"
            onClick={handlePdf}
            disabled={!ledger}
            className="inline-flex items-center gap-1.5 rounded-lg bg-charcoal px-3 py-2 text-xs font-medium text-white hover:bg-charcoal-light disabled:opacity-50"
          >
            <FileDown className="h-3.5 w-3.5 text-gold" /> Export PDF
          </button>
        </div>
      </div>

      {/* ---- Main: viewer + score ---- */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div className="lg:sticky lg:top-4">
          {showMap ? (
            <DynamicSatelliteMap
              anchor={anchor}
              onAnchorChange={(a) => void setAnchor(a, address ?? undefined)}
              lotGeoJson={boundary?.lot_geojson}
              buildZoneGeoJson={boundary?.build_zone_geojson}
            />
          ) : feasibility ? (
            <DynamicLand3DViewer
              key={viewerKey}
              transect={feasibility.topography.transect_ew_m}
              slopeDeg={feasibility.topography.slope_deg}
              elevationM={feasibility.topography.elevation_m}
              anchor={anchor}
              buildZonePolygonM={boundary?.build_zone_polygon_m ?? []}
              lotPolygonM={boundary?.lot_polygon_m ?? []}
            />
          ) : (
            <div className="flex h-[440px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm text-slate-400 lg:h-[520px]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-gold" />
              Building the 3D site model…
            </div>
          )}
        </div>

        <div>
          {analyzing && !feasibility && (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-5 text-sm text-slate-500 shadow-luxury">
              <Loader2 className="h-4 w-4 animate-spin text-gold" /> Analyzing
              site…
            </div>
          )}
          {feasibility && (
            <BuildabilityGauge
              score={feasibility.buildability_score}
              rating={feasibility.rating}
              factors={feasibility.factors}
            />
          )}
        </div>
      </div>

      {/* ---- Analytical cards ---- */}
      {feasibility && (
        <SiteMetricGrid feasibility={feasibility} boundary={boundary} />
      )}

      {/* ---- Site insights ---- */}
      {feasibility && (
        <SiteInsightsPanel feasibility={feasibility} boundary={boundary} />
      )}

      {/* ---- Next steps ---- */}
      {feasibility && (
        <NextStepsPanel feasibility={feasibility} boundary={boundary} />
      )}

      {/* ---- Survey / regulatory audit (existing feature) ---- */}
      <SurveyMistakesCard audit={audit} />
    </div>
  );
}
