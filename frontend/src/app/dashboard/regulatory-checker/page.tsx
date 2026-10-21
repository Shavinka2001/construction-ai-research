import { ComplianceWorkflow } from "@/components/compliance-workflow/ComplianceWorkflow";
import { SubmissionReadinessPanel } from "@/components/compliance-workflow/SubmissionReadinessPanel";

export const metadata = {
  title: "Smart Compliance Workflow | ConstructAI",
};

/**
 * Only the condition the jurisdiction settles. Everything omitted stays
 * unknown, so its requirement is reported as manual review rather than being
 * assumed not to apply.
 */
const MATARA_CONTEXT = { in_cmc_area: false } as const;

export default function RegulatoryCheckerPage() {
  return (
    <div className="space-y-8">
      {/* The readiness assessment stands on its own. It used to render inside
          Step 3 of the wizard, which meant dropping a map pin and generating a
          roadmap before the checklist appeared at all — two steps it does not
          depend on. The applicant's actual question is "what do I still need",
          so it is answered first. */}
      <SubmissionReadinessPanel context={MATARA_CONTEXT} />

      <ComplianceWorkflow />
    </div>
  );
}
