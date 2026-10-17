"use client";

import dynamic from "next/dynamic";

export const DynamicSatelliteMap = dynamic(
  () => import("./SatelliteMap").then((m) => m.SatelliteMapImpl),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[440px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm text-slate-400 lg:h-[520px]">
        Loading satellite map…
      </div>
    ),
  }
);
