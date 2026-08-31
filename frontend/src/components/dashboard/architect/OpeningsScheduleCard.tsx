"use client";

import { DoorOpen, LayoutGrid } from "lucide-react";
import type { OpeningsSchedule } from "@/lib/clash-detection";

type OpeningsScheduleCardProps = {
  schedule: OpeningsSchedule | null | undefined;
  hasLiveResult?: boolean;
};

export function OpeningsScheduleCard({
  schedule,
  hasLiveResult = false,
}: OpeningsScheduleCardProps) {
  if (!hasLiveResult || !schedule) return null;

  const { totalDoors, totalWindows, doorsList, windowsList } = schedule;
  if (doorsList.length === 0 && windowsList.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">
            BIM Quantification
          </p>
          <h3 className="mt-0.5 text-base font-bold text-slate-900">
            Door &amp; Window Schedule
          </h3>
        </div>
        <div className="flex gap-2 text-[11px] font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-900">
            <DoorOpen className="h-3.5 w-3.5" aria-hidden />
            {totalDoors} door{totalDoors === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-900">
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
            {totalWindows} window{totalWindows === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <ScheduleTable title="Doors" rows={doorsList} accent="amber" />
        <ScheduleTable title="Windows" rows={windowsList} accent="sky" />
      </div>
    </div>
  );
}

function ScheduleTable({
  title,
  rows,
  accent,
}: {
  title: string;
  rows: OpeningsSchedule["doorsList"];
  accent: "amber" | "sky";
}) {
  if (rows.length === 0) return null;

  const headClass =
    accent === "amber"
      ? "text-amber-800 bg-amber-50/80"
      : "text-sky-800 bg-sky-50/80";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100">
      <div className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${headClass}`}>
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2 font-semibold">ID</th>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Size</th>
              <th className="px-3 py-2 font-semibold">Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-50 last:border-0">
                <td className="px-3 py-2 font-mono font-semibold text-slate-800">{row.id}</td>
                <td className="px-3 py-2 text-slate-700">{row.name}</td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-600">{row.size}</td>
                <td className="px-3 py-2 text-slate-600">{row.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
