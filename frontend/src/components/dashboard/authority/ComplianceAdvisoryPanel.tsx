"use client";

import { Check, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckStatus = "PASSED" | "WARNING" | "FAILED";

type ComplianceCheck = {
  id: string;
  title: string;
  status: CheckStatus;
  detail: string;
};

const CHECKS: ComplianceCheck[] = [
  {
    id: "setback",
    title: "Setback Restrictions",
    status: "PASSED",
    detail:
      "Front: 3.1m, Rear: 2.6m — minimum required is 3m / 2.5m.",
  },
  {
    id: "far",
    title: "Floor Area Ratio (FAR)",
    status: "PASSED",
    detail:
      "Zoning limit allows FAR 1.5; submitted plan is FAR 1.3.",
  },
  {
    id: "road",
    title: "Road Width Requirement",
    status: "WARNING",
    detail:
      "Road is 11ft; minimum required is 12ft. Dynamic set-back fine calculated: LKR 15,000.",
  },
  {
    id: "env",
    title: "Environmental Constraints",
    status: "PASSED",
    detail:
      "No wetlands or protected boundaries intersected.",
  },
];

type ComplianceAdvisoryPanelProps = {
  projectName: string;
  complianceScore: number;
};

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "PASSED") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
        <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </span>
    );
  }

  if (status === "WARNING") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200">
        <AlertTriangle className="h-4 w-4" aria-hidden />
      </span>
    );
  }

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 ring-1 ring-red-200">
      <XCircle className="h-4 w-4" aria-hidden />
    </span>
  );
}

function StatusLabel({ status }: { status: CheckStatus }) {
  const labels: Record<CheckStatus, string> = {
    PASSED: "Passed",
    WARNING: "Warning",
    FAILED: "Failed",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        status === "PASSED" &&
          "border border-emerald-200 bg-emerald-50 text-emerald-700",
        status === "WARNING" &&
          "border border-amber-200 bg-amber-50 text-amber-800",
        status === "FAILED" &&
          "border border-red-200 bg-red-50 text-red-700"
      )}
    >
      {labels[status]}
    </span>
  );
}

export function ComplianceAdvisoryPanel({
  projectName,
  complianceScore,
}: ComplianceAdvisoryPanelProps) {
  const passedCount = CHECKS.filter((c) => c.status === "PASSED").length;
  const warningCount = CHECKS.filter((c) => c.status === "WARNING").length;

  return (
    <div className="flex h-full max-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury lg:max-h-none">
      <div className="border-b border-slate-100 bg-slate-900 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          AI Compliance Advisory
        </p>
        <h2 className="mt-1 text-lg font-bold text-white">Rules Check</h2>
        <p className="mt-1 truncate text-xs text-slate-400">{projectName}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
            {complianceScore}% Compliant
          </span>
          <span className="text-[10px] font-medium text-slate-500">
            {passedCount} passed · {warningCount} warning
            {warningCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
        {CHECKS.map((check) => (
          <div
            key={check.id}
            className={cn(
              "rounded-xl border p-4 transition-colors",
              check.status === "PASSED" && "border-slate-100 bg-slate-50/60",
              check.status === "WARNING" &&
                "border-amber-200/70 bg-gradient-to-br from-white to-amber-50/50",
              check.status === "FAILED" &&
                "border-red-200/70 bg-gradient-to-br from-white to-red-50/40"
            )}
          >
            <div className="flex gap-3">
              <StatusIcon status={check.status} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    {check.title}
                  </h3>
                  <StatusLabel status={check.status} />
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  {check.detail}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
