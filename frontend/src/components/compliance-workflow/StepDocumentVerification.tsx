"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  FileImage,
  FileUp,
  Loader2,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { useWorkflowDocument } from "@/contexts/ComplianceWorkflowContext";
import { ComplianceStatusBadge } from "@/components/dashboard/authority/ComplianceStatusBadge";
import { cn } from "@/lib/utils";

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.txt,.md,.csv";

type StepDocumentVerificationProps = {
  /** Hide the inline assessment card — use when AiAssessmentPanel shows results. */
  hideAssessment?: boolean;
  compact?: boolean;
};

export function StepDocumentVerification({
  hideAssessment = false,
  compact = false,
}: StepDocumentVerificationProps = {}) {
  const { document, runDocumentInference, clearDocument, activeRoadmapStep } =
    useWorkflowDocument();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File | null) => {
      if (file) void runDocumentInference(file);
    },
    [runDocumentInference]
  );

  const handleRemoveFile = useCallback(() => {
    clearDocument();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [clearDocument]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      handleFile(event.dataTransfer.files?.[0] ?? null);
    },
    [handleFile]
  );

  const isInferring = document.inferenceState === "inferring";
  const hasActiveFile = document.file != null && document.fileName != null;
  const hasPrediction =
    document.inferenceState === "complete" && document.prediction != null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
          Step 3 · AI Document Verification
        </p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">
          ML compliance document scanner
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload permit packages for real-time model inference via the trained
          compliance classifier.
        </p>
        {activeRoadmapStep ? (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs text-blue-800"
          >
            Verifying documents for{" "}
            <strong className="font-semibold">
              Phase {activeRoadmapStep.phase}: {activeRoadmapStep.authority}
            </strong>
            . Select a different phase in Step 2 to target another authority.
          </motion.p>
        ) : (
          <p className="mt-3 text-xs text-amber-700">
            Complete Step 1 and generate a roadmap in Step 2 before uploading.
          </p>
        )}
      </div>

      <label
        htmlFor={compact ? "authority-document-upload" : "workflow-document-upload"}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          "group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white p-6 transition-all duration-300",
          compact ? "min-h-[180px] p-5" : "min-h-[220px]",
          isDragging
            ? "border-blue-500 bg-blue-50/50 shadow-[inset_0_0_0_1px_#3b82f6]"
            : "border-slate-200 hover:border-blue-400 hover:shadow-md",
          (isInferring || !activeRoadmapStep) && "pointer-events-none opacity-60"
        )}
      >
        <input
          ref={fileInputRef}
          id={compact ? "authority-document-upload" : "workflow-document-upload"}
          type="file"
          className="sr-only"
          accept={ACCEPTED}
          disabled={isInferring || !activeRoadmapStep}
          onChange={(e) => {
            handleFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-blue-100 bg-blue-50 shadow-sm transition-transform group-hover:scale-105">
          {isInferring ? (
            <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
          ) : (
            <FileUp className="h-7 w-7 text-blue-600" />
          )}
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-800">
          {isInferring ? "Model Inference in progress…" : "Drop compliance documents here"}
        </p>
        <p className="mt-1 text-xs text-slate-500">PDF · PNG · JPG · TXT</p>
        <span className="mt-4 flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-2 text-xs font-semibold text-blue-700">
          <FileImage className="h-3.5 w-3.5" />
          Browse files
        </span>
      </label>

      {hasActiveFile && !isInferring && document.fileName && (
        <div className="flex items-center justify-between gap-2">
          {hasPrediction ? (
            <p className="text-xs text-slate-500">
              Processing:{" "}
              <span className="font-medium text-slate-700">{document.fileName}</span>
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">{document.fileName}</span>
            </p>
          )}
          <button
            type="button"
            onClick={handleRemoveFile}
            aria-label="Remove uploaded document"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {isInferring && (
          <motion.div
            key="inferring"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3"
          >
            <Brain className="h-5 w-5 animate-pulse text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Model Inference
              </p>
              <p className="text-xs text-slate-500">
                HashingVectorizer → RandomForest classifier · 487 features
              </p>
            </div>
          </motion.div>
        )}

        {document.error && (
          <motion.p
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {document.error}
          </motion.p>
        )}

        {hasActiveFile && hasPrediction && !hideAssessment && (
          <motion.div
            key="assessment"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 bg-slate-900 px-5 py-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-400" />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
                  AI Assessment Card
                </p>
              </div>
              <h3 className="mt-1 text-lg font-bold text-white">
                Research-Grade Inference Output
              </h3>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <ComplianceStatusBadge
                  label={document.prediction!.label}
                  size="md"
                />
                {document.confidenceScore != null && (
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Confidence Score
                    </p>
                    <p className="text-2xl font-bold tabular-nums text-slate-900">
                      {document.confidenceScore}
                      <span className="text-base text-slate-400">%</span>
                    </p>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <Tag className="h-3 w-3" />
                  Extracted Entities
                </p>
                <div className="flex flex-wrap gap-2">
                  {document.extractedEntities.map((entity, i) => (
                    <motion.span
                      key={entity}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {entity}
                    </motion.span>
                  ))}
                </div>
              </div>

              {document.prediction!.probabilities && (
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Class probability distribution
                  </p>
                  {Object.entries(document.prediction!.probabilities)
                    .sort(([, a], [, b]) => b - a)
                    .map(([label, score]) => (
                      <div key={label} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600">{label}</span>
                          <span className="tabular-nums text-slate-400">
                            {Math.round(score * 100)}%
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${score * 100}%` }}
                            className="h-full rounded-full bg-blue-600"
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
