"use client";

import {
  Wind,
  Sun,
  BrickWall,
  CheckCircle2,
  AlertTriangle,
  Shield,
} from "lucide-react";
import type { ArchitecturalAudit } from "@/lib/clash-detection";
import { cn } from "@/lib/utils";

type ArchitecturalAuditCardProps = {
  audit: ArchitecturalAudit | null;
  hasLiveResult?: boolean;
};

export function ArchitecturalAuditCard({
  audit,
  hasLiveResult = false,
}: ArchitecturalAuditCardProps) {
  if (!audit) return null;

  const ventOk = audit.crossVentilation.status === "PASSED";
  const solarOk = audit.solarGain.status === "OK";
  const walls = audit.wallClassifications;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Component 2 · Green Building Intelligence
          </p>
          {hasLiveResult ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Live Audit
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Demo Preview
            </span>
          )}
        </div>
        <h2 className="mt-1 text-lg font-bold text-slate-900">
          AI Architectural Audit &amp; Passive Design
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Structural wall classification · cross-ventilation · solar heat gain
        </p>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-3">
        {/* Wall classifications */}
        <article className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1E1E24] text-[#D4AF37]">
              <BrickWall className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gold">
                Structural Wall Classifier
              </p>
              <h3 className="mt-0.5 text-sm font-bold text-slate-900">
                Load-Bearing vs Partition
              </h3>
              <p className="mt-1 text-[11px] text-slate-500">
                Threshold ≥ {walls.thicknessThresholdM} m (9&quot;) or column-aligned
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-800">
                  <Shield className="h-3 w-3" aria-hidden />
                  {walls.loadBearingCount} Load-Bearing
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  {walls.partitionCount} Partition
                </span>
              </div>
              <ul className="mt-3 max-h-28 space-y-1.5 overflow-y-auto">
                {walls.items.slice(0, 8).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="truncate font-medium text-slate-700">
                      {item.label ?? item.id}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                        item.wallType === "LOAD_BEARING"
                          ? "bg-red-100 text-red-800"
                          : "bg-slate-200 text-slate-600"
                      )}
                    >
                      {item.wallType === "LOAD_BEARING" ? "LB" : "PT"} ·{" "}
                      {item.thicknessM.toFixed(2)}m
                    </span>
                  </li>
                ))}
                {walls.items.length === 0 && (
                  <li className="text-[11px] text-slate-400">
                    No walls classified yet — run dual-plan analysis.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </article>

        {/* Cross ventilation */}
        <article className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                ventOk
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-800"
              )}
            >
              <Wind className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gold">
                Passive Cross-Ventilation
              </p>
              <h3 className="mt-0.5 text-sm font-bold text-slate-900">
                Opposite Opening Check
              </h3>
              <div
                className={cn(
                  "mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                  ventOk
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                )}
              >
                {ventOk ? (
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                ) : (
                  <AlertTriangle className="h-3 w-3" aria-hidden />
                )}
                CROSS_VENTILATION: {audit.crossVentilation.status}
              </div>
              {audit.crossVentilation.summary && (
                <p className="mt-2 text-[11px] text-slate-600">
                  {audit.crossVentilation.summary}
                </p>
              )}
              {!ventOk && audit.crossVentilation.recommendation && (
                <p className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-2.5 py-2 text-[11px] font-medium leading-snug text-amber-900">
                  {audit.crossVentilation.recommendation}
                </p>
              )}
              <ul className="mt-3 max-h-24 space-y-1 overflow-y-auto text-[10px] text-slate-500">
                {audit.crossVentilation.rooms.slice(0, 4).map((room) => (
                  <li key={room.roomId} className="flex justify-between gap-2">
                    <span className="font-semibold text-slate-700">
                      {room.roomId}
                    </span>
                    <span>
                      {room.sides.join("/") || "—"} · {room.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>

        {/* Solar gain */}
        <article className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                solarOk
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-orange-100 text-orange-800"
              )}
            >
              <Sun className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gold">
                Solar Orientation
              </p>
              <h3 className="mt-0.5 text-sm font-bold text-slate-900">
                Heat Gain Predictor
              </h3>
              <div
                className={cn(
                  "mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                  solarOk
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-orange-200 bg-orange-50 text-orange-900"
                )}
              >
                {solarOk ? (
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                ) : (
                  <AlertTriangle className="h-3 w-3" aria-hidden />
                )}
                SOLAR_GAIN: {audit.solarGain.status}
              </div>
              {audit.solarGain.summary && (
                <p className="mt-2 text-[11px] text-slate-600">
                  {audit.solarGain.summary}
                </p>
              )}
              {!solarOk && audit.solarGain.recommendation && (
                <p className="mt-2 rounded-lg border border-orange-200/80 bg-orange-50/80 px-2.5 py-2 text-[11px] font-medium leading-snug text-orange-950">
                  {audit.solarGain.recommendation}
                </p>
              )}
              {audit.solarGain.westFacingLivingWindows.length > 0 && (
                <p className="mt-2 text-[10px] text-slate-500">
                  West windows:{" "}
                  {audit.solarGain.westFacingLivingWindows
                    .map((w) => w.label)
                    .join(", ")}
                </p>
              )}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
