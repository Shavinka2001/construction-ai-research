"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { BlueprintUploadCard } from "@/components/dashboard/BlueprintUploadCard";
import { GeospatialCard } from "@/components/dashboard/GeospatialCard";

export default function DashboardPage() {
  const [isRunning, setIsRunning] = useState(false);

  const handleRunFeasibility = async () => {
    setIsRunning(true);
    // Placeholder — wire to backend API
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsRunning(false);
  };

  return (
    <AppShell>
      {/* Welcome header */}
      <header className="mb-8 sm:mb-10">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-gold" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Pre-Construction Intelligence
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
          Construction AI Portal
        </h1>
        <p className="mt-2 max-w-2xl text-base text-slate-600 sm:text-lg">
          Intelligent Pre-Construction Feasibility &amp; Cost Analyzer.
        </p>
      </header>

      {/* Dual input cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BlueprintUploadCard />
        <GeospatialCard />
      </div>

      {/* CTA */}
      <div className="mt-8 flex flex-col items-center gap-3 sm:mt-10">
        <button
          type="button"
          onClick={handleRunFeasibility}
          disabled={isRunning}
          className="btn-feasibility disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Analyzing Feasibility…
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 text-gold" aria-hidden />
              Run Feasibility Analysis
            </>
          )}
        </button>
        <p className="text-center text-xs text-slate-500">
          Upload blueprints and define a location to begin AI-powered analysis.
        </p>
      </div>
    </AppShell>
  );
}
