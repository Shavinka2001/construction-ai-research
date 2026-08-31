"use client";

import { AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import type { BoundaryResult, FeasibilityResult } from "@/lib/land-validation";
import { deriveInsights } from "@/lib/feasibility-insights";

function Column({
  icon: Icon,
  title,
  tint,
  items,
  empty,
  marker,
}: {
  icon: typeof CheckCircle2;
  title: string;
  tint: string;
  items: string[];
  empty: string;
  marker: "check" | "dot";
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury">
      <div className={`flex items-center gap-2 ${tint}`}>
        <Icon className="h-4 w-4" aria-hidden />
        <h3 className="text-xs font-bold uppercase tracking-[0.16em]">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((text, i) => (
            <li key={i} className="flex gap-2 text-sm leading-snug text-slate-600">
              {marker === "check" ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              ) : (
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
              )}
              <span>{text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SiteInsightsPanel({
  feasibility,
  boundary,
}: {
  feasibility: FeasibilityResult;
  boundary: BoundaryResult | null;
}) {
  const { strengths, constraints, recommendations } = deriveInsights(
    feasibility,
    boundary
  );

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
          Site Insights
        </h2>
        <p className="text-[11px] text-slate-400">
          Generated from the buildability factor analysis
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Column
          icon={CheckCircle2}
          title="Strengths"
          tint="text-emerald-600"
          items={strengths}
          empty="No standout advantages flagged by the analysis."
          marker="check"
        />
        <Column
          icon={AlertTriangle}
          title="Risks / Constraints"
          tint="text-amber-600"
          items={constraints}
          empty="No material constraints identified for this site."
          marker="dot"
        />
        <Column
          icon={Lightbulb}
          title="Recommendations"
          tint="text-slate-600"
          items={recommendations}
          empty="No specific recommendations at this stage."
          marker="dot"
        />
      </div>
    </section>
  );
}
