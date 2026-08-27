"use client";

import { useCallback, useId, useState } from "react";
import {
  FileUp,
  FileImage,
  Layers,
  X,
  CheckCircle2,
  Loader2,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
const ACCEPTED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg";
const MAX_BYTES = 25 * 1024 * 1024;

export type PlanSlot = "arch" | "struct";

type ClashPlanUploadSectionProps = {
  archFile: File | null;
  structFile: File | null;
  onArchChange: (file: File | null) => void;
  onStructChange: (file: File | null) => void;
  onAnalyze: () => void;
  analyzing: boolean;
  error?: string | null;
  /** Dual-upload remains locked until an active project is selected. */
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

type UploadSlotProps = {
  slot: PlanSlot;
  title: string;
  subtitle: string;
  file: File | null;
  onChange: (file: File | null) => void;
  onValidationError: (message: string | null) => void;
  icon: "arch" | "struct";
  disabled?: boolean;
  optional?: boolean;
};

function UploadSlot({
  slot,
  title,
  subtitle,
  file,
  onChange,
  onValidationError,
  icon,
  disabled = false,
  optional = false,
}: UploadSlotProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

  const acceptFile = useCallback(
    (incoming: FileList | null) => {
      if (disabled || !incoming?.length) return;
      const candidate = incoming[0];
      if (!isAcceptedFile(candidate)) {
        onValidationError("Please upload a PDF or image (PNG / JPG).");
        return;
      }
      if (candidate.size > MAX_BYTES) {
        onValidationError("File exceeds the 25MB size limit.");
        return;
      }
      onValidationError(null);
      onChange(candidate);
    },
    [disabled, onChange, onValidationError]
  );

  const Icon = icon === "arch" ? FileImage : Layers;

  return (
    <div className={cn("flex flex-col", disabled && "opacity-55")}>
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
            Slot {slot === "arch" ? "A" : "B"}
            {optional ? " · Optional" : ""}
          </p>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>

      <label
        htmlFor={disabled ? undefined : inputId}
        onDragOver={(e) => {
          if (disabled) return;
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
          "group relative flex min-h-[168px] flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 transition-all duration-300",
          disabled ? "cursor-not-allowed border-slate-200 bg-slate-50" : "cursor-pointer",
          !disabled && isDragging
            ? "border-gold bg-gold/5 shadow-[inset_0_0_0_1px_#D4AF37]"
            : !disabled && file
              ? "border-gold/60 bg-gold/[0.03]"
              : !disabled
                ? "border-gold/40 hover:border-gold hover:bg-gold/[0.03]"
                : "",
          !disabled &&
            "focus-within:border-gold focus-within:ring-4 focus-within:ring-gold/10"
        )}
        style={
          disabled
            ? undefined
            : {
                backgroundImage: `
            linear-gradient(rgba(212,175,55,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212,175,55,0.06) 1px, transparent 1px)
          `,
                backgroundSize: "16px 16px",
              }
        }
      >
        <input
          id={inputId}
          type="file"
          className="sr-only"
          accept={ACCEPTED_EXTENSIONS}
          disabled={disabled}
          onChange={(e) => {
            acceptFile(e.target.files);
            e.target.value = "";
          }}
        />

        {file ? (
          <div className="flex w-full flex-col items-center text-center">
            <CheckCircle2 className="h-8 w-8 text-gold" aria-hidden />
            <p className="mt-3 max-w-full truncate text-sm font-semibold text-slate-900">
              {file.name}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {formatBytes(file.size)} · Ready for analysis
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(null);
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Remove
            </button>
          </div>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-white shadow-sm transition-transform group-hover:scale-105">
              <FileUp className="h-5 w-5 text-gold" aria-hidden />
            </div>
            <p className="mt-3 text-center text-sm font-semibold text-slate-900">
              {disabled
                ? "Select a project to unlock"
                : optional
                  ? "Leave empty to use AI-GSL"
                  : "Drop plan here or browse"}
            </p>
            <p className="mt-1 text-center text-xs text-slate-500">
              PDF or Image · Max size 25MB
            </p>
          </>
        )}
      </label>
    </div>
  );
}

export function ClashPlanUploadSection({
  archFile,
  structFile,
  onArchChange,
  onStructChange,
  onAnalyze,
  analyzing,
  error,
  enabled = true,
  lockedMessage = "Select an active project to unlock blueprint uploads.",
}: ClashPlanUploadSectionProps) {
  const [slotError, setSlotError] = useState<string | null>(null);
  const canDualAnalyze =
    enabled && Boolean(archFile && structFile) && !analyzing;
  const canGslAnalyze =
    enabled && Boolean(archFile) && !structFile && !analyzing;
  const gslMode = Boolean(archFile && !structFile);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Dual-Plan Comparison
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">
          Upload Plans for Clash Detection
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Architectural required · Structural optional — omit to auto-generate
          clash-free columns with AI-GSL
        </p>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {!enabled && (
          <div className="rounded-xl border border-dashed border-gold/40 bg-gold/[0.04] px-4 py-3 text-sm text-slate-600">
            {lockedMessage}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
          <UploadSlot
            slot="arch"
            title="Architectural Blueprint"
            subtitle="YOLOv8 target — doors, windows & openings"
            file={archFile}
            onChange={onArchChange}
            onValidationError={setSlotError}
            icon="arch"
            disabled={!enabled}
          />
          <UploadSlot
            slot="struct"
            title="Structural Blueprint"
            subtitle="Column layout — or leave empty for AI-GSL"
            file={structFile}
            onChange={onStructChange}
            onValidationError={setSlotError}
            icon="struct"
            disabled={!enabled}
            optional
          />
        </div>

        {(slotError || error) && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {slotError || error}
          </p>
        )}

        {gslMode ? (
          <button
            type="button"
            disabled={!canGslAnalyze}
            onClick={onAnalyze}
            className={cn(
              "group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl px-5 py-3.5 text-sm font-bold transition-all duration-300",
              canGslAnalyze
                ? "bg-gradient-to-r from-slate-900 via-[#1a1625] to-slate-900 text-[#D4AF37] shadow-luxury ring-1 ring-[#D4AF37]/40 hover:shadow-[0_0_28px_rgba(212,175,55,0.35)] hover:ring-[#D4AF37]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/60"
                : "cursor-not-allowed bg-slate-100 text-slate-400"
            )}
          >
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" aria-hidden />
                Generating clash-free column grid…
              </>
            ) : (
              <>
                <Sparkles
                  className="h-4 w-4 text-[#D4AF37] drop-shadow-[0_0_6px_rgba(212,175,55,0.8)]"
                  aria-hidden
                />
                Auto-Generate Clash-Free Columns (AI-GSL)
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled={!canDualAnalyze}
            onClick={onAnalyze}
            className={cn(
              "flex w-full items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 text-sm font-bold transition-all duration-200",
              canDualAnalyze
                ? "bg-slate-900 text-gold shadow-luxury hover:bg-charcoal-light hover:shadow-luxury-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                : "cursor-not-allowed bg-slate-100 text-slate-400"
            )}
          >
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Analyzing plans…
              </>
            ) : (
              <>
                <ScanSearch className="h-4 w-4" aria-hidden />
                Analyze &amp; Run Clash Detection
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
