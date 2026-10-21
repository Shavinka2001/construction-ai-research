/**
 * Component 3 — submission-readiness client.
 *
 * Mirrors backend/app/schemas/submission_readiness.py. Two kinds of statement
 * come back and the UI must keep them apart: `rule_based_findings` are
 * deterministic and carry the official source they came from, while
 * `ml_prediction` is a risk estimate trained on synthetic scenarios.
 *
 * This supersedes `compliance-predict.ts`, which calls the v1 text classifier.
 */

import { API_V1, ApiRequestError, type ApiResponse } from "@/lib/api";
import { getAuthSession } from "@/lib/auth";
import { handleUnauthorized } from "@/lib/session-guard";

// --------------------------------------------------------------------------- //
// Types
// --------------------------------------------------------------------------- //
export type ApplicationType = "building_permit" | "coc";

export type DocumentStatus =
  | "verified"
  | "needs_review"
  | "unverified"
  | "expired"
  | "missing";

export type RequirementState =
  | "satisfied"
  | "missing"
  | "needs_review"
  | "unverified"
  | "expired"
  | "not_applicable"
  | "manual_review";

export type FindingSeverity = "blocking" | "attention" | "informational";

export type AssessmentStatus = "ready" | "review_required" | "incomplete";

export type RiskLevel = "low" | "medium" | "high";

export type SubmittedDocument = {
  type: string;
  status: DocumentStatus;
  mismatch_count?: number;
  expired?: boolean;
};

export type RuleFinding = {
  requirement_id: string;
  document_name: string;
  state: RequirementState;
  severity: FindingSeverity;
  issue: string;
  corrective_action: string;
  authority: string;
  condition: string | null;
  source_url: string | null;
  source_section: string | null;
};

/**
 * How to obtain the document, where that is published at all.
 *
 * `publication_status` is the point. For most issuing authorities no
 * procedure is published, and the UI shows that rather than a
 * plausible-sounding invention — the blank is information, and it is the
 * component's research finding one level down.
 */
export type AcquisitionGuide = {
  authority: string;
  publication_status: "published" | "not_published";
  how_to_obtain: string | null;
  obtain_url: string | null;
  source_url: string | null;
  source_section: string | null;
  note: string | null;
};

/** Whether the applicant can act alone, or has to wait on another body. */
export type Control = "applicant" | "external_authority";

export type RecourseAction = {
  action: string;
  requirement_id: string | null;
  document_name: string | null;
  control: Control;
};

export type RecourseResult = {
  attainable: boolean;
  target_band: string;
  actions: RecourseAction[];
  note: string;
};

export type ProcedureStep = {
  step_order: number;
  step: string;
  source_url: string | null;
  source_section: string | null;
};

export type RequirementOutcome = {
  requirement_id: string;
  document_name: string;
  requirement_type: "mandatory" | "conditional";
  state: RequirementState;
  condition: string | null;
  authority: string;
  control: Control;
  acquisition: AcquisitionGuide | null;
};

export type RuleSummary = {
  required_document_count: number;
  submitted_document_count: number;
  missing_document_count: number;
  document_mismatch_count: number;
  expired_document_count: number;
  unverified_document_count: number;
  manual_review_count: number;
  conditional_clearance_required: boolean;
  conditional_clearance_submitted: boolean;
};

export type MlPrediction = {
  risk_level: RiskLevel;
  probabilities: Record<string, number>;
  model_version: string;
  model_type: "synthetic_prototype";
  disclaimer: string;
};

export type AssessmentResult = {
  assessment_id: string;
  project_id: number | null;
  application_type: ApplicationType;
  jurisdiction: string;
  assessment_status: AssessmentStatus;
  summary: RuleSummary;
  requirements: RequirementOutcome[];
  rule_based_findings: RuleFinding[];
  ml_prediction: MlPrediction | null;
  ml_available: boolean;
  ml_unavailable_reason: string | null;
  recommended_actions: string[];
  recourse: RecourseResult | null;
  application_procedure: ProcedureStep[];
  /** `{ authorities, publish_a_procedure }` — the shortfall is a gap in
   *  published regulatory information, not in this system. */
  acquisition_coverage: Record<string, number>;
  official_approval: false;
  generated_at: string;
};

export type RequirementsResponse = {
  application_type: ApplicationType;
  requirements: RequirementOutcome[];
  condition_keys: string[];
};

