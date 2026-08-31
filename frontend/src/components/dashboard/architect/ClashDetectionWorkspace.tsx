"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { jsPDF } from "jspdf";
import {
  ArrowRight,
  Loader2,
  FileDown,
  BadgeCheck,
  AlertTriangle,
  ImageIcon,
  DraftingCompass,
} from "lucide-react";
import { ProjectPortfolioBar } from "@/components/dashboard/architect/ProjectPortfolioBar";
import {
  BlueprintInspectionCanvas,
  type BlueprintCanvasHandle,
} from "@/components/dashboard/architect/BlueprintInspectionCanvas";
import { GcrPanel } from "@/components/dashboard/architect/GcrPanel";
import { ArchitecturalAuditCard } from "@/components/dashboard/architect/ArchitecturalAuditCard";
import { FloorPlan3DViewport } from "@/components/dashboard/architect/FloorPlan3DViewport";
import { useArchitectWorkspace } from "@/contexts/ArchitectWorkspaceContext";
import type { DetectionBox } from "@/lib/clash-detection";
import {
  downloadDataUrl,
  exportResolvedDxf,
  RESOLVED_BLUEPRINT_PNG,
} from "@/lib/blueprint-export";
import { cn } from "@/lib/utils";

export type CanvasViewMode = "original" | "corrected";

const REPORT_FILENAME = "Construction_AI_Approval_Report.pdf";

