"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ClipboardList,
  BadgeCheck,
  AlertOctagon,
} from "lucide-react";
import type { AuthUser } from "@/lib/auth";
import { getDisplayName } from "@/lib/auth";
import { ROLE_DASHBOARD_LABELS } from "@/lib/roles";
import {
  BUILDING_APPLICATIONS,
  pendingCount,
  approvedCount,
  flaggedCount,
  type BuildingApplication,
} from "@/lib/authority-data";
import { PendingApplicationsTable } from "@/components/dashboard/authority/PendingApplicationsTable";
import { ComplianceAdvisoryPanel } from "@/components/dashboard/authority/ComplianceAdvisoryPanel";
import { AiAssessmentPanel } from "@/components/dashboard/authority/AiAssessmentPanel";
import { cn } from "@/lib/utils";

type AuthorityDashboardProps = {
  user: AuthUser;
};

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  index,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "gold" | "emerald" | "red";
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      whileHover={{ y: -2 }}
      className={cn(
        "rounded-2xl border bg-white p-5 shadow-luxury sm:p-6",
        accent === "gold" && "border-gold/40 shadow-[0_0_24px_-8px_rgba(212,175,55,0.35)]",
        accent === "emerald" && "border-slate-100",
        accent === "red" && "border-red-200/60 bg-gradient-to-br from-white to-red-50/40"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p
            className={cn(
              "mt-2 text-3xl font-bold",
              accent === "red" ? "text-red-700" : "text-brand-primary"
            )}
          >
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-400">{hint}</p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            accent === "gold" && "bg-gold/10 text-gold",
            accent === "emerald" && "bg-emerald-50 text-emerald-600",
            accent === "red" && "bg-red-50 text-red-600"
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </motion.div>
  );
}

export function AuthorityDashboard({ user }: AuthorityDashboardProps) {
  const displayName = getDisplayName(user);
  const [selected, setSelected] = useState<BuildingApplication>(
    BUILDING_APPLICATIONS[0]
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleApprove = useCallback((id: string) => {
    const project = BUILDING_APPLICATIONS.find((s) => s.id === id);
    setFeedback(
      `Approved: ${project?.projectName ?? "Submission"} — official sign-off recorded.`
    );
  }, []);

  const handleRequestRevision = useCallback((id: string) => {
    const project = BUILDING_APPLICATIONS.find((s) => s.id === id);
    setFeedback(
      `Revision requested: ${project?.projectName ?? "Submission"} — applicant notified.`
    );
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-luxury sm:p-8"
      >
        <div
          className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold/5 blur-2xl"
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              {ROLE_DASHBOARD_LABELS.AUTHORITY}
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Regulatory Approval Hub
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500 sm:text-base">
            Welcome, {displayName}. Review building applications, run AI-assisted
            compliance checks, and issue official municipal sign-off.
          </p>
        </div>
      </motion.header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          index={0}
          label="Pending Applications"
          value={pendingCount(BUILDING_APPLICATIONS)}
          hint="Awaiting officer review"
          icon={ClipboardList}
          accent="gold"
        />
        <MetricCard
          index={1}
          label="Approved Projects"
          value={approvedCount(BUILDING_APPLICATIONS)}
          hint="Compliant submissions"
          icon={BadgeCheck}
          accent="emerald"
        />
        <MetricCard
          index={2}
          label="Flagged Violations"
          value={flaggedCount(BUILDING_APPLICATIONS)}
          hint="Minor or high-risk issues"
          icon={AlertOctagon}
          accent="red"
        />
      </div>

      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-slate-800"
        >
          <p>{feedback}</p>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="shrink-0 text-xs font-semibold uppercase tracking-wider text-gold-dark hover:text-gold"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-5 lg:gap-8">
        <div className="lg:col-span-3">
          <PendingApplicationsTable
            applications={BUILDING_APPLICATIONS}
            selectedId={selected.id}
            onSelect={setSelected}
            onApprove={handleApprove}
            onRequestRevision={handleRequestRevision}
            compact
          />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <AiAssessmentPanel
            inspectionText={selected.inspectionText}
            fallbackLabel={selected.status}
          />
          <ComplianceAdvisoryPanel
            projectName={selected.projectName}
            complianceScore={selected.complianceScore}
            inspectionText={selected.inspectionText}
          />
        </div>
      </div>
    </div>
  );
}