export type AssessmentRequest = {
  project_id?: number | null;
  application_type: ApplicationType;
  jurisdiction?: string;
  documents: SubmittedDocument[];
  /**
   * Condition flags keyed by `condition_key`. A key that is absent is unknown,
   * not false — its requirement comes back as `manual_review` rather than
   * `missing`, which is the behaviour the UI must not paper over.
   */
  context: Record<string, boolean>;
};

// --------------------------------------------------------------------------- //
// Presentation helpers
// --------------------------------------------------------------------------- //
export const REQUIREMENT_STATE_LABELS: Record<RequirementState, string> = {
  satisfied: "Ready",
  missing: "Missing",
  needs_review: "Needs review",
  unverified: "Unverified",
  expired: "Expired",
  not_applicable: "Not required here",
  manual_review: "Manual review required",
};

export type StateTone = "success" | "warning" | "danger" | "neutral";

export const REQUIREMENT_STATE_TONES: Record<RequirementState, StateTone> = {
  satisfied: "success",
  missing: "danger",
  expired: "danger",
  needs_review: "warning",
  unverified: "warning",
  manual_review: "warning",
  not_applicable: "neutral",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const ASSESSMENT_STATUS_LABELS: Record<AssessmentStatus, string> = {
  ready: "Ready to submit",
  review_required: "Review required",
  incomplete: "Incomplete",
};

/** Requirements the applicant still has to act on, in the order they matter. */
export function actionableRequirements(
  result: AssessmentResult
): RequirementOutcome[] {
  const rank: Record<RequirementState, number> = {
    missing: 0,
    expired: 1,
    needs_review: 2,
    manual_review: 3,
    unverified: 4,
    satisfied: 5,
    not_applicable: 6,
  };
  // Things waiting on another authority come first among equals: they take
  // weeks and are worth starting today, while your own paperwork can follow.
  const control = (r: RequirementOutcome) =>
    r.state === "satisfied" ? 1 : r.control === "external_authority" ? 0 : 1;

  return [...result.requirements]
    .filter((r) => r.state !== "not_applicable")
    .sort(
      (a, b) =>
        rank[a.state] - rank[b.state] || control(a) - control(b)
    );
}

/** The finding attached to a requirement, for the row's expanded detail. */
export function findingFor(
  result: AssessmentResult,
  requirementId: string
): RuleFinding | null {
  return (
    result.rule_based_findings.find(
      (f) => f.requirement_id === requirementId
    ) ?? null
  );
}

export function readyCount(result: AssessmentResult): {
  ready: number;
  total: number;
} {
  const applicable = result.requirements.filter(
    (r) => r.state !== "not_applicable"
  );
  return {
    ready: applicable.filter((r) => r.state === "satisfied").length,
    total: applicable.length,
  };
}

// --------------------------------------------------------------------------- //
// Requests
// --------------------------------------------------------------------------- //
async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !body.success || body.data === null) {
    throw new ApiRequestError(
      body.message || "Request failed",
      response.status,
      body.errors ?? []
    );
  }
  return body.data;
}

/** The official checklist for an application type. No authentication needed. */
export async function fetchRequirements(
  applicationType: ApplicationType
): Promise<RequirementsResponse> {
  const response = await fetch(
    `${API_V1}/submission-readiness/requirements?application_type=${applicationType}`,
    { headers: { "Content-Type": "application/json" } }
  );
  return parse<RequirementsResponse>(response);
}

/**
 * Assess an application. Pass `project_id` to persist the result against a
 * project; leave it out for a throwaway assessment.
 */
export async function assessApplication(
  request: AssessmentRequest
): Promise<AssessmentResult> {
  const session = getAuthSession();
  if (!session) {
    handleUnauthorized();
    throw new ApiRequestError("Not signed in", 401);
  }

  const response = await fetch(`${API_V1}/submission-readiness/assess`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({ jurisdiction: "matara", ...request }),
  });

  if (response.status === 401) {
    handleUnauthorized();
  }
  return parse<AssessmentResult>(response);
}

/** Whether the risk model artifact loaded. Rule findings work regardless. */
export async function fetchModelStatus(): Promise<{
  ml_available: boolean;
  model_version: string | null;
  reason: string | null;
}> {
  const response = await fetch(`${API_V1}/submission-readiness/model/status`, {
    headers: { "Content-Type": "application/json" },
  });
  return parse(response);
}
