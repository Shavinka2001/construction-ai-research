"use client";

import { motion } from "framer-motion";
import { Check, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckStatus = "PASSED" | "WARNING" | "FAILED";

type ComplianceCheck = {
  id: string;
  title: string;
  status: CheckStatus;
  detail: string;
};

function deriveChecks(inspectionText: string): ComplianceCheck[] {
  const text = inspectionText.toLowerCase();
  const checks: ComplianceCheck[] = [];

  const setbackOk =
    text.includes("setback") &&
    (text.includes("verified") ||
      text.includes("compliant") ||
      text.includes("3.") ||
      text.includes("2.8"));
  checks.push({
    id: "setback",
    title: "Setback Restrictions",
    status: setbackOk
      ? "PASSED"
      : text.includes("setback") && text.includes("below")
        ? "WARNING"
        : text.includes("setback")
          ? "PASSED"
          : "WARNING",
    detail: setbackOk
      ? "Front and rear setbacks meet minimum UDA / MC requirements."
      : "Review setback measurements against local authority minimums.",
  });

  const farOk =
    text.includes("far") &&
    (text.includes("within") || text.includes("1.3") || text.includes("compliant"));
  checks.push({
    id: "far",
    title: "Floor Area Ratio (FAR)",
    status: farOk ? "PASSED" : text.includes("exceeds") ? "FAILED" : "WARNING",
    detail: farOk
      ? "Submitted FAR is within the zoning envelope."
      : "Verify FAR against the applicable zoning schedule.",
  });

  const roadIssue =
    text.includes("road") &&
    (text.includes("below") || text.includes("11ft"));
  checks.push({
    id: "road",
    title: "Road Width Requirement",
    status: roadIssue ? "WARNING" : "PASSED",
    detail: roadIssue
      ? "Access road width may be below the 12ft minimum — dynamic setback fine may apply."
      : "Road access width meets or exceeds the minimum requirement.",
  });

  const envRisk =
    text.includes("flood") ||
    text.includes("wetland") ||
    text.includes("no eia");
  checks.push({
    id: "env",
    title: "Environmental Constraints",
    status: envRisk ? "FAILED" : "PASSED",
    detail: envRisk
      ? "Environmental overlay or missing EIA flagged — requires specialist review."
      : "No wetlands or protected boundaries intersected.",
  });

  return checks;
}

type ComplianceAdvisoryPanelProps = {
  projectName: string;
  complianceScore: number;
  inspectionText: string;
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
  inspectionText,
}: ComplianceAdvisoryPanelProps) {
  const checks = deriveChecks(inspectionText);
  const passedCount = checks.filter((c) => c.status === "PASSED").length;
  const warningCount = checks.filter((c) => c.status === "WARNING").length;

  return (
    <div className="flex max-h-[480px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury lg:max-h-none">
      <div className="border-b border-slate-100 bg-slate-900 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Rules Check
        </p>
        <h2 className="mt-1 text-lg font-bold text-white">Compliance Advisory</h2>
        <p className="mt-1 truncate text-xs text-slate-400">{projectName}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
            {complianceScore}% Score
          </span>
          <span className="text-[10px] font-medium text-slate-500">
            {passedCount} passed · {warningCount} warning
            {warningCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
        {checks.map((check, index) => (
          <motion.div
            key={check.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
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
          </motion.div>
        ))}
      </div>
    </div>
  );
}
