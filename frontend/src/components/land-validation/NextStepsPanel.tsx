"use client";

import { ClipboardCheck } from "lucide-react";
import type { BoundaryResult, FeasibilityResult } from "@/lib/land-validation";
import { deriveNextSteps } from "@/lib/feasibility-insights";

export function NextStepsPanel({
  feasibility,
  boundary,
}: {
  feasibility: FeasibilityResult;
  boundary: BoundaryResult | null;
}) {
  const steps = deriveNextSteps(feasibility, boundary);

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
          Next Steps
        </h2>
        <p className="text-[11px] text-slate-400">
          Standard pre-construction actions for this feasibility stage
        </p>
      </div>
      <ol className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-charcoal text-[11px] font-bold text-gold">
              {i + 1}
            </span>
            <span className="leading-snug">{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 flex items-center gap-1.5 text-[11px] italic text-slate-400">
        <ClipboardCheck className="h-3.5 w-3.5" />
        Indicative only — not a substitute for a licensed surveyor or chartered
        engineer.
      </p>
    </section>
  );
}
