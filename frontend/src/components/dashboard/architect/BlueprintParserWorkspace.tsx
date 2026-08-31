"use client";

import { useMemo, useState } from "react";
import { Loader2, Ruler, Boxes, Box, LayoutGrid } from "lucide-react";
import { ProjectPortfolioBar } from "@/components/dashboard/architect/ProjectPortfolioBar";
import { ClashPlanUploadSection } from "@/components/dashboard/architect/ClashPlanUploadSection";
import { BlueprintInspectionCanvas } from "@/components/dashboard/architect/BlueprintInspectionCanvas";
import { FloorPlan3DViewport } from "@/components/dashboard/architect/FloorPlan3DViewport";
import { AIConceptStudio } from "@/components/dashboard/architect/AIConceptStudio";
import { useArchitectWorkspace } from "@/contexts/ArchitectWorkspaceContext";
import { cn } from "@/lib/utils";

type WorkspaceView = "2d" | "3d";

export function BlueprintParserWorkspace() {
  const {
    activeProject,
    archFile,
    structFile,
    setArchFile,
    setStructFile,
    archPreviewUrl,
    analyzing,
    analysisError,
    runAnalysis,
    detections,
    recommendations,
    model,
    elementsDetected,
    hasLiveResult,
    wallLengthFt,
    resolutionSuccess,
    highlightedDetectionId,
    architecturalAudit,
    blueprint3d,
  } = useArchitectWorkspace();

  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("2d");
  const [maquetteMode, setMaquetteMode] = useState<"original" | "corrected">(
    "corrected"
  );

  /** Prefer the live API blueprint payload; never invent demo geometry. */
  const blueprint3dData = useMemo(() => {
    if (!hasLiveResult || !blueprint3d) return null;
    return blueprint3d;
  }, [hasLiveResult, blueprint3d]);

  return (
    <div className="relative space-y-6 sm:space-y-8">
      {analyzing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-label="Analyzing blueprints"
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
              Hybrid AI / CV Pipeline
            </p>
            <h2 className="mt-2 text-lg font-bold text-slate-900">
              Analyzing Blueprints
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              AI analyzing blueprints and calculating structural loads, please
              wait…
            </p>
          </div>
        </div>
      )}

      <ProjectPortfolioBar
        compact
        eyebrow="Component 2 · Blueprint Intelligence"
        title="Blueprint Parser Workspace"
        subtitle="Upload architectural & structural plans for YOLOv8 + OpenCV analysis — then explore the extruded 3D floor plan."
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
                  <span className="ml-1 text-base font-semibold text-slate-500">
                    ft
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Linear footage from segmentation
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
                Doors, windows & columns detected
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <Boxes className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      <ClashPlanUploadSection
        archFile={archFile}
        structFile={structFile}
        onArchChange={setArchFile}
        onStructChange={setStructFile}
        onAnalyze={runAnalysis}
        analyzing={analyzing}
        error={analysisError}
        enabled={Boolean(activeProject)}
        lockedMessage="Select or create an active project to unlock dual-blueprint uploads."
      />

      {/* 2D Blueprint Canvas ↔ 3D Workspace View */}
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
            3D Workspace View
          </button>
        </div>
        <p className="text-[11px] text-slate-400 sm:text-right">
          {workspaceView === "3d"
            ? "WebGL extrusion · OrbitControls enabled"
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
              aria-label="3D clash resolution mode"
              className="inline-flex w-full rounded-xl border border-slate-200 bg-slate-100 p-1 sm:w-auto"
            >
              <button
                type="button"
                role="tab"
                aria-selected={maquetteMode === "original"}
                onClick={() => setMaquetteMode("original")}
                className={cn(
                  "flex-1 rounded-lg px-4 py-2 text-xs font-bold transition-all sm:flex-none",
                  maquetteMode === "original"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                Original Clash
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={maquetteMode === "corrected"}
                onClick={() => setMaquetteMode("corrected")}
                className={cn(
                  "flex-1 rounded-lg px-4 py-2 text-xs font-bold transition-all sm:flex-none",
                  maquetteMode === "corrected"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
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
        <p
          className={cn(
            "rounded-xl border border-dashed border-gold/40 bg-gold/[0.04] px-4 py-3 text-center text-sm text-slate-600"
          )}
        >
          Tip: create a project above, then upload both plans and run analysis.
        </p>
      )}
    </div>
  );
}
