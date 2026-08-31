"use client";

import {
  CloudRain,
  Mountain,
  Ruler,
  Sprout,
  TriangleRight,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { BoundaryResult, FeasibilityResult } from "@/lib/land-validation";
import { SQM_PER_PERCH } from "@/lib/geo";
import {
  cleanReason,
  floodSourceLabel,
  formatSqm,
  slopeBand,
  transectStats,
  weatherProvenance,
  type Impact,
} from "@/lib/feasibility-insights";
import { ElevationProfileChart } from "./ElevationProfileChart";

const BADGE: Record<Impact | "muted", string> = {
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  neutral: "bg-amber-50 text-amber-700 ring-amber-600/20",
  negative: "bg-orange-50 text-orange-700 ring-orange-600/20",
  muted: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

function Badge({
  tone = "muted",
  children,
}: {
  tone?: Impact | "muted";
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${BADGE[tone]}`}
    >
      {children}
    </span>
  );
}

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-luxury">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4" aria-hidden />
        <h3 className="text-[11px] font-bold uppercase tracking-wider">{title}</h3>
      </div>
      <div className="mt-3 flex-1">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-xs text-slate-500">{label}</span>
      <span
        className={
          strong
            ? "text-right text-sm font-bold text-slate-900"
            : "text-right text-sm font-medium text-slate-700"
        }
      >
        {value}
      </span>
    </div>
  );
}

function NotAvailable({ hint }: { hint: string }) {
  return (
    <div className="flex h-full flex-col justify-center">
      <p className="text-sm font-semibold text-slate-400">Not available</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>
    </div>
  );
}

export function SiteMetricGrid({
  feasibility,
  boundary,
}: {
  feasibility: FeasibilityResult;
  boundary: BoundaryResult | null;
}) {
  const { topography, terrain, flood, weather, factors } = feasibility;
  const stats = transectStats(topography.transect_ew_m);
  const slope = slopeBand(topography.slope_deg);

  const floodFactor = factors.find((f) => f.key === "flood");
  const weatherFactor = factors.find((f) => f.key === "weather");
  const wx = weatherProvenance(feasibility);

  const floodTone: Impact =
    flood.risk_band === "Low"
      ? "positive"
      : flood.risk_band === "Moderate"
      ? "neutral"
      : "negative";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {/* 1 · Lot area */}
      <Card icon={Ruler} title="Lot Area">
        {boundary ? (
          <div>
            <p className="text-xs text-slate-500">Total lot area</p>
            <p className="text-xl font-bold text-slate-900">
              {(boundary.lot_area_sqm / SQM_PER_PERCH).toFixed(1)} perches
            </p>
            <p className="text-[11px] text-slate-500">
              {formatSqm(boundary.lot_area_sqm)}
              {boundary.calibrated ? " · calibrated" : " · indicative"}
            </p>
            <div className="mt-3 border-t border-slate-100 pt-2">
              <Row
                label="Buildable area"
                value={formatSqm(boundary.build_zone_area_sqm)}
                strong
              />
              <div className="mt-1 flex items-center justify-between">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{
                      width: `${Math.min(100, boundary.plot_coverage_pct)}%`,
                    }}
                  />
                </div>
                <span className="ml-2 shrink-0 text-xs font-bold text-emerald-700">
                  {boundary.plot_coverage_pct}%
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Buildable envelope after UDA setbacks (max{" "}
                {boundary.max_plot_coverage_pct}% plot coverage)
              </p>
            </div>
          </div>
        ) : (
          <NotAvailable hint="Mark or calibrate a boundary in Parcel Search to size the lot." />
        )}
      </Card>

      {/* 2 · Terrain / zoning */}
      <Card icon={Sprout} title="Terrain / Zoning">
        <Row label="Land cover" value={terrain.worldcover_class} strong />
        <Row label="Buildability" value={terrain.suitability} />
        <Row label="Land use / zoning" value="Not verified" />
        <p className="mt-2 text-[11px] text-slate-400">
          {terrain.penalty_note ??
            "No major clearance constraint from land-cover analysis."}
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          Land cover:{" "}
          {terrain.source === "gee" ? "ESA WorldCover 10 m" : "modelled"} · setbacks
          &amp; coverage assume UDA Gazette 2021 residential rules.
        </p>
      </Card>

      {/* 3 · Elevation */}
      <Card icon={Mountain} title="Elevation">
        {stats ? (
          <div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Min
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {stats.min.toFixed(0)} m
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Avg
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {stats.avg.toFixed(0)} m
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Max
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {stats.max.toFixed(0)} m
                </p>
              </div>
            </div>
            <div className="mt-2">
              <ElevationProfileChart
                transect={topography.transect_ew_m}
                compact
              />
            </div>
            <p className="text-[11px] text-slate-400">
              {stats.relief.toFixed(1)} m of relief across the E–W section ·
              source: {topography.source === "gee" ? "SRTM 30 m DEM" : "modelled"}
            </p>
          </div>
        ) : (
          <Row
            label="Elevation"
            value={`${topography.elevation_m.toFixed(1)} m`}
            strong
          />
        )}
      </Card>

      {/* 4 · Slope analysis */}
      <Card icon={TriangleRight} title="Slope Analysis">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500">Representative slope</p>
            <p className="text-xl font-bold text-slate-900">
              {topography.slope_deg.toFixed(1)}°
            </p>
          </div>
          <Badge tone={slope.tone}>{slope.suitability}</Badge>
        </div>
        <div className="relative mt-2 h-2 w-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-orange-500">
          <div
            className="absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900 ring-2 ring-white"
            style={{
              left: `${Math.max(0, Math.min(100, (topography.slope_deg / 30) * 100))}%`,
            }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>0°</span>
          <span>30°+</span>
        </div>
        <Row label="Suitability" value={slope.suitability} />
        <Row label="Earthwork" value={slope.earthwork} />
        <p className="mt-1 text-[11px] text-slate-400">
          DEM point slope · source:{" "}
          {topography.source === "gee" ? "SRTM Terrain analysis" : "modelled"}
        </p>
      </Card>

      {/* 5 · Flood risk */}
      <Card icon={Waves} title="Flood Risk">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Risk level</p>
          <Badge tone={floodTone}>{flood.risk_band}</Badge>
        </div>
        <Row
          label="Historical water occurrence"
          value={`${flood.water_occurrence_pct.toFixed(1)}%`}
          strong
        />
        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          {floodFactor
            ? cleanReason(floodFactor.reason)
            : `${flood.risk_band} surface-water exposure.`}
        </p>
        <p className="mt-2 text-[11px] text-slate-400">
          Data source: {floodSourceLabel(feasibility)}
        </p>
      </Card>

      {/* 6 · Weather conditions */}
      <Card icon={CloudRain} title="Weather Conditions">
        {weather.source === "open-meteo" ? (
          <div>
            <Row
              label="Temperature"
              value={
                weather.temperature_2m != null
                  ? `${weather.temperature_2m.toFixed(0)}°C`
                  : "—"
              }
              strong
            />
            <Row
              label="Humidity"
              value={
                weather.relative_humidity_2m != null
                  ? `${weather.relative_humidity_2m.toFixed(0)}%`
                  : "—"
              }
            />
            <Row
              label="Rainfall (7-day)"
              value={
                weather.precipitation_sum_7d != null
                  ? `${weather.precipitation_sum_7d.toFixed(0)} mm · ${weather.rainfall_exposure}`
                  : weather.rainfall_exposure
              }
            />
            <Row
              label="UV / solar"
              value={
                weather.uv_index_max != null
                  ? `${weather.uv_index_max.toFixed(0)} · ${weather.solar_exposure}`
                  : weather.solar_exposure
              }
            />
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="text-xs text-slate-500">Construction impact</span>
              <Badge
                tone={
                  weatherFactor && weatherFactor.factor_score >= 85
                    ? "positive"
                    : weatherFactor && weatherFactor.factor_score >= 55
                    ? "neutral"
                    : "negative"
                }
              >
                {weatherFactor && weatherFactor.factor_score >= 85
                  ? "Low risk"
                  : weatherFactor && weatherFactor.factor_score >= 55
                  ? "Manageable"
                  : "Elevated"}
              </Badge>
            </div>
            {weatherFactor && (
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                {cleanReason(weatherFactor.reason)}
              </p>
            )}
          </div>
        ) : (
          <NotAvailable hint={wx.detail} />
        )}
      </Card>
    </div>
  );
}
