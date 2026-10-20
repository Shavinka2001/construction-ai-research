/**
 * Smart Compliance Workflow — shared TypeScript contracts.
 *
 * These types are the integration boundary for microservices:
 *  - Step 1 → geospatial / zoning service  → `ZoneAnalysis`, `GeoPin`
 *  - Step 2 → rules engine                 → `RoadmapStep[]`
 *  - Step 3 → ML compliance classifier     → `DocumentVerificationState`
 *  - Step 4 → authority directory service  → `AuthorityProfile` (see compliance-workflow-data)
 */

import type { CompliancePrediction } from "@/lib/compliance-types";
import type { GeoPin, RoadmapStep, ZoneAnalysis } from "@/lib/compliance-workflow-data";

export type WorkflowStepIndex = 1 | 2 | 3 | 4;

export type InferenceState = "idle" | "inferring" | "complete" | "error";

/** Per-phase clearance status — updated by Step 3 ML inference. */
export type RoadmapStepStatus =
  | "pending"
  | "in_review"
  | "verified"
  | "flagged";

/**
 * Roadmap phase enriched with workflow progress.
 * `status` is driven by document upload + ML result for the active phase.
 */
export type EnrichedRoadmapStep = RoadmapStep & {
  status: RoadmapStepStatus;
  mlLabel: string | null;
  mlConfidence: number | null;
  statusNote: string | null;
};

export type DocumentVerificationState = {
  file: File | null;
  fileName: string | null;
  inferenceState: InferenceState;
  prediction: CompliancePrediction | null;
  confidenceScore: number | null;
  extractedEntities: string[];
  error: string | null;
  /** Roadmap step id this inference was applied against. */
  linkedStepId: string | null;
};

export type ComplianceWorkflowState = {
  currentStep: WorkflowStepIndex;
  pin: GeoPin | null;
  zone: ZoneAnalysis | null;
  roadmap: EnrichedRoadmapStep[];
  roadmapGeneration: number;
  activeRoadmapIndex: number;
  document: DocumentVerificationState;
};

export type { GeoPin, RoadmapStep, ZoneAnalysis };
