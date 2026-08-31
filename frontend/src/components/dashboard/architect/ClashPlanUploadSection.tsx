"use client";

import { useCallback, useId, useState } from "react";
import {
  FileUp,
  FileImage,
  X,
  CheckCircle2,
  Loader2,
  Sparkles,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
const ACCEPTED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg";
const MAX_BYTES = 25 * 1024 * 1024;

type ClashPlanUploadSectionProps = {
  blueprintFile: File | null;
  onBlueprintChange: (file: File | null) => void;
  onAnalyze: () => void;
  analyzing: boolean;
  error?: string | null;
  enabled?: boolean;
  lockedMessage?: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext === "pdf" || ext === "png" || ext === "jpg" || ext === "jpeg";
}

export function ClashPlanUploadSection({
  blueprintFile,
  onBlueprintChange,
  onAnalyze,
  analyzing,
  error,
  enabled = true,
  lockedMessage = "Select an active project to unlock blueprint uploads.",
}: ClashPlanUploadSectionProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  const canAnalyze = enabled && Boolean(blueprintFile) && !analyzing;

  const acceptFile = useCallback(
    (incoming: FileList | null) => {
      if (!enabled || !incoming?.length) return;
      const candidate = incoming[0];
      if (!isAcceptedFile(candidate)) {
        setSlotError("Please upload a PDF or image (PNG / JPG).");
        return;
      }
      if (candidate.size > MAX_BYTES) {
        setSlotError("File exceeds the 25MB size limit.");
        return;
      }
      setSlotError(null);
      onBlueprintChange(candidate);
    },
    [enabled, onBlueprintChange]
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          AI Architectural Code Compliance
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">
          Upload 2D Architectural Blueprint
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Single-plan workflow — automated ventilation, building-code audit &amp;
          AI structural grid synthesis
        </p>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {!enabled && (
          <div className="rounded-xl border border-dashed border-gold/40 bg-gold/[0.04] px-4 py-3 text-sm text-slate-600">
            {lockedMessage}
          </div>
        )}

        <div className="mb-1 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
            <FileImage className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
              Architectural Floor Plan
            </p>
            <p className="text-xs text-slate-500">
              YOLOv8 openings · room extraction · generative structural columns
            </p>
          </div>
        </div>

        <label
          htmlFor={enabled ? inputId : undefined}
          onDragOver={(e) => {
            if (!enabled) return;
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            acceptFile(e.dataTransfer.files);
          }}
          className={cn(
            "group relative flex min-h-[200px] flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all duration-300 sm:min-h-[220px]",
            enabled ? "cursor-pointer" : "cursor-not-allowed opacity-55",
            enabled && isDragging
              ? "border-gold bg-gold/5 shadow-[inset_0_0_0_1px_#D4AF37]"
              : enabled && blueprintFile
                ? "border-gold/60 bg-gold/[0.03]"
                : enabled
                  ? "border-gold/40 hover:border-gold hover:bg-gold/[0.03]"
                  : "border-slate-200 bg-slate-50",
            enabled && "focus-within:border-gold focus-within:ring-4 focus-within:ring-gold/10"
          )}
          style={
            enabled
              ? {
                  backgroundImage: `
            linear-gradient(rgba(212,175,55,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212,175,55,0.06) 1px, transparent 1px)
          `,
                  backgroundSize: "16px 16px",
                }
              : undefined
          }
        >
          <input
            id={inputId}
            type="file"
            className="sr-only"
            accept={ACCEPTED_EXTENSIONS}
            disabled={!enabled}
            onChange={(e) => {
              acceptFile(e.target.files);
              e.target.value = "";
            }}
          />

          {blueprintFile ? (
            <div className="flex w-full flex-col items-center text-center">
              <CheckCircle2 className="h-10 w-10 text-gold" aria-hidden />
              <p className="mt-3 max-w-full truncate text-sm font-semibold text-slate-900">
                {blueprintFile.name}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {formatBytes(blueprintFile.size)} · Ready for AI audit
              </p>
              <button
                type="button"
                disabled={!enabled}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onBlueprintChange(null);
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Remove
              </button>
            </div>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/30 bg-white shadow-sm transition-transform group-hover:scale-105">
                <FileUp className="h-6 w-6 text-gold" aria-hidden />
              </div>
              <p className="mt-4 text-center text-sm font-semibold text-slate-900">
                {enabled ? "Drop blueprint here or browse" : "Select a project to unlock"}
              </p>
              <p className="mt-1 text-center text-xs text-slate-500">
                PNG · JPEG · PDF · Max 25MB
              </p>
            </>
          )}
        </label>

        {(slotError || error) && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {slotError || error}
          </p>
        )}

        <button
          type="button"
          disabled={!canAnalyze}
          onClick={onAnalyze}
          className={cn(
            "group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl px-5 py-4 text-sm font-bold transition-all duration-300",
            canAnalyze
              ? "bg-gradient-to-r from-slate-900 via-[#1a1625] to-slate-900 text-[#D4AF37] shadow-luxury ring-1 ring-[#D4AF37]/40 hover:shadow-[0_0_28px_rgba(212,175,55,0.35)] hover:ring-[#D4AF37]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/60"
              : "cursor-not-allowed bg-slate-100 text-slate-400"
          )}
        >
          {analyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" aria-hidden />
              Running AI Architectural &amp; Structural Audit…
            </>
          ) : (
            <>
              <Sparkles
                className="h-4 w-4 text-[#D4AF37] drop-shadow-[0_0_6px_rgba(212,175,55,0.8)]"
                aria-hidden
              />
              <Building2 className="h-4 w-4 text-[#D4AF37]/80" aria-hidden />
              Run AI Architectural &amp; Structural Audit
            </>
          )}
        </button>
      </div>
    </div>
  );
}
