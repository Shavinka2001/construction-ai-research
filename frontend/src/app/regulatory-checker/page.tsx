import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Regulatory Checker",
};

export default function RegulatoryCheckerPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900">Regulatory Checker</h1>
      <p className="mt-2 text-slate-600">
        Permits, codes, and compliance verification — coming soon.
      </p>
    </AppShell>
  );
}
