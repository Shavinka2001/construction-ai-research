"use client";

import {
  Briefcase,
  MapPinned,
  Gauge,
  Scale,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FeasibilityProvider,
  useFeasibility,
  type FeasibilityTab,
} from "./FeasibilityContext";
import { PortfolioTab } from "./PortfolioTab";
import { ParcelSearchTab } from "./ParcelSearchTab";
import { AnalysisTab } from "./AnalysisTab";
import { ZoningTab } from "./ZoningTab";
import { ReportsTab } from "./ReportsTab";

const TABS: { key: FeasibilityTab; label: string; icon: LucideIcon }[] = [
  { key: "portfolio", label: "Portfolio", icon: Briefcase },
  { key: "search", label: "Parcel Search", icon: MapPinned },
  { key: "analysis", label: "Analysis", icon: Gauge },
  { key: "zoning", label: "Zoning", icon: Scale },
  { key: "reports", label: "Reports", icon: FileText },
];

function WorkspaceInner() {
  const { activeTab, setActiveTab, activeProject } = useFeasibility();

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-luxury">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Architectural Ledger
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Pre-Construction Feasibility Analyzer
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {activeProject
            ? `Active project: ${activeProject.name}`
            : "Survey digitization · geo-anchoring · GIS & weather feasibility · 3D envelope · PDF ledger"}
        </p>

        <nav
          role="tablist"
          aria-label="Feasibility analyzer sections"
          className="mt-4 flex flex-wrap gap-1 border-t border-slate-100 pt-3"
        >
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all",
                activeTab === key
                  ? "bg-charcoal text-white"
                  : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <Icon className={cn("h-4 w-4", activeTab === key && "text-gold")} />
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div>
        {activeTab === "portfolio" && <PortfolioTab />}
        {activeTab === "search" && <ParcelSearchTab />}
        {activeTab === "analysis" && <AnalysisTab />}
        {activeTab === "zoning" && <ZoningTab />}
        {activeTab === "reports" && <ReportsTab />}
      </div>
    </div>
  );
}

export function FeasibilityAnalyzerWorkspace() {
  return (
    <FeasibilityProvider>
      <WorkspaceInner />
    </FeasibilityProvider>
  );
}
