"use client";

import { useState, useCallback } from "react";
import {
  ClipboardList,
  BadgeCheck,
  AlertOctagon,
} from "lucide-react";
import type { AuthUser } from "@/lib/auth";
import { getDisplayName } from "@/lib/auth";
import { ROLE_DASHBOARD_LABELS } from "@/lib/roles";
import {
  SubmissionReviewQueue,
  SUBMISSIONS,
  type Submission,
} from "@/components/dashboard/authority/SubmissionReviewQueue";
import { ComplianceAdvisoryPanel } from "@/components/dashboard/authority/ComplianceAdvisoryPanel";
import { cn } from "@/lib/utils";

type AuthorityDashboardProps = {
  user: AuthUser;
};

export function AuthorityDashboard({ user }: AuthorityDashboardProps) {
  const displayName = getDisplayName(user);
  const [selected, setSelected] = useState<Submission>(SUBMISSIONS[0]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleApprove = useCallback((id: string) => {
    const project = SUBMISSIONS.find((s) => s.id === id);
    setFeedback(
      `Approved: ${project?.projectName ?? "Submission"} — official sign-off recorded.`
    );
  }, []);

  const handleRequestRevision = useCallback((id: string) => {
    const project = SUBMISSIONS.find((s) => s.id === id);
    setFeedback(
      `Revision requested: ${project?.projectName ?? "Submission"} — applicant notified.`
    );
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <header className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-luxury sm:p-8">
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
            Welcome, {displayName}. Component 3 — automated compliance advisory,
            plan review workflows, and official municipal sign-off.
          </p>
        </div>
      </header>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Pending */}
        <div
          className={cn(
            "relative rounded-2xl border border-gold/40 bg-white p-5 shadow-luxury sm:p-6",
            "shadow-[0_0_24px_-8px_rgba(212,175,55,0.35)]",
            "before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:border before:border-gold/30 before:animate-pulse"
          )}
        >
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Pending Applications
              </p>
              <p className="mt-2 text-3xl font-bold text-brand-primary">5</p>
              <p className="mt-1 text-xs text-slate-400">Active reviews in queue</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <ClipboardList className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </div>

        {/* Approved */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury transition-shadow hover:shadow-luxury-lg sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Approved Projects
              </p>
              <p className="mt-2 text-3xl font-bold text-brand-primary">42</p>
              <p className="mt-1 text-xs text-slate-400">Certified plans issued</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <BadgeCheck className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </div>

        {/* Flagged */}
        <div
          className={cn(
            "rounded-2xl border border-red-200/60 bg-gradient-to-br from-white to-red-50/40 p-5 shadow-luxury",
            "shadow-[0_0_20px_-8px_rgba(239,68,68,0.2)] transition-shadow hover:shadow-luxury-lg sm:col-span-2 sm:p-6 lg:col-span-1"
          )}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Flagged Violations
              </p>
              <p className="mt-2 text-3xl font-bold text-red-700">2</p>
              <p className="mt-1 text-xs text-slate-400">
                Rejected / flagged submissions
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertOctagon className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div
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
        </div>
      )}

      {/* Regulatory workspace — 60% / 40% */}
      <div className="grid gap-6 lg:grid-cols-5 lg:gap-8">
        <div className="lg:col-span-3">
          <SubmissionReviewQueue
            selectedId={selected.id}
            onSelect={setSelected}
            onApprove={handleApprove}
            onRequestRevision={handleRequestRevision}
          />
        </div>
        <div className="lg:col-span-2">
          <ComplianceAdvisoryPanel
            projectName={selected.projectName}
            complianceScore={selected.complianceScore}
          />
        </div>
      </div>
    </div>
  );
}