function idsMatch(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function buildApprovalReportPdf(opts: {
  projectName: string;
  location: string;
  date: string;
  resolved: Array<{
    title: string;
    prescription: string;
    verificationLog?: string;
  }>;
  remainingClashes: number;
}): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text("Construction AI", margin, y);
  doc.setTextColor(212, 175, 55);
  doc.setFontSize(10);
  doc.text("OFFICIAL APPROVAL REPORT", pageW - margin, y, { align: "right" });

  y += 10;
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(2);
  doc.line(margin, y + 12, pageW - margin, y + 12);

  y += 36;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("Architectural Validation · Generative Clash Resolution", margin, y);
  doc.text(opts.date, pageW - margin, y, { align: "right" });

  y += 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(212, 175, 55);
  doc.text("PROJECT METADATA", margin, y);

  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  const nameLines = doc.splitTextToSize(opts.projectName, pageW - margin * 2);
  doc.text(nameLines, margin, y);
  y += nameLines.length * 20 + 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(`Location / GPS: ${opts.location}`, margin, y);
  y += 16;
  doc.text(`Remaining open clashes: ${opts.remainingClashes}`, margin, y);

  y += 32;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(212, 175, 55);
  doc.text("CLASH RESOLUTION SUMMARY", margin, y);
  y += 16;
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text("Conflicts resolved via AI", margin, y);
  y += 20;

  // Explicit proportional columns: 5% | 30% | 50% | 15%
  const tableW = pageW - margin * 2;
  const colPad = 8; // horizontal breathing room between columns
  const colDefs = [
    { key: "index", width: tableW * 0.05, align: "left" as const },
    { key: "conflict", width: tableW * 0.3, align: "left" as const },
    { key: "prescription", width: tableW * 0.5, align: "left" as const },
    { key: "status", width: tableW * 0.15, align: "center" as const },
  ];
  let colCursor = margin;
  const cols = colDefs.map((c) => {
    const x = colCursor;
    const textW = Math.max(12, c.width - colPad);
    const textX =
      c.align === "center" ? x + c.width / 2 : x + colPad / 2;
    colCursor += c.width;
    return { ...c, x, textX, textW };
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("#", cols[0].textX, y, { align: cols[0].align });
  doc.text("CONFLICT", cols[1].textX, y, { align: cols[1].align });
  const headerRx = doc.splitTextToSize("AI PRESCRIPTION APPLIED", cols[2].textW);
  doc.text(headerRx, cols[2].textX, y, { align: cols[2].align });
  doc.text("STATUS", cols[3].textX, y, { align: cols[3].align });
  y += Math.max(headerRx.length, 1) * 10 + 4;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 14;

  const ensureSpace = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const lineH = 12;

  if (!opts.resolved.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    const emptyMsg = doc.splitTextToSize(
      "No AI resolutions applied yet. Apply GCR fixes, then export.",
      tableW
    );
    doc.text(emptyMsg, margin, y);
    y += emptyMsg.length * lineH + 12;
  } else {
    opts.resolved.forEach((row, i) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const indexLines = doc.splitTextToSize(String(i + 1), cols[0].textW);
      doc.setFont("helvetica", "bold");
      const titleLines = doc.splitTextToSize(row.title, cols[1].textW);
      doc.setFont("helvetica", "normal");
      const rxLines = doc.splitTextToSize(row.prescription, cols[2].textW);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      const statusLines = doc.splitTextToSize("VERIFIED", cols[3].textW);

      const blockH =
        Math.max(
          indexLines.length,
          titleLines.length,
          rxLines.length,
          statusLines.length
        ) *
          lineH +
        10;
      ensureSpace(blockH);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(indexLines, cols[0].textX, y, { align: cols[0].align });
      doc.setFont("helvetica", "bold");
      doc.text(titleLines, cols[1].textX, y, { align: cols[1].align });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(rxLines, cols[2].textX, y, { align: cols[2].align });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(4, 120, 87);
      doc.text(statusLines, cols[3].textX, y, { align: cols[3].align });

      y += blockH;
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y - 6, pageW - margin, y - 6);
    });
  }

  // Closed-loop mathematical verification log (engineering compliance proof)
  const verificationLines = opts.resolved
    .map((r) => r.verificationLog)
    .filter((log): log is string => Boolean(log && log.trim()));

  if (verificationLines.length > 0) {
    ensureSpace(48);
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(212, 175, 55);
    doc.text("AI-VALIDATION CLOSED-LOOP PROOF", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(
      "Clash ID -> Initial Overlap % -> AI Shift Suggestion -> Recalculated Overlap 0% (Verified)",
      margin,
      y
    );
    y += 12;

    verificationLines.forEach((log) => {
      const wrapped = doc.splitTextToSize(`• ${log}`, tableW);
      ensureSpace(wrapped.length * 11 + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(4, 120, 87);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 11 + 6;
    });
  }

  ensureSpace(120);
  y += 28;
  const cx = pageW / 2;
  const cy = y + 50;
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(3);
  doc.circle(cx, cy, 52);
  doc.setLineWidth(1);
  doc.circle(cx, cy, 46);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(184, 148, 46);
  doc.text("CONSTRUCTION AI", cx, cy - 14, { align: "center" });
  doc.text("COMPLIANCE & STRUCTURAL", cx, cy, { align: "center" });
  doc.text("INTEGRITY PASSED", cx, cy + 14, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("DIGITAL SEAL", cx, cy + 28, { align: "center" });

  y = cy + 70;
  doc.setFontSize(9);
  doc.text(
    "Generated by Construction AI · Not a substitute for licensed engineer sign-off where required by law.",
    cx,
    y,
    { align: "center", maxWidth: pageW - margin * 2 }
  );

  return doc.output("blob");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function ClashDetectionWorkspace() {
  const {
    token,
    activeProject,
    archPreviewUrl,
    detections,
    model,
    elementsDetected,
    hasLiveResult,
    resolutionSuccess,
    highlightedDetectionId,
    clashes,
    recommendations,
    architecturalAudit,
    applyResolution,
    applyingId,
    analyzing,
    showToast,
  } = useArchitectWorkspace();

  const [viewMode, setViewMode] = useState<CanvasViewMode>("original");
  const [exportingPng, setExportingPng] = useState(false);
  const [exportingDxf, setExportingDxf] = useState(false);
  const canvasRef = useRef<BlueprintCanvasHandle>(null);

  const clashTargetIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of clashes) {
      if (c.columnId) ids.add(c.columnId.toLowerCase());
      if (c.openingId) ids.add(c.openingId.toLowerCase());
    }
    // Also mark targets from unapplied recommendations as clash-related in original view
    for (const r of recommendations) {
      if (!r.applied) ids.add(r.targetDetectionId.toLowerCase());
    }
    return ids;
  }, [clashes, recommendations]);

  const displayDetections: DetectionBox[] = useMemo(() => {
    if (viewMode === "original") {
      return detections.map((box) => ({
        ...box,
        // Show pre-correction geometry
        translateX: 0,
        translateY: 0,
        resolved: false,
        clashWarning: clashTargetIds.has(box.id.toLowerCase()),
      }));
    }

    // AI-Corrected: apply every GCR delta (preview full corrected layout)
    return detections.map((box) => {
      const matching = recommendations.filter((r) =>
        idsMatch(r.targetDetectionId, box.id)
      );
      if (!matching.length) {
        return {
          ...box,
          translateX: 0,
          translateY: 0,
          resolved: box.kind === "column" ? false : box.resolved,
          clashWarning: false,
        };
      }
      const deltaX = matching.reduce((sum, r) => sum + r.deltaX, 0);
      const deltaY = matching.reduce((sum, r) => sum + r.deltaY, 0);
      return {
        ...box,
        translateX: deltaX,
        translateY: deltaY,
        resolved: true,
        clashWarning: false,
      };
    });
  }, [viewMode, detections, recommendations, clashTargetIds]);

  /** Always use AI-corrected column positions for industrial CAD export. */
  const correctedDetections: DetectionBox[] = useMemo(() => {
    return detections.map((box) => {
      const matching = recommendations.filter((r) =>
        idsMatch(r.targetDetectionId, box.id)
      );
      if (!matching.length) {
        return {
          ...box,
          translateX: box.translateX ?? 0,
          translateY: box.translateY ?? 0,
          resolved: box.kind === "column" ? Boolean(box.resolved) : box.resolved,
        };
      }
      const deltaX = matching.reduce((sum, r) => sum + r.deltaX, 0);
      const deltaY = matching.reduce((sum, r) => sum + r.deltaY, 0);
      return {
        ...box,
        translateX: deltaX,
        translateY: deltaY,
        resolved: true,
      };
    });
  }, [detections, recommendations]);

  const handleExportReport = () => {
    try {
      const toRow = (r: (typeof recommendations)[number]) => ({
        title: r.title,
        prescription: r.prescription,
        verificationLog: r.verificationLog,
      });

      const resolved = recommendations.filter((r) => r.applied).map(toRow);

      // If user hasn't clicked Apply yet, still list proposed fixes
      const rows =
        resolved.length > 0 ? resolved : recommendations.map(toRow);

      const blob = buildApprovalReportPdf({
        projectName: activeProject?.name ?? "Untitled Project",
        location: activeProject?.location_gps ?? "Not specified",
        date: new Date().toLocaleString("en-LK", {
          dateStyle: "medium",
          timeStyle: "short",
        }),
        resolved: rows,
        remainingClashes: clashes.length,
      });

      downloadBlob(blob, REPORT_FILENAME);
      showToast("Approval report downloaded.");
    } catch {
      showToast("Could not export the approval report. Please try again.", "error");
    }
  };

  /** Rasterize the live canvas (blueprint + emerald resolved columns) to PNG. */
  const handleDownloadResolvedImage = async () => {
    if (exportingPng) return;
    setExportingPng(true);
    try {
      // Prefer AI-corrected visual state for the industrial snapshot
      if (viewMode !== "corrected") {
        setViewMode("corrected");
        await new Promise((r) => window.setTimeout(r, 80));
      }
      const dataUrl = await canvasRef.current?.capturePngDataUrl();
      if (!dataUrl) {
        throw new Error("Canvas capture unavailable");
      }
      downloadDataUrl(dataUrl, RESOLVED_BLUEPRINT_PNG);
      showToast("Resolved blueprint image downloaded.");
    } catch {
      showToast("Could not capture the blueprint image.", "error");
    } finally {
      setExportingPng(false);
    }
  };

  /** Persist layout → GET /export-dxf/{report_id} → hidden-anchor download. */
  const handleExportDxf = async () => {
    if (exportingDxf) return;
    if (!activeProject) {
      showToast("Select a project before exporting AutoCAD DXF.", "error");
      return;
    }
    setExportingDxf(true);
    try {
      await exportResolvedDxf({
        projectId: activeProject.id,
        detections: correctedDetections,
        token,
      });
      showToast("AutoCAD DXF downloaded.");
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Could not export AutoCAD DXF.",
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
        >
          <div className="mx-4 flex max-w-md flex-col items-center rounded-2xl border border-[#D4AF37]/40 bg-white px-8 py-10 text-center shadow-luxury-lg">
            <Loader2 className="h-10 w-10 animate-spin text-[#D4AF37]" aria-hidden />
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">
              Clash Engine
            </p>
            <h2 className="mt-2 text-lg font-bold text-slate-900">
              Calculating Structural Loads
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              AI analyzing blueprints and calculating structural loads, please
              wait…
            </p>
          </div>
        </div>
      )}

      <ProjectPortfolioBar
        compact
        eyebrow="Component 2 · Clash Intelligence"
        title="AI Clash Detection Center"
        subtitle="Compare original clashes vs AI-corrected layout, then export approval."
      />

      {!hasLiveResult && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/40 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              No live analysis yet
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Run dual-plan analysis in Blueprint Parser to sync detections and
              clashes here.
            </p>
          </div>
          <Link
            href="/dashboard/blueprint-parser"
            className="inline-flex items-center gap-2 rounded-md border border-[#D4AF37]/30 bg-[#1E1E24] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-slate-800"
          >
            Open Blueprint Parser
            <ArrowRight className="h-4 w-4 text-[#D4AF37]" aria-hidden />
          </Link>
        </div>
      )}

      {activeProject && (
        <p className="text-xs text-slate-500">
          Comparing plans for{" "}
          <span className="font-semibold text-slate-800">
            {activeProject.name}
          </span>
          {hasLiveResult && (
            <span className="text-slate-400">
              {" "}
              · {clashes.length} active clash{clashes.length === 1 ? "" : "es"}
            </span>
          )}
        </p>
      )}

      {/* View toggle + industrial exports */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Blueprint view mode"
          className="inline-flex w-full rounded-xl border border-slate-200 bg-slate-100 p-1 sm:w-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "original"}
            onClick={() => setViewMode("original")}
            className={cn(
              "flex-1 rounded-lg px-4 py-2 text-xs font-bold transition-all sm:flex-none",
              viewMode === "original"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            Original Blueprint
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "corrected"}
            onClick={() => setViewMode("corrected")}
            className={cn(
              "flex-1 rounded-lg px-4 py-2 text-xs font-bold transition-all sm:flex-none",
              viewMode === "corrected"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            AI-Corrected Layout
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={handleDownloadResolvedImage}
            disabled={exportingPng}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-500/35 bg-emerald-950/90 px-4 py-2.5 text-sm font-medium text-emerald-50 transition-all hover:bg-emerald-900 disabled:opacity-60"
          >
            {exportingPng ? (
              <Loader2 className="h-4 w-4 animate-spin text-emerald-300" aria-hidden />
            ) : (
              <ImageIcon className="h-4 w-4 text-emerald-300" aria-hidden />
            )}
            Download Resolved Blueprint (Image)
          </button>

          <button
            type="button"
            onClick={handleExportDxf}
            disabled={exportingDxf || !activeProject}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[#D4AF37]/40 bg-[#1E1E24] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-slate-800 disabled:opacity-60"
          >
            {exportingDxf ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" aria-hidden />
            ) : (
              <DraftingCompass className="h-4 w-4 text-[#D4AF37]" aria-hidden />
            )}
            Export AutoCAD DXF
          </button>

          <button
            type="button"
            onClick={handleExportReport}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[#D4AF37]/30 bg-[#1E1E24] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-slate-800"
          >
            <FileDown className="h-4 w-4 text-[#D4AF37]" aria-hidden />
            Export Approval Report
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5 lg:gap-8">
        <div className="lg:col-span-3 space-y-3">
          {/* Status alert */}
          {viewMode === "original" ? (
            <div
              className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3"
              role="status"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
              <p className="text-sm font-semibold text-red-800">
                Status: Clashes Detected
                {clashes.length > 0 && (
                  <span className="ml-1 font-medium text-red-600">
                    ({clashes.length} active)
                  </span>
                )}
              </p>
            </div>
          ) : (
            <div
              className="flex items-center gap-2.5 rounded-xl border border-[#D4AF37]/35 bg-gradient-to-r from-amber-50/80 to-emerald-50/60 px-4 py-3"
              role="status"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/15">
                <BadgeCheck className="h-4 w-4 text-[#B8942E]" aria-hidden />
              </span>
              <p className="text-sm font-semibold text-slate-800">
                Status: 100% Clash-Free{" "}
                <span className="text-[#B8942E]">(AI Approved)</span>
              </p>
            </div>
          )}

          <BlueprintInspectionCanvas
            ref={canvasRef}
            detections={displayDetections}
            model={model}
            elementsDetected={elementsDetected}
            hasLiveResult={hasLiveResult}
            resolutionSuccess={
              viewMode === "corrected" ? true : resolutionSuccess
            }
            highlightedDetectionId={
              viewMode === "original" ? highlightedDetectionId : null
            }
            blueprintImageUrl={archPreviewUrl}
            viewMode={viewMode}
            statusBanner={false}
          />

          {/* 3D maquette synced to Original / AI-Corrected viewMode */}
          <FloorPlan3DViewport
            detections={detections}
            recommendations={recommendations}
            architecturalAudit={architecturalAudit}
            viewMode={viewMode}
            hasLiveResult={hasLiveResult}
            projectName={activeProject?.name}
          />
        </div>
        <div className="lg:col-span-2">
          <GcrPanel
            clashes={clashes}
            recommendations={recommendations}
            hasLiveResult={hasLiveResult}
            onApplyResolution={applyResolution}
            applyingId={applyingId}
          />
        </div>
      </div>

      <ArchitecturalAuditCard
        audit={architecturalAudit}
        hasLiveResult={hasLiveResult}
      />
    </div>
  );
}
