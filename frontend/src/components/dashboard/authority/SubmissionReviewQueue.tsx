"use client";

import { cn } from "@/lib/utils";

export type Submission = {
  id: string;
  projectName: string;
  submittedDate: string;
  complianceScore: number;
};

const SUBMISSIONS: Submission[] = [
  {
    id: "sub-01",
    projectName: "Lakeview Residences — Block A",
    submittedDate: "08 Jul 2026",
    complianceScore: 94,
  },
  {
    id: "sub-02",
    projectName: "Harbor Commercial Annex",
    submittedDate: "06 Jul 2026",
    complianceScore: 81,
  },
  {
    id: "sub-03",
    projectName: "Greenfield Townhouses",
    submittedDate: "04 Jul 2026",
    complianceScore: 97,
  },
  {
    id: "sub-04",
    projectName: "Cinnamon Hill Villa",
    submittedDate: "02 Jul 2026",
    complianceScore: 72,
  },
  {
    id: "sub-05",
    projectName: "Metro Plaza Extension",
    submittedDate: "30 Jun 2026",
    complianceScore: 88,
  },
];

export { SUBMISSIONS };

type SubmissionReviewQueueProps = {
  selectedId: string;
  onSelect: (submission: Submission) => void;
  onApprove: (id: string) => void;
  onRequestRevision: (id: string) => void;
};

function ComplianceBadge({ score }: { score: number }) {
  const tone = score >= 90 ? "high" : score >= 80 ? "mid" : "low";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums",
        tone === "high" &&
          "border border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "mid" &&
          "border border-gold/40 bg-gold/10 text-gold-dark",
        tone === "low" && "border border-amber-200 bg-amber-50 text-amber-800"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "high" && "bg-emerald-500",
          tone === "mid" && "bg-gold",
          tone === "low" && "bg-amber-500"
        )}
      />
      {score}% Compliant
    </span>
  );
}

export function SubmissionReviewQueue({
  selectedId,
  onSelect,
  onApprove,
  onRequestRevision,
}: SubmissionReviewQueueProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Plan Review Workflow
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">
          Submission Review Queue
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {SUBMISSIONS.length} applications awaiting official sign-off
        </p>
      </div>

      <div className="flex-1 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Project Name
              </th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Submitted Date
              </th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                AI Compliance Score
              </th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {SUBMISSIONS.map((submission) => {
              const isSelected = submission.id === selectedId;

              return (
                <tr
                  key={submission.id}
                  onClick={() => onSelect(submission)}
                  className={cn(
                    "cursor-pointer border-b border-slate-50 transition-colors",
                    isSelected
                      ? "bg-gold/[0.07]"
                      : "hover:bg-slate-50/80"
                  )}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold"
                          aria-hidden
                        />
                      )}
                      <span className="font-medium text-slate-900">
                        {submission.projectName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-slate-600">
                    {submission.submittedDate}
                  </td>
                  <td className="px-4 py-3.5">
                    <ComplianceBadge score={submission.complianceScore} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div
                      className="flex flex-wrap items-center justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onApprove(submission.id)}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-gold transition-colors hover:bg-charcoal-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => onRequestRevision(submission.id)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                      >
                        Request Revision
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
