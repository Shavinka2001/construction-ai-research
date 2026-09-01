"use client";

import { useCallback, useState } from "react";
import { FileImage, FileUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { predictCompliance } from "@/lib/compliance-predict";
import { extractDocumentText } from "@/lib/extract-document-text";
import type { CompliancePrediction } from "@/lib/compliance-types";
import { ComplianceStatusBadge } from "@/components/dashboard/authority/ComplianceStatusBadge";

const ACCEPTED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.txt,.md,.csv";
const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "text/csv",
  "text/markdown",
];

export function AiDocumentUploadVerification() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [prediction, setPrediction] = useState<CompliancePrediction | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const runComplianceScan = useCallback(async (file: File) => {
    setIsScanning(true);
    setError(null);
    setPrediction(null);

    try {
      const inspectionText = await extractDocumentText(file);
      const result = await predictCompliance(inspectionText);
      setPrediction(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Compliance scan failed"
      );
    } finally {
      setIsScanning(false);
    }
  }, []);

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) return;

      const validType =
        ACCEPTED_TYPES.includes(file.type) ||
        ACCEPTED_EXTENSIONS.split(",").some((ext) =>
          file.name.toLowerCase().endsWith(ext)
        );

      if (!validType) {
        setError("Please upload a PDF, image, or text document.");
        return;
      }

      setSelectedFile(file);
      void runComplianceScan(file);
    },
    [runComplianceScan]
  );

  const onInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      handleFile(file);
      event.target.value = "";
    },
    [handleFile]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      handleFile(event.dataTransfer.files?.[0] ?? null);
    },
    [handleFile]
  );

  const statusLabel = isScanning
    ? "Scanning..."
    : prediction?.label ?? (error ? "Unavailable" : "Awaiting upload");

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-luxury">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          AI Document Upload &amp; Verification
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">
          Compliance Document Scanner
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Upload permit packages for ML-assisted regulatory classification
        </p>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <label
          htmlFor="authority-document-upload"
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={cn(
            "group flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white p-5 transition-all duration-300",
            isDragging
              ? "border-gold bg-gold/5 shadow-[inset_0_0_0_1px_#D4AF37]"
              : "border-gold/40 hover:border-gold hover:shadow-luxury"
          )}
          style={{
            backgroundImage: `
            linear-gradient(rgba(212,175,55,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212,175,55,0.08) 1px, transparent 1px)
          `,
            backgroundSize: "16px 16px",
          }}
        >
          <input
            id="authority-document-upload"
            type="file"
            className="sr-only"
            accept={ACCEPTED_EXTENSIONS}
            onChange={onInputChange}
          />
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold/30 bg-white shadow-sm transition-transform group-hover:scale-105">
            <FileUp className="h-5 w-5 text-gold" aria-hidden />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-800">
            Drop compliance documents here
          </p>
          <p className="mt-1 text-xs text-slate-500">
            PDF · PNG · JPG · TXT
          </p>
          <span className="mt-3 flex items-center gap-1.5 text-xs font-medium text-gold">
            <FileImage className="h-3.5 w-3.5" aria-hidden />
            Browse files
          </span>
        </label>

        {selectedFile && (
          <p className="truncate text-xs text-slate-500">
            Selected: <span className="font-medium text-slate-700">{selectedFile.name}</span>
          </p>
        )}

        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                AI Assessment
              </p>
              <div className="mt-2 flex items-center gap-2">
                {isScanning && (
                  <Loader2
                    className="h-4 w-4 animate-spin text-gold"
                    aria-hidden
                  />
                )}
                {!isScanning && prediction && (
                  <ComplianceStatusBadge label={prediction.label} size="md" />
                )}
                {!isScanning && !prediction && (
                  <span className="text-sm font-semibold text-slate-600">
                    {statusLabel}
                  </span>
                )}
                {isScanning && (
                  <span className="text-sm font-semibold text-slate-700">
                    {statusLabel}
                  </span>
                )}
              </div>
            </div>
            {prediction?.confidence != null && !isScanning && (
              <p className="text-xs text-slate-500">
                Confidence{" "}
                <span className="font-bold tabular-nums text-charcoal">
                  {Math.round(prediction.confidence * 100)}%
                </span>
              </p>
            )}
          </div>

          {error && !isScanning && (
            <p className="mt-3 text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
