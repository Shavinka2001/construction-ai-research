"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, MapPin, Route } from "lucide-react";
import {
  useComplianceWorkflow,
  useComplianceWorkflowOptional,
  ComplianceWorkflowProvider,
  type WorkflowStepIndex,
} from "@/contexts/ComplianceWorkflowContext";
import { WorkflowStepHeader } from "@/components/compliance-workflow/WorkflowStepHeader";
import { StepGeospatialIdentification } from "@/components/compliance-workflow/StepGeospatialIdentification";
import { StepApprovalRoadmap } from "@/components/compliance-workflow/StepApprovalRoadmap";
import { StepDocumentVerification } from "@/components/compliance-workflow/StepDocumentVerification";
import { StepAuthorityMapping } from "@/components/compliance-workflow/StepAuthorityMapping";
import { cn } from "@/lib/utils";

const STEP_VARIANTS = {
  enter: (direction: number) => ({
    x: direction > 0 ? 48 : -48,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -48 : 48,
    opacity: 0,
  }),
};

function StepContent({ step }: { step: WorkflowStepIndex }) {
  switch (step) {
    case 1:
      return <StepGeospatialIdentification />;
    case 2:
      return <StepApprovalRoadmap />;
    case 3:
      return <StepDocumentVerification />;
    case 4:
      return <StepAuthorityMapping />;
    default:
      return null;
  }
}

function ComplianceWorkflowInner() {
  const {
    currentStep,
    setStep,
    nextStep,
    prevStep,
    canAdvanceFromStep,
    zone,
    pin,
    roadmap,
    document,
  } = useComplianceWorkflow();

  const direction = 1;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
              Smart Compliance &amp; Approval Workflow
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              ConstructAI Regulatory Wizard
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Drop a pin to run mock geofencing, then follow the zone-linked
              approval roadmap through ML document verification and authority
              routing.
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            {zone && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-center"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  Detected Zone
                </p>
                <p className="text-sm font-bold text-slate-900">{zone.label}</p>
              </motion.div>
            )}
            {roadmap.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.08 }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-center"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Roadmap Phases
                </p>
                <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-slate-900">
                  <Route className="h-3.5 w-3.5 text-blue-600" />
                  {roadmap.length} step{roadmap.length !== 1 ? "s" : ""}
                </p>
              </motion.div>
            )}
          </div>
        </div>

        {pin && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 flex items-center gap-1.5 text-xs text-slate-500"
          >
            <MapPin className="h-3.5 w-3.5" />
            Site anchor: {pin.lat.toFixed(5)}°, {pin.lon.toFixed(5)}°
          </motion.p>
        )}

        <div className="mt-6">
          <WorkflowStepHeader
            currentStep={currentStep}
            onStepClick={(step) => {
              if (step <= currentStep || (step === 2 && zone != null)) {
                setStep(step);
              }
            }}
          />
        </div>
      </header>

      <div className="relative min-h-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={STEP_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <StepContent step={currentStep} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={prevStep}
          disabled={currentStep === 1}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50",
            currentStep === 1 && "cursor-not-allowed opacity-40"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <p className="text-xs text-slate-400">
          Step {currentStep} of 4
          {zone && currentStep >= 2 && (
            <span className="ml-2 text-blue-600">· {zone.label}</span>
          )}
          {document.inferenceState === "complete" && currentStep >= 3 && (
            <span className="ml-2 text-emerald-600">· ML inference complete</span>
          )}
        </p>

        <button
          type="button"
          onClick={nextStep}
          disabled={currentStep === 4 || !canAdvanceFromStep(currentStep)}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800",
            (currentStep === 4 || !canAdvanceFromStep(currentStep)) &&
              "cursor-not-allowed opacity-40"
          )}
        >
          Continue
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ComplianceWorkflow() {
  const existing = useComplianceWorkflowOptional();
  if (existing) {
    return <ComplianceWorkflowInner />;
  }
  return (
    <ComplianceWorkflowProvider>
      <ComplianceWorkflowInner />
    </ComplianceWorkflowProvider>
  );
}
