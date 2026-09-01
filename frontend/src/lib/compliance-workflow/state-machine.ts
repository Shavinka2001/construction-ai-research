/**
 * Pure state-transition helpers for the Smart Compliance Workflow.
 *
 * Keep side effects (API calls) in the React provider; this module only
 * derives the next immutable state so microservice integrations can be
 * unit-tested without React.
 */

import type { CompliancePrediction } from "@/lib/compliance-types";
import {
  analyzeZoneFromPin,
  buildRoadmap,
  type GeoPin,
  type RoadmapStep,
  type ZoneType,
} from "@/lib/compliance-workflow-data";
import type {
  ComplianceWorkflowState,
  DocumentVerificationState,
  EnrichedRoadmapStep,
  RoadmapStepStatus,
  WorkflowStepIndex,
} from "@/lib/compliance-workflow/types";

export const INITIAL_DOCUMENT: DocumentVerificationState = {
  file: null,
  fileName: null,
  inferenceState: "idle",
  prediction: null,
  confidenceScore: null,
  extractedEntities: [],
  error: null,
  linkedStepId: null,
};

export const INITIAL_WORKFLOW_STATE: ComplianceWorkflowState = {
  currentStep: 1,
  pin: null,
  zone: null,
  roadmap: [],
  roadmapGeneration: 0,
  activeRoadmapIndex: 0,
  document: INITIAL_DOCUMENT,
};

/** Attach default progress fields to raw roadmap steps from the rules engine. */
export function enrichRoadmapSteps(steps: RoadmapStep[]): EnrichedRoadmapStep[] {
  return steps.map((step) => ({
    ...step,
    status: "pending" as const,
    mlLabel: null,
    mlConfidence: null,
    statusNote: null,
  }));
}

/** Map ML classifier label → roadmap phase status. */
export function predictionToStepStatus(label: string): RoadmapStepStatus {
  const normalized = label.trim().toLowerCase();
  if (normalized === "compliant" || normalized === "pending approval") {
    return "verified";
  }
  return "flagged";
}

export function statusNoteForPrediction(
  label: string,
  confidence: number | null
): string {
  const pct = confidence != null ? ` (${Math.round(confidence * 100)}% confidence)` : "";
  return `ML assessment: ${label}${pct}`;
}

/**
 * Step 1 — confirm pin, run mock geofencing, build zone-linked roadmap.
 */
export function applyLocationConfirmation(
  state: ComplianceWorkflowState,
  pin: GeoPin,
  options?: { advance?: boolean }
): ComplianceWorkflowState {
  const zone = analyzeZoneFromPin(pin);
  const roadmap = enrichRoadmapSteps(buildRoadmap(zone.zoneType as ZoneType));

  return {
    ...state,
    pin,
    zone,
    roadmap,
    activeRoadmapIndex: 0,
    roadmapGeneration: state.roadmapGeneration + 1,
    document: INITIAL_DOCUMENT,
    currentStep:
      options?.advance !== false && state.currentStep === 1 ? 2 : state.currentStep,
  };
}

/** Mark the active roadmap phase as under ML review (Step 3 upload started). */
export function applyInferenceStarted(
  state: ComplianceWorkflowState,
  file: File
): ComplianceWorkflowState {
  const activeId = state.roadmap[state.activeRoadmapIndex]?.id ?? null;

  return {
    ...state,
    document: {
      ...INITIAL_DOCUMENT,
      file,
      fileName: file.name,
      inferenceState: "inferring",
      linkedStepId: activeId,
    },
    roadmap: state.roadmap.map((step, index) =>
      index === state.activeRoadmapIndex
        ? {
            ...step,
            status: "in_review",
            statusNote: `Verifying documents for ${step.authority}…`,
          }
        : step
    ),
  };
}

/** Apply ML result to document state + active roadmap phase (Step 3 complete). */
export function applyInferenceComplete(
  state: ComplianceWorkflowState,
  file: File,
  prediction: CompliancePrediction,
  entities: string[]
): ComplianceWorkflowState {
  const confidenceScore =
    prediction.confidence != null ? Math.round(prediction.confidence * 100) : null;
  const stepStatus = predictionToStepStatus(prediction.label);
  const statusNote = statusNoteForPrediction(
    prediction.label,
    prediction.confidence
  );
  const activeIndex = state.activeRoadmapIndex;

  return {
    ...state,
    document: {
      file,
      fileName: file.name,
      inferenceState: "complete",
      prediction,
      confidenceScore,
      extractedEntities: entities,
      error: null,
      linkedStepId: state.roadmap[activeIndex]?.id ?? null,
    },
    roadmap: state.roadmap.map((step, index) =>
      index === activeIndex
        ? {
            ...step,
            status: stepStatus,
            mlLabel: prediction.label,
            mlConfidence: prediction.confidence,
            statusNote,
          }
        : step
    ),
  };
}

export function applyInferenceError(
  state: ComplianceWorkflowState,
  message: string
): ComplianceWorkflowState {
  return {
    ...state,
    document: {
      ...state.document,
      inferenceState: "error",
      error: message,
    },
    roadmap: state.roadmap.map((step, index) =>
      index === state.activeRoadmapIndex && step.status === "in_review"
        ? {
            ...step,
            status: "pending",
            statusNote: "Verification failed — retry upload",
          }
        : step
    ),
  };
}

/** Reset Step 3 document + ML state and revert the linked roadmap phase. */
export function applyClearDocument(
  state: ComplianceWorkflowState
): ComplianceWorkflowState {
  const linkedId = state.document.linkedStepId;

  return {
    ...state,
    document: INITIAL_DOCUMENT,
    roadmap: state.roadmap.map((step) =>
      step.id === linkedId
        ? {
            ...step,
            status: "pending",
            mlLabel: null,
            mlConfidence: null,
            statusNote: null,
          }
        : step
    ),
  };
}

/** Whether the wizard may advance from a given step. */
export function canAdvanceFromStep(
  state: ComplianceWorkflowState,
  step: WorkflowStepIndex
): boolean {
  switch (step) {
    case 1:
      return state.pin != null && state.zone != null;
    case 2:
      return state.roadmap.length > 0;
    case 3:
      return state.document.inferenceState === "complete";
    case 4:
      return true;
    default:
      return false;
  }
}

/** Whether the user may navigate to a wizard step via the header. */
export function canNavigateToStep(
  state: ComplianceWorkflowState,
  target: WorkflowStepIndex
): boolean {
  if (target <= state.currentStep) return true;
  switch (target) {
    case 2:
      return state.zone != null;
    case 3:
      return state.roadmap.length > 0;
    case 4:
      return state.document.inferenceState === "complete";
    default:
      return false;
  }
}

export function getActiveRoadmapStep(
  state: ComplianceWorkflowState
): EnrichedRoadmapStep | null {
  return state.roadmap[state.activeRoadmapIndex] ?? null;
}
