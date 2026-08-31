"use client";

import dynamic from "next/dynamic";

export const DynamicLocationPickerMap = dynamic(
  () => import("./LocationPickerMap").then((m) => m.LocationPickerMapImpl),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[140px] w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-sm text-slate-400">
        Loading map…
      </div>
    ),
  }
);
