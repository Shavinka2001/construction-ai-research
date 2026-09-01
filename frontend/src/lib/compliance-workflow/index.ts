/**
 * Smart Compliance Workflow — public module surface.
 *
 * Import types and pure state transitions from here when wiring
 * microservices or unit tests outside React components.
 */

export type {
  ComplianceWorkflowState,
  DocumentVerificationState,
  EnrichedRoadmapStep,
  GeoPin,
  InferenceState,
  RoadmapStepStatus,
  WorkflowStepIndex,
  ZoneAnalysis,
} from "./types";

export {
  applyClearDocument,
  applyInferenceComplete,
  applyInferenceError,
  applyInferenceStarted,
  applyLocationConfirmation,
  canAdvanceFromStep,
  canNavigateToStep,
  enrichRoadmapSteps,
  getActiveRoadmapStep,
  INITIAL_DOCUMENT,
  INITIAL_WORKFLOW_STATE,
  predictionToStepStatus,
  statusNoteForPrediction,
} from "./state-machine";
