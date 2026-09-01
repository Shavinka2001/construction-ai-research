"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { predictCompliance } from "@/lib/compliance-predict";
import {
  formatConfidence,
  type CompliancePrediction,
} from "@/lib/compliance-types";
import { useComplianceWorkflowOptional } from "@/contexts/ComplianceWorkflowContext";
import { ComplianceStatusBadge } from "@/components/dashboard/authority/ComplianceStatusBadge";
import { cn } from "@/lib/utils";

type AiAssessmentPanelProps = {
  /** Legacy text trigger — fetches from ML when provided and workflow mode is off. */
  inspectionText?: string;
  fallbackLabel?: string;
  className?: string;
  /** When true, reads live inference state from ComplianceWorkflowProvider. */
  useWorkflow?: boolean;
};

export function AiAssessmentPanel({
  inspectionText = "",
  fallbackLabel,
  className,
  useWorkflow = false,
}: AiAssessmentPanelProps) {
  const workflow = useComplianceWorkflowOptional();
  const workflowActive = useWorkflow && workflow != null;

  const [prediction, setPrediction] = useState<CompliancePrediction | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workflowActive) return;

    let cancelled = false;
    const text = inspectionText.trim();
    if (!text) {
      setPrediction(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPrediction(null);

    predictCompliance(text)
      .then((result) => {
        if (!cancelled) setPrediction(result);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [inspectionText, workflowActive]);

  const workflowLoading =
    workflowActive && workflow.document.inferenceState === "inferring";
  const workflowError =
    workflowActive && workflow.document.inferenceState === "error"
      ? workflow.document.error
      : null;
  const workflowPrediction =
    workflowActive && workflow.document.inferenceState === "complete"
      ? workflow.document.prediction
      : null;

  const resolvedLoading = workflowActive ? workflowLoading : loading;
  const resolvedError = workflowActive ? workflowError : error;
  const resolvedPrediction = workflowActive ? workflowPrediction : prediction;
  const displayLabel = resolvedPrediction?.label ?? fallbackLabel;

  const emptyWorkflow =
    workflowActive &&
    !workflowLoading &&
    !workflowError &&
    !workflowPrediction &&
    workflow.document.inferenceState === "idle";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury",
        className
      )}
    >
      <div className="border-b border-slate-100 bg-gradient-to-r from-charcoal to-charcoal-light px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            AI Assessment
          </p>
        </div>
        <h2 className="mt-1 text-lg font-bold text-white">
          ML Compliance Recommendation
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Real-time inference via POST /api/predict-compliance
        </p>
      </div>

      <div className="p-5">
        <AnimatePresence mode="wait">
          {emptyWorkflow && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-8 text-center"
            >
              <Brain className="h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">
                Upload a compliance document below to run the trained classifier.
              </p>
            </motion.div>
          )}

          {resolvedLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-8 text-center"
            >
              <Loader2 className="h-8 w-8 animate-spin text-gold" />
              <p className="text-sm text-slate-500">
                Running HashingVectorizer → RandomForest inference…
              </p>
            </motion.div>
          )}

          {!resolvedLoading && resolvedError && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4"
            >
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  AI service unavailable
                </p>
                <p className="mt-1 text-xs text-amber-800/80">{resolvedError}</p>
                {fallbackLabel && (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Cached status
                    </p>
                    <ComplianceStatusBadge
                      label={fallbackLabel}
                      size="md"
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {!resolvedLoading && !resolvedError && resolvedPrediction && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Recommended action
                  </p>
                  {displayLabel && (
                    <ComplianceStatusBadge
                      label={displayLabel}
                      size="md"
                      className="mt-2"
                    />
                  )}
                  {resolvedPrediction.confidence != null && (
                    <p className="mt-2 text-sm text-slate-600">
                      Model confidence:{" "}
                      <span className="font-bold tabular-nums text-charcoal">
                        {formatConfidence(resolvedPrediction.confidence)}
                      </span>
                    </p>
                  )}
                  {workflowActive && workflow.document.fileName && (
                    <p className="mt-1 text-xs text-slate-400">
                      Source: {workflow.document.fileName}
                    </p>
                  )}
                </div>
              </div>

              {resolvedPrediction.probabilities &&
                Object.keys(resolvedPrediction.probabilities).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Class probabilities
                    </p>
                    {Object.entries(resolvedPrediction.probabilities)
                      .sort(([, a], [, b]) => b - a)
                      .map(([label, score], index) => (
                        <motion.div
                          key={label}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.06 }}
                          className="space-y-1"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-700">
                              {label}
                            </span>
                            <span className="tabular-nums text-slate-500">
                              {Math.round(score * 100)}%
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${score * 100}%` }}
                              transition={{
                                delay: 0.1 + index * 0.06,
                                duration: 0.5,
                                ease: "easeOut",
                              }}
                              className="h-full rounded-full bg-gold"
                            />
                          </div>
                        </motion.div>
                      ))}
                  </div>
                )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
