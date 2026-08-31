"use client";

import dynamic from "next/dynamic";

export const DynamicLand3DViewer = dynamic(
  () => import("./Land3DViewer").then((m) => m.Land3DViewerImpl),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm text-slate-400">
        Loading 3D site model…
      </div>
    ),
  }
);
