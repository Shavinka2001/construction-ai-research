"use client";

import { useState, useCallback } from "react";
import {
  BUILDING_APPLICATIONS,
  type BuildingApplication,
} from "@/lib/authority-data";
import { PendingApplicationsTable } from "@/components/dashboard/authority/PendingApplicationsTable";
import { AiAssessmentPanel } from "@/components/dashboard/authority/AiAssessmentPanel";
import { ComplianceAdvisoryPanel } from "@/components/dashboard/authority/ComplianceAdvisoryPanel";

export function PendingApplicationsPage() {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Pending Applications
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Full application queue with AI-assisted compliance assessment for each
          submission.
        </p>
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

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <PendingApplicationsTable
            applications={BUILDING_APPLICATIONS}
            selectedId={selected.id}
            onSelect={setSelected}
            onApprove={handleApprove}
            onRequestRevision={handleRequestRevision}
          />
        </div>
        <div className="space-y-6">
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
