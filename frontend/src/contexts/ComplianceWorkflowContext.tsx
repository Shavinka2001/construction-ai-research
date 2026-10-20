"use client";

/**
 * Smart Compliance Workflow — global React Context provider.
 *
 * Data flow:
 *   Step 1  confirmLocation(pin)  → zone + roadmap (state-machine)
 *   Step 2  reads zone / roadmap  → displays dynamic phases
 *   Step 3  runDocumentInference  → ML API → updates active phase status
 *   Step 4  activeRoadmapIndex    → AuthorityLocator resolves contact + map
 *
 * Mount once at `AuthorityShell` so the authority dashboard and
 * `/dashboard/regulatory-checker` share the same session.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyClearDocument,
  applyInferenceComplete,
  applyInferenceError,
  applyInferenceStarted,
  applyLocationConfirmation,
  canAdvanceFromStep as canAdvanceFromStepFn,
  canNavigateToStep as canNavigateToStepFn,
  getActiveRoadmapStep as getActiveRoadmapStepFn,
  INITIAL_WORKFLOW_STATE,
} from "@/lib/compliance-workflow/state-machine";
import type {
  ComplianceWorkflowState,
  DocumentVerificationState,
  EnrichedRoadmapStep,
  GeoPin,
  InferenceState,
  WorkflowStepIndex,
  ZoneAnalysis,
} from "@/lib/compliance-workflow/types";
import { extractEntitiesFromText } from "@/lib/compliance-workflow-data";
import { predictCompliance } from "@/lib/compliance-predict";
import { extractDocumentText } from "@/lib/extract-document-text";

// Re-export types for consumers
export type {
  ComplianceWorkflowState,
  DocumentVerificationState,
  EnrichedRoadmapStep,
  GeoPin,
  InferenceState,
  RoadmapStepStatus,
  WorkflowStepIndex,
  ZoneAnalysis,
} from "@/lib/compliance-workflow/types";

type ComplianceWorkflowContextValue = ComplianceWorkflowState & {
  /** Currently selected roadmap phase (Step 2 click / Step 4 routing). */
  activeRoadmapStep: EnrichedRoadmapStep | null;
  setStep: (step: WorkflowStepIndex) => void;
  nextStep: () => void;
  prevStep: () => void;
  setPin: (pin: GeoPin) => void;
  confirmLocation: (pin: GeoPin, options?: { advance?: boolean }) => void;
  setActiveRoadmapIndex: (index: number) => void;
  runDocumentInference: (file: File) => Promise<void>;
  clearDocument: () => void;
  canAdvanceFromStep: (step: WorkflowStepIndex) => boolean;
  canNavigateToStep: (step: WorkflowStepIndex) => boolean;
  resetWorkflow: () => void;
};

const ComplianceWorkflowCtx =
  createContext<ComplianceWorkflowContextValue | null>(null);

export function ComplianceWorkflowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ComplianceWorkflowState>(INITIAL_WORKFLOW_STATE);

  const setStep = useCallback((step: WorkflowStepIndex) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.min(4, prev.currentStep + 1) as WorkflowStepIndex,
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(1, prev.currentStep - 1) as WorkflowStepIndex,
    }));
  }, []);

  const confirmLocation = useCallback(
    (pin: GeoPin, options?: { advance?: boolean }) => {
      setState((prev) => applyLocationConfirmation(prev, pin, options));
    },
    []
  );

  const setPin = useCallback((pin: GeoPin) => {
    setState((prev) => ({ ...prev, pin }));
  }, []);

  const setActiveRoadmapIndex = useCallback((index: number) => {
    setState((prev) => ({ ...prev, activeRoadmapIndex: index }));
  }, []);

  const runDocumentInference = useCallback(async (file: File) => {
    setState((prev) => applyInferenceStarted(prev, file));

    try {
      const text = await extractDocumentText(file);
      const entities = extractEntitiesFromText(text);
      const prediction = await predictCompliance(text);

      setState((prev) =>
        applyInferenceComplete(prev, file, prediction, entities)
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Model inference failed";
      setState((prev) => applyInferenceError(prev, message));
    }
  }, []);

  const clearDocument = useCallback(() => {
    setState((prev) => applyClearDocument(prev));
  }, []);

  const resetWorkflow = useCallback(() => {
    setState(INITIAL_WORKFLOW_STATE);
  }, []);

  const canAdvanceFromStep = useCallback(
    (step: WorkflowStepIndex) => canAdvanceFromStepFn(state, step),
    [state]
  );

  const canNavigateToStep = useCallback(
    (step: WorkflowStepIndex) => canNavigateToStepFn(state, step),
    [state]
  );

  const activeRoadmapStep = useMemo(
    () => getActiveRoadmapStepFn(state),
    [state]
  );

  const value = useMemo<ComplianceWorkflowContextValue>(
    () => ({
      ...state,
      activeRoadmapStep,
      setStep,
      nextStep,
      prevStep,
      setPin,
      confirmLocation,
      setActiveRoadmapIndex,
      runDocumentInference,
      clearDocument,
      canAdvanceFromStep,
      canNavigateToStep,
      resetWorkflow,
    }),
    [
      state,
      activeRoadmapStep,
      setStep,
      nextStep,
      prevStep,
      setPin,
      confirmLocation,
      setActiveRoadmapIndex,
      runDocumentInference,
      clearDocument,
      canAdvanceFromStep,
      canNavigateToStep,
      resetWorkflow,
    ]
  );

  return (
    <ComplianceWorkflowCtx.Provider value={value}>
      {children}
    </ComplianceWorkflowCtx.Provider>
  );
}

export function useComplianceWorkflow(): ComplianceWorkflowContextValue {
  const ctx = useContext(ComplianceWorkflowCtx);
  if (!ctx) {
    throw new Error(
      "useComplianceWorkflow must be used within ComplianceWorkflowProvider"
    );
  }
  return ctx;
}

export function useComplianceWorkflowOptional():
  | ComplianceWorkflowContextValue
  | null {
  return useContext(ComplianceWorkflowCtx);
}

/** Selector — Step 1 geospatial slice. */
export function useWorkflowLocation() {
  const { pin, zone, confirmLocation, setPin } = useComplianceWorkflow();
  return { pin, zone, confirmLocation, setPin };
}

/** Selector — Step 2 roadmap slice. */
export function useWorkflowRoadmap() {
  const {
    zone,
    roadmap,
    roadmapGeneration,
    activeRoadmapIndex,
    activeRoadmapStep,
    setActiveRoadmapIndex,
  } = useComplianceWorkflow();
  return {
    zone,
    roadmap,
    roadmapGeneration,
    activeRoadmapIndex,
    activeRoadmapStep,
    setActiveRoadmapIndex,
  };
}

/** Selector — Step 3 document / ML slice. */
export function useWorkflowDocument() {
  const { document, runDocumentInference, clearDocument, activeRoadmapStep } =
    useComplianceWorkflow();
  return { document, runDocumentInference, clearDocument, activeRoadmapStep };
}

/** Selector — Step 4 authority routing slice. */
export function useWorkflowAuthority() {
  const { pin, zone, roadmap, activeRoadmapIndex, activeRoadmapStep } =
    useComplianceWorkflow();
  return { pin, zone, roadmap, activeRoadmapIndex, activeRoadmapStep };
}
