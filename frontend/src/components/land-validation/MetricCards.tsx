"use client";

import {
  Mountain,
  TriangleRight,
  Ruler,
  CloudRain,
  Waves,
  Sprout,
} from "lucide-react";
import type {
  BoundaryResult,
  FeasibilityResult,
} from "@/lib/land-validation";

function Card({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Mountain;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-luxury">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4" aria-hidden />
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="mt-1.5 text-lg font-bold text-slate-900">{value}</p>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

export function MetricCards({
  feasibility,
  boundary,
}: {
  feasibility: FeasibilityResult;
  boundary: BoundaryResult | null;
}) {
  const { topography, terrain, flood, weather } = feasibility;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Card
        icon={Ruler}
        label="Lot Area"
        value={
          boundary
            ? `${boundary.lot_area_perches.toFixed(2)} P`
            : "—"
        }
        sub={
          boundary
            ? `${boundary.lot_area_sqm.toFixed(0)} m² · ${boundary.plot_coverage_pct}% buildable`
            : "Calibrate in Parcel Search"
        }
      />
      <Card
        icon={Sprout}
        label="Terrain / Zoning"
        value={terrain.worldcover_class}
        sub={`${terrain.suitability} · ${terrain.source}`}
      />
      <Card
        icon={Mountain}
        label="Elevation"
        value={`${topography.elevation_m.toFixed(1)} m`}
        sub={`source: ${topography.source}`}
      />
      <Card
        icon={TriangleRight}
        label="Slope"
        value={`${topography.slope_deg.toFixed(1)}°`}
        sub={topography.slope_deg <= 5 ? "Minimal earthworks" : "Cut / fill required"}
      />
      <Card
        icon={Waves}
        label="Flood Risk"
        value={flood.risk_band}
        sub={`${flood.water_occurrence_pct.toFixed(0)}% hist. water occurrence`}
      />
      <Card
        icon={weather.rainfall_exposure === "High" ? CloudRain : CloudRain}
        label="Weather"
        value={
          weather.temperature_2m != null
            ? `${weather.temperature_2m.toFixed(0)}°C`
            : weather.rainfall_exposure
        }
        sub={
          weather.source === "open-meteo"
            ? `${weather.relative_humidity_2m ?? "—"}% RH · rain ${weather.rainfall_exposure} · UV ${weather.uv_index_max ?? "—"}`
            : "weather service unavailable"
        }
      />
    </div>
  );
}
