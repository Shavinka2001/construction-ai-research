import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Site Feasibility",
};

export default function SiteFeasibilityPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900">Site Feasibility</h1>
      <p className="mt-2 text-slate-600">
        Terrain, zoning, and environmental analysis — coming soon.
      </p>
    </AppShell>
  );
}
