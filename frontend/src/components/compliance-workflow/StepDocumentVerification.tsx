"use client";

/**
 * Step 3 — document readiness.
 *
 * This replaced a file-upload scanner that posted to the v1 text classifier.
 * Two reasons it went.
 *
 * The classifier was returning chance-level predictions: its fitted vectorizer
 * was never saved, so inference substituted a different one of matching width
 * and the forest read a feature space unrelated to the one it learned. See
 * `backend/app/ml/model_card.md` under *History*.
 *
 * The framing was also wrong for the people using this. The publication survey
 * found 2 of 16 local authorities publish a document checklist at all, so an
 * applicant arriving here usually does not know what they need, let alone hold
 * it as a file ready to drop on a page. "Check what you uploaded" answers a
 * question they cannot yet ask. "Here is what your application needs, here is
 * how to obtain each one, and here is what would lower your risk" answers the
 * one they have.
 */

import { useWorkflowDocument } from "@/contexts/ComplianceWorkflowContext";
import { SubmissionReadinessPanel } from "@/components/compliance-workflow/SubmissionReadinessPanel";

type StepDocumentVerificationProps = {
  /** Kept for callers that render their own assessment surface. */
  hideAssessment?: boolean;
  compact?: boolean;
};

/**
 * Only the condition the jurisdiction settles. Everything omitted stays
 * unknown, so its requirement is reported as manual review rather than being
 * assumed not to apply.
 */
const MATARA_CONTEXT = { in_cmc_area: false } as const;

export function StepDocumentVerification({
  hideAssessment = false,
  compact = false,
}: StepDocumentVerificationProps = {}) {
  const { activeRoadmapStep } = useWorkflowDocument();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
          Step 3 · Document readiness
        </p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">
          What this application needs
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Matched against the official UDA requirements. Each item shows the
          authority that issues it and how to obtain it, where that is
          published.
        </p>
        {activeRoadmapStep && (
          <p className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs text-blue-800">
            Targeting{" "}
            <strong className="font-semibold">
              Phase {activeRoadmapStep.phase}: {activeRoadmapStep.authority}
            </strong>
            . Select a different phase in Step 2 to change the authority.
          </p>
        )}
      </div>

      {!hideAssessment && !compact && (
        <SubmissionReadinessPanel context={MATARA_CONTEXT} />
      )}
    </div>
  );
}
