"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CompliancePrediction } from "@/lib/compliance-types";
import {
  analyzeZoneFromPin,
  buildRoadmap,
  extractEntitiesFromText,
  type GeoPin,
  type RoadmapStep,
  type ZoneAnalysis,
  type ZoneType,
} from "@/lib/compliance-workflow-data";
import { predictCompliance } from "@/lib/compliance-predict";
import { extractDocumentText } from "@/lib/extract-document-text";

export type WorkflowStepIndex = 1 | 2 | 3 | 4;

export type InferenceState = "idle" | "inferring" | "complete" | "error";

type DocumentState = {
  file: File | null;
  fileName: string | null;
  inferenceState: InferenceState;
  prediction: CompliancePrediction | null;
  confidenceScore: number | null;
  extractedEntities: string[];
  error: string | null;
};

type WorkflowState = {
  currentStep: WorkflowStepIndex;
  pin: GeoPin | null;
  zone: ZoneAnalysis | null;
  roadmap: RoadmapStep[];
  /** Bumps when zone/roadmap is regenerated — drives Step 2 entrance animations. */
  roadmapGeneration: number;
  activeRoadmapIndex: number;
  document: DocumentState;
};

type ComplianceWorkflowContextValue = WorkflowState & {
  setStep: (step: WorkflowStepIndex) => void;
  nextStep: () => void;
  prevStep: () => void;
  /** Sets pin only — no zone analysis (draft placement on map). */
  setPin: (pin: GeoPin) => void;
  /** Confirms location, runs mock geofencing, builds roadmap. Optionally advances to Step 2. */
  confirmLocation: (pin: GeoPin, options?: { advance?: boolean }) => void;
  setActiveRoadmapIndex: (index: number) => void;
  runDocumentInference: (file: File) => Promise<void>;
  canAdvanceFromStep: (step: WorkflowStepIndex) => boolean;
};

const initialDocument: DocumentState = {
  file: null,
  fileName: null,
  inferenceState: "idle",
  prediction: null,
  confidenceScore: null,
  extractedEntities: [],
  error: null,
};

const ComplianceWorkflowCtx =
  createContext<ComplianceWorkflowContextValue | null>(null);

export function ComplianceWorkflowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkflowState>({
    currentStep: 1,
    pin: null,
    zone: null,
    roadmap: [],
    roadmapGeneration: 0,
    activeRoadmapIndex: 0,
    document: initialDocument,
  });

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

  const applyZoneDetection = useCallback(
    (pin: GeoPin, advanceToRoadmap: boolean) => {
      const zone = analyzeZoneFromPin(pin);
      const roadmap = buildRoadmap(zone.zoneType as ZoneType);
      setState((prev) => ({
        ...prev,
        pin,
        zone,
        roadmap,
        activeRoadmapIndex: 0,
        roadmapGeneration: prev.roadmapGeneration + 1,
        currentStep: advanceToRoadmap && prev.currentStep === 1 ? 2 : prev.currentStep,
      }));
    },
    []
  );

  const setPin = useCallback((pin: GeoPin) => {
    applyZoneDetection(pin, false);
  }, [applyZoneDetection]);

  const confirmLocation = useCallback(
    (pin: GeoPin, options?: { advance?: boolean }) => {
      applyZoneDetection(pin, options?.advance !== false);
    },
    [applyZoneDetection]
  );

  const setActiveRoadmapIndex = useCallback((index: number) => {
    setState((prev) => ({ ...prev, activeRoadmapIndex: index }));
  }, []);

  const runDocumentInference = useCallback(async (file: File) => {
    setState((prev) => ({
      ...prev,
      document: {
        ...initialDocument,
        file,
        fileName: file.name,
        inferenceState: "inferring",
      },
    }));

    try {
      const text = await extractDocumentText(file);
      const entities = extractEntitiesFromText(text);
      const prediction = await predictCompliance(text);
      const confidenceScore =
        prediction.confidence != null
          ? Math.round(prediction.confidence * 100)
          : null;

      setState((prev) => ({
        ...prev,
        document: {
          file,
          fileName: file.name,
          inferenceState: "complete",
          prediction,
          confidenceScore,
          extractedEntities: entities,
          error: null,
        },
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        document: {
          ...prev.document,
          inferenceState: "error",
          error: err instanceof Error ? err.message : "Model inference failed",
        },
      }));
    }
  }, []);

  const canAdvanceFromStep = useCallback(
    (step: WorkflowStepIndex) => {
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
    },
    [state]
  );

  const value = useMemo<ComplianceWorkflowContextValue>(
    () => ({
      ...state,
      setStep,
      nextStep,
      prevStep,
      setPin,
      confirmLocation,
      setActiveRoadmapIndex,
      runDocumentInference,
      canAdvanceFromStep,
    }),
    [
      state,
      setStep,
      nextStep,
      prevStep,
      setPin,
      confirmLocation,
      setActiveRoadmapIndex,
      runDocumentInference,
      canAdvanceFromStep,
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
