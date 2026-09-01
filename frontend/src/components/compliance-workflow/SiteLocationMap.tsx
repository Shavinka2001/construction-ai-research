"use client";

import dynamic from "next/dynamic";
import type { SitePin } from "./SiteLocationMapImpl";

export type { SitePin };

const SiteLocationMapImpl = dynamic(() => import("./SiteLocationMapImpl"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(52vh,420px)] min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
        <p className="text-sm font-medium">Loading hybrid map…</p>
      </div>
    </div>
  ),
});

type SiteLocationMapProps = {
  confirmedPin?: SitePin | null;
  onConfirm: (pin: SitePin) => void;
  disabled?: boolean;
  confirming?: boolean;
};

export default function SiteLocationMap(props: SiteLocationMapProps) {
  return <SiteLocationMapImpl {...props} />;
}
