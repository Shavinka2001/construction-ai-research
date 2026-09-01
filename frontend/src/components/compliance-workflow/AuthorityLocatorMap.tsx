"use client";

import dynamic from "next/dynamic";
import type { AuthorityMapPin } from "./AuthorityLocatorMapImpl";

export type { AuthorityMapPin };

const AuthorityLocatorMapImpl = dynamic(
  () => import("./AuthorityLocatorMapImpl"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[320px] items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
          <p className="text-xs font-medium">Loading authority map…</p>
        </div>
      </div>
    ),
  }
);

type AuthorityLocatorMapProps = {
  authority: AuthorityMapPin;
};

export default function AuthorityLocatorMap({ authority }: AuthorityLocatorMapProps) {
  return <AuthorityLocatorMapImpl authority={authority} />;
}
