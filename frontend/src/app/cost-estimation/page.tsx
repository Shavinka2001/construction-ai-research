import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Cost & Estimation",
};

export default function CostEstimationPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900">Cost &amp; Estimation</h1>
      <p className="mt-2 text-slate-600">
        Budget forecasting and cost breakdown — coming soon.
      </p>
    </AppShell>
  );
}
