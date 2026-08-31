"use client";

import { useState } from "react";
import { Loader2, Map as MapIcon, Box, FileDown, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildFeasibilityLedgerPdf,
  downloadBlob,
  LEDGER_FILENAME,
} from "@/lib/feasibility-pdf";
import { useFeasibility } from "./FeasibilityContext";
import { DynamicSatelliteMap } from "./DynamicSatelliteMap";
import { DynamicLand3DViewer } from "./DynamicLand3DViewer";
import { BuildabilityGauge } from "./BuildabilityGauge";
import { MetricCards } from "./MetricCards";
import { ElevationProfileChart } from "./ElevationProfileChart";
import { SurveyMistakesCard } from "./SurveyMistakesCard";

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
  const [view, setView] = useState<"2d" | "3d">("2d");

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">{address || "Custom coordinate"}</p>
          <p className="font-mono text-sm text-slate-600">
            {anchor.lat.toFixed(6)}, {anchor.lon.toFixed(6)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setView("2d")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold",
                view === "2d" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              )}
            >
              <MapIcon className="h-3.5 w-3.5" /> 2D
            </button>
            <button
              type="button"
              onClick={() => setView("3d")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold",
                view === "3d" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
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

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          {view === "2d" ? (
            <DynamicSatelliteMap
              anchor={anchor}
              onAnchorChange={(a) => void setAnchor(a, address ?? undefined)}
              lotGeoJson={boundary?.lot_geojson}
              buildZoneGeoJson={boundary?.build_zone_geojson}
            />
          ) : feasibility ? (
            <DynamicLand3DViewer
              transect={feasibility.topography.transect_ew_m}
              slopeDeg={feasibility.topography.slope_deg}
              buildZonePolygonM={boundary?.build_zone_polygon_m ?? []}
              lotPolygonM={boundary?.lot_polygon_m ?? []}
            />
          ) : null}

          {feasibility && (
            <>
              <MetricCards feasibility={feasibility} boundary={boundary} />
              <ElevationProfileChart
                transect={feasibility.topography.transect_ew_m}
                slopeDeg={feasibility.topography.slope_deg}
              />
            </>
          )}
        </div>

        <div className="space-y-5">
          {analyzing && !feasibility && (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-5 text-sm text-slate-500 shadow-luxury">
              <Loader2 className="h-4 w-4 animate-spin text-gold" /> Analyzing site…
            </div>
          )}
          {feasibility && (
            <BuildabilityGauge
              score={feasibility.buildability_score}
              rating={feasibility.rating}
              factors={feasibility.factors}
            />
          )}
          <SurveyMistakesCard audit={audit} />
        </div>
      </div>
    </div>
  );
}
