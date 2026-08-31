"use client";

import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  Loader2,
  Ruler,
  Boxes,
  Box,
  LayoutGrid,
  FileDown,
  DraftingCompass,
  BadgeCheck,
} from "lucide-react";
import { ProjectPortfolioBar } from "@/components/dashboard/architect/ProjectPortfolioBar";
import { ClashPlanUploadSection } from "@/components/dashboard/architect/ClashPlanUploadSection";
import { BlueprintInspectionCanvas } from "@/components/dashboard/architect/BlueprintInspectionCanvas";
import { FloorPlan3DViewport } from "@/components/dashboard/architect/FloorPlan3DViewport";
import { AIConceptStudio } from "@/components/dashboard/architect/AIConceptStudio";
import { CodeComplianceAuditPanel } from "@/components/dashboard/architect/CodeComplianceAuditPanel";
import { useArchitectWorkspace } from "@/contexts/ArchitectWorkspaceContext";
import { exportResolvedDxf } from "@/lib/blueprint-export";
import { cn } from "@/lib/utils";

type WorkspaceView = "2d" | "3d";

const REPORT_FILENAME = "Construction_AI_Approval_Report.pdf";

function buildApprovalReportPdf(opts: {
  projectName: string;
  location: string;
  date: string;
  resolved: Array<{ title: string; prescription: string; verificationLog?: string }>;
  remainingClashes: number;
  auditSummary?: string;
}): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("AI Architectural Approval Report", margin, y);
  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Project: ${opts.projectName}`, margin, y);
  y += 16;
  doc.text(`Location: ${opts.location}`, margin, y);
  y += 16;
  doc.text(`Date: ${opts.date}`, margin, y);
  y += 16;
  doc.text(`Remaining clashes: ${opts.remainingClashes}`, margin, y);
  if (opts.auditSummary) {
    y += 16;
    doc.text(opts.auditSummary, margin, y, { maxWidth: 500 });
  }
  y += 28;
  opts.resolved.forEach((row, i) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}. ${row.title}`, margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.text(row.prescription, margin, y, { maxWidth: 500 });
    y += 20;
  });

  return doc.output("blob");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function BlueprintParserWorkspace() {
  const {
    token,
    activeProject,
    archFile,
    setArchFile,
    archPreviewUrl,
    analyzing,
    analysisError,
    runAnalysis,
    detections,
    recommendations,
    clashes,
    model,
    elementsDetected,
    hasLiveResult,
    wallLengthFt,
    resolutionSuccess,
    highlightedDetectionId,
    architecturalAudit,
    blueprint3d,
    showToast,
  } = useArchitectWorkspace();

  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("2d");
  const [maquetteMode, setMaquetteMode] = useState<"original" | "corrected">("corrected");
  const [exportingDxf, setExportingDxf] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);

  const blueprint3dData = useMemo(() => {
    if (!hasLiveResult || !blueprint3d) return null;
    return blueprint3d;
  }, [hasLiveResult, blueprint3d]);

  const isAiGenerated = useMemo(
    () => detections.some((d) => d.isAiGenerated),
    [detections]
  );

  const auditSummary = architecturalAudit?.roomCompliance?.summary;

  const handleExportReport = () => {
    setExportingReport(true);
    try {
      const rows = recommendations.map((r) => ({
        title: r.title,
        prescription: r.prescription,
        verificationLog: r.verificationLog,
      }));
      const blob = buildApprovalReportPdf({
        projectName: activeProject?.name ?? "Blueprint Project",
        location: activeProject?.location_gps ?? "Site TBD",
        date: new Date().toLocaleString(),
        resolved: rows,
        remainingClashes: clashes.length,
        auditSummary,
      });
      downloadBlob(blob, REPORT_FILENAME);
      showToast("Approval report downloaded.");
    } catch {
      showToast("Could not export approval report.", "error");
    } finally {
      setExportingReport(false);
    }
  };

  const handleExportDxf = async () => {
    if (!activeProject) {
      showToast("Select a project before exporting DXF.", "error");
      return;
    }
    setExportingDxf(true);
    try {
      await exportResolvedDxf({
        projectId: activeProject.id,
        detections,
        token,
      });
      showToast("AutoCAD DXF downloaded.");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not export DXF.",
        "error"
      );
    } finally {
      setExportingDxf(false);
    }
  };

  return (
    <div className="relative space-y-6 sm:space-y-8">
      {analyzing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-label="Running architectural audit"
        >
          <div className="mx-4 flex max-w-md flex-col items-center rounded-2xl border border-[#D4AF37]/40 bg-white px-8 py-10 text-center shadow-luxury-lg">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#D4AF37]/20" />
              <Loader2
                className="relative h-10 w-10 animate-spin text-[#D4AF37]"
                aria-hidden
              />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">
              AI Compliance Pipeline
            </p>
            <h2 className="mt-2 text-lg font-bold text-slate-900">
              Architectural &amp; Structural Audit
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Extracting rooms, verifying building codes, synthesizing structural
              grid…
            </p>
          </div>
        </div>
      )}

      <ProjectPortfolioBar
        compact
        eyebrow="Component 2 · AI Code Compliance"
        title="AI Architectural Code Compliance & Generative Structural Synthesizer"
        subtitle="Upload one 2D architectural blueprint — automated ventilation, code audit, AI column grid & 3D dollhouse."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Wall Length
              </p>
              <p className="mt-2 text-3xl font-bold text-brand-primary">
                {hasLiveResult ? wallLengthFt.toLocaleString() : "—"}
                {hasLiveResult && (
                  <span className="ml-1 text-base font-semibold text-slate-500">ft</span>
                )}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <Ruler className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Parsed Elements
              </p>
              <p className="mt-2 text-3xl font-bold text-brand-primary">
                {hasLiveResult ? elementsDetected : "—"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Walls, doors, windows &amp; AI columns
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <Boxes className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      <ClashPlanUploadSection
        blueprintFile={archFile}
        onBlueprintChange={setArchFile}
        onAnalyze={runAnalysis}
        analyzing={analyzing}
        error={analysisError}
        enabled={Boolean(activeProject)}
        lockedMessage="Select or create an active project to unlock blueprint upload."
      />

      {hasLiveResult && (
        <>
          <CodeComplianceAuditPanel
            audit={architecturalAudit}
            hasLiveResult={hasLiveResult}
            isAiGenerated={isAiGenerated}
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={exportingReport}
              onClick={handleExportReport}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {exportingReport ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BadgeCheck className="h-3.5 w-3.5 text-gold" />
              )}
              Export Approval Report (PDF)
            </button>
            <button
              type="button"
              disabled={exportingDxf}
              onClick={() => void handleExportDxf()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {exportingDxf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <DraftingCompass className="h-3.5 w-3.5 text-gold" />
              )}
              Export AutoCAD DXF
            </button>
          </div>
        </>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Blueprint workspace view"
          className="inline-flex w-full rounded-xl border border-slate-200 bg-slate-100 p-1 sm:w-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={workspaceView === "2d"}
            onClick={() => setWorkspaceView("2d")}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all sm:flex-none",
              workspaceView === "2d"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
            2D Blueprint Canvas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={workspaceView === "3d"}
            onClick={() => setWorkspaceView("3d")}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all sm:flex-none",
              workspaceView === "3d"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Box className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
            3D Dollhouse View
          </button>
        </div>
        <p className="text-[11px] text-slate-400 sm:text-right">
          {workspaceView === "3d"
            ? "AI-synthesized columns · framed openings · orbit controls"
            : "YOLOv8 + OpenCV overlay"}
        </p>
      </div>

      {workspaceView === "2d" ? (
        <BlueprintInspectionCanvas
          detections={detections}
          model={model}
          elementsDetected={elementsDetected}
          hasLiveResult={hasLiveResult}
          resolutionSuccess={resolutionSuccess}
          highlightedDetectionId={highlightedDetectionId}
          blueprintImageUrl={archPreviewUrl}
        />
      ) : (
        <div className="space-y-3">
          {hasLiveResult && recommendations.length > 0 && (
            <div
              role="tablist"
              className="inline-flex w-full rounded-xl border border-slate-200 bg-slate-100 p-1 sm:w-auto"
            >
              <button
                type="button"
                onClick={() => setMaquetteMode("original")}
                className={cn(
                  "flex-1 rounded-lg px-4 py-2 text-xs font-bold sm:flex-none",
                  maquetteMode === "original"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500"
                )}
              >
                Original Layout
              </button>
              <button
                type="button"
                onClick={() => setMaquetteMode("corrected")}
                className={cn(
                  "flex-1 rounded-lg px-4 py-2 text-xs font-bold sm:flex-none",
                  maquetteMode === "corrected"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500"
                )}
              >
                AI-Corrected Layout
              </button>
            </div>
          )}
          <AIConceptStudio
            projectName={activeProject?.name}
            projectLocation={activeProject?.location_gps}
            blueprintImageUrl={archPreviewUrl}
            blueprint3d={blueprint3dData}
            detections={detections}
            architecturalAudit={architecturalAudit}
            hasLiveResult={hasLiveResult}
            wallCount={blueprint3dData?.walls?.length ?? 0}
            elementsDetected={elementsDetected}
            wallLengthFt={wallLengthFt}
            bimViewport={
              <FloorPlan3DViewport
                data={blueprint3dData}
                detections={detections}
                openingsSchedule={blueprint3dData?.openings_schedule}
                recommendations={recommendations}
                architecturalAudit={architecturalAudit}
                viewMode={maquetteMode}
                hasLiveResult={hasLiveResult}
                projectName={activeProject?.name}
              />
            }
          />
        </div>
      )}

      {!activeProject && (
        <p className="rounded-xl border border-dashed border-gold/40 bg-gold/[0.04] px-4 py-3 text-center text-sm text-slate-600">
          Tip: create a project above, upload your architectural blueprint, and run
          the AI audit.
        </p>
      )}
    </div>
  );
}
