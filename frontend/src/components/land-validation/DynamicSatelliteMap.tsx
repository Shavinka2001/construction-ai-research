"use client";

import dynamic from "next/dynamic";

export const DynamicSatelliteMap = dynamic(
  () => import("./SatelliteMap").then((m) => m.SatelliteMapImpl),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm text-slate-400">
        Loading satellite map…
      </div>
    ),
  }
);
