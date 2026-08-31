"use client";

import {
  Wind,
  Sun,
  Columns3,
  Ruler,
  CheckCircle2,
  AlertTriangle,
  LayoutGrid,
} from "lucide-react";
import type { ArchitecturalAudit } from "@/lib/clash-detection";
import { ArchitecturalAuditCard } from "@/components/dashboard/architect/ArchitecturalAuditCard";
import { cn } from "@/lib/utils";

type CodeComplianceAuditPanelProps = {
  audit: ArchitecturalAudit | null;
  hasLiveResult?: boolean;
  isAiGenerated?: boolean;
};

function StatusPill({
  ok,
  passLabel,
  warnLabel,
}: {
  ok: boolean;
  passLabel: string;
  warnLabel: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
        ok
          ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border border-amber-200 bg-amber-50 text-amber-900"
      )}
    >
      {ok ? (
        <CheckCircle2 className="h-3 w-3" aria-hidden />
      ) : (
        <AlertTriangle className="h-3 w-3" aria-hidden />
      )}
      {ok ? passLabel : warnLabel}
    </span>
  );
}

export function CodeComplianceAuditPanel({
  audit,
  hasLiveResult = false,
  isAiGenerated = false,
}: CodeComplianceAuditPanelProps) {
  if (!audit || !hasLiveResult) return null;

  const lighting = audit.lightingVentilation ?? audit.roomCompliance;
  const rooms = lighting?.rooms ?? audit.roomCompliance?.rooms ?? [];
  const structural = audit.structuralGrid;
  const ventOk = audit.crossVentilation.status === "PASSED";
  const lightOk = (lighting?.status ?? "WARNING") === "PASSED";
  const codeOk = (audit.roomCompliance?.codeStatus ?? "WARNING") === "PASSED";
  const gridOk = structural?.clashFree ?? true;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Instant Compliance Results
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">
            AI Code Compliance &amp; Structural Synthesis
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Ventilation · natural lighting ratio · room codes · generative column grid
          </p>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  ventOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                )}
              >
                <Wind className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gold">
                  Cross-Ventilation
                </p>
                <StatusPill ok={ventOk} passLabel="Pass" warnLabel="Review" />
                <p className="mt-2 text-[11px] text-slate-600">
                  {audit.crossVentilation.summary ??
                    "Opposite-opening airflow per enclosed room"}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  lightOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                )}
              >
                <Sun className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gold">
                  Lighting &amp; Ventilation Ratio
                </p>
                <StatusPill ok={lightOk} passLabel="Pass" warnLabel="Warning" />
                <p className="mt-2 text-[11px] text-slate-600">
                  {audit.lightingVentilation?.summary ??
                    audit.roomCompliance?.lightingSummary ??
                    `Window-to-floor ≥ ${Math.round((audit.lightingVentilation?.minWindowToFloorRatio ?? 0.1) * 100)}% per room`}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  codeOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                )}
              >
                <Ruler className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gold">
                  Building Code Rooms
                </p>
                <StatusPill ok={codeOk} passLabel="Pass" warnLabel="Warning" />
                <p className="mt-2 text-[11px] text-slate-600">
                  {audit.roomCompliance?.codeSummary ??
                    "Minimum habitable area & width verification"}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  gridOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                )}
              >
                <Columns3 className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gold">
                  Structural Grid
                </p>
                <StatusPill
                  ok={gridOk}
                  passLabel="Clash-Free"
                  warnLabel="Review"
                />
                <p className="mt-2 text-[11px] text-slate-600">
                  {structural?.summary ??
                    (isAiGenerated
                      ? "AI-synthesized columns at wall corners"
                      : "Structural column layout")}
                </p>
              </div>
            </div>
          </article>
        </div>

        {rooms.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-4">
            <div className="mb-3 flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-gold" aria-hidden />
              <h3 className="text-sm font-bold text-slate-900">Room Area Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="pb-2 pr-3 font-semibold">Room</th>
                    <th className="pb-2 pr-3 font-semibold">Area</th>
                    <th className="pb-2 pr-3 font-semibold">W/F Ratio</th>
                    <th className="pb-2 pr-3 font-semibold">Lighting</th>
                    <th className="pb-2 font-semibold">Code</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.roomId} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium text-slate-800">
                        {room.roomId}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {room.areaSqFt.toLocaleString()} sq.ft
                        <span className="text-slate-400">
                          {" "}
                          ({room.areaSqM} m²)
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {(room.windowToFloorRatio * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 pr-3">
                        <StatusPill
                          ok={room.lightingStatus === "PASSED"}
                          passLabel="Pass"
                          warnLabel="Warn"
                        />
                      </td>
                      <td className="py-2">
                        <StatusPill
                          ok={room.codeStatus === "PASSED"}
                          passLabel="Pass"
                          warnLabel="Warn"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <ArchitecturalAuditCard audit={audit} hasLiveResult={hasLiveResult} />
    </div>
  );
}
