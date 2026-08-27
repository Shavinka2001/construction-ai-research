"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from "react";
import { CheckCircle2 } from "lucide-react";
import type { DetectionBox, DetectionKind } from "@/lib/clash-detection";
import { DEFAULT_DETECTIONS } from "@/lib/clash-detection";
import { cn } from "@/lib/utils";

export type CanvasViewMode = "original" | "corrected";

/** Imperative handle used by Clash Detection to export a PNG snapshot. */
export type BlueprintCanvasHandle = {
  /** Rasterize the active overlay (blueprint + boxes) to a PNG data URL. */
  capturePngDataUrl: () => Promise<string>;
};

type BlueprintInspectionCanvasProps = {
  detections?: DetectionBox[];
  model?: string;
  elementsDetected?: number;
  hasLiveResult?: boolean;
  resolutionSuccess?: boolean;
  highlightedDetectionId?: string | null;
  /** Object URL of the uploaded architectural blueprint (optional). */
  blueprintImageUrl?: string | null;
  /** Original vs AI-corrected presentation. */
  viewMode?: CanvasViewMode;
  /** When false, parent renders the status alert above the canvas. */
  statusBanner?: boolean;
};

function boxStyles(
  kind: DetectionKind,
  isHighlighted: boolean,
  isResolved: boolean,
  clashWarning: boolean,
  wallType?: string,
  isAiGenerated?: boolean
): string {
  if (isResolved) {
    return "border-2 border-solid border-emerald-500 bg-emerald-500/15 shadow-[0_0_20px_rgba(16,185,129,0.35)]";
  }
  if (clashWarning) {
    return "z-10 border-2 border-solid border-red-500 bg-red-500/15 shadow-[0_0_22px_rgba(239,68,68,0.4)]";
  }
  if (isHighlighted) {
    return "z-10 border-2 border-dashed border-[#D4AF37] bg-[#D4AF37]/20 shadow-[0_0_24px_rgba(212,175,55,0.45)]";
  }
  if (kind === "wall" || wallType) {
    if (wallType === "LOAD_BEARING") {
      return "border-2 border-solid border-red-800/90 bg-slate-800/35 shadow-[0_0_16px_rgba(127,29,29,0.35)]";
    }
    return "border border-solid border-slate-300 bg-slate-200/50";
  }
  if (kind === "column") {
    if (isAiGenerated) {
      return "border-2 border-dashed border-[#D4AF37] bg-[#D4AF37]/18 shadow-[0_0_18px_rgba(212,175,55,0.35)] ring-1 ring-[#D4AF37]/30";
    }
    return "border-2 border-dashed border-[#D4AF37] bg-[#D4AF37]/10 hover:bg-[#D4AF37]/15";
  }
  if (kind === "opening") {
    return "border border-solid border-slate-900 bg-transparent hover:bg-slate-900/5";
  }
  return "border border-dashed border-slate-500/60 bg-slate-500/5";
}

function labelStyles(
  kind: DetectionKind,
  isResolved: boolean,
  clashWarning: boolean,
  wallType?: string
): string {
  if (isResolved) return "bg-emerald-900/90 text-emerald-300";
  if (clashWarning) return "bg-red-700/95 text-white";
  if (kind === "wall" || wallType) {
    if (wallType === "LOAD_BEARING") return "bg-red-950/95 text-red-100";
    return "bg-slate-500/90 text-slate-100";
  }
  if (kind === "column") return "bg-[#1E1E24]/90 text-[#D4AF37]";
  if (kind === "opening") return "bg-slate-900/90 text-white";
  return "bg-[#1E1E24]/90 text-slate-300";
}

function idsMatch(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function parsePercent(value: string | undefined): number {
  if (!value) return 0;
  const n = Number.parseFloat(value.replace("%", ""));
  return Number.isFinite(n) ? n / 100 : 0;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load blueprint image"));
    img.src = src;
  });
}

/**
 * Draw object-contain placement of an image inside a square/rect canvas.
 */
function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasW: number,
  canvasH: number
) {
  const scale = Math.min(canvasW / img.naturalWidth, canvasH / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  const x = (canvasW - w) / 2;
  const y = (canvasH - h) / 2;
  ctx.drawImage(img, x, y, w, h);
}

export const BlueprintInspectionCanvas = forwardRef<
  BlueprintCanvasHandle,
  BlueprintInspectionCanvasProps
>(function BlueprintInspectionCanvas(
  {
    detections = DEFAULT_DETECTIONS,
    model = "structura-yolov8n-v2",
    elementsDetected,
    hasLiveResult = false,
    resolutionSuccess = false,
    highlightedDetectionId = null,
    blueprintImageUrl = null,
    viewMode = "original",
    statusBanner = true,
  },
  ref
) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const count = elementsDetected ?? detections.length;
  const openings = detections.filter((d) => d.kind === "opening").length;
  const columns = detections.filter((d) => d.kind === "column").length;
  const showCorrectedChrome = viewMode === "corrected";

  const capturePngDataUrl = useCallback(async () => {
    const el = overlayRef.current;
    if (!el) {
      throw new Error("Blueprint canvas is not ready");
    }

    const width = Math.max(1, Math.round(el.clientWidth));
    const height = Math.max(1, Math.round(el.clientHeight));

    // Off-screen HTMLCanvas — industrial PNG export via toDataURL
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2D canvas context unavailable");
    }

    // Dark slate stage (matches UI)
    ctx.fillStyle = "#1E1E24";
    ctx.fillRect(0, 0, width, height);

    if (blueprintImageUrl) {
      try {
        const img = await loadImage(blueprintImageUrl);
        ctx.globalAlpha = 0.9;
        drawContainedImage(ctx, img, width, height);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(30, 30, 36, 0.25)";
        ctx.fillRect(0, 0, width, height);
      } catch {
        // Grid fallback if the object URL cannot be painted
        ctx.strokeStyle = "rgba(212,175,55,0.25)";
        for (let x = 0; x < width; x += 24) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += 24) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }
    }

    for (const box of detections) {
      const left = parsePercent(box.left) * width + (box.translateX ?? 0);
      const top = parsePercent(box.top) * height + (box.translateY ?? 0);
      const w = Math.max(2, parsePercent(box.width) * width);
      const h = Math.max(2, parsePercent(box.height) * height);
      const isResolved = Boolean(box.resolved);
      const clashWarning =
        viewMode === "original" && Boolean(box.clashWarning);

      if (isResolved) {
        ctx.fillStyle = "rgba(16, 185, 129, 0.18)";
        ctx.strokeStyle = "#10B981";
        ctx.lineWidth = 2;
      } else if (clashWarning) {
        ctx.fillStyle = "rgba(239, 68, 68, 0.18)";
        ctx.strokeStyle = "#EF4444";
        ctx.lineWidth = 2;
      } else if (box.kind === "wall" || box.wallType) {
        if (box.wallType === "LOAD_BEARING") {
          ctx.fillStyle = "rgba(30, 41, 59, 0.4)";
          ctx.strokeStyle = "#7F1D1D";
          ctx.lineWidth = 2;
        } else {
          ctx.fillStyle = "rgba(226, 232, 240, 0.55)";
          ctx.strokeStyle = "#CBD5E1";
          ctx.lineWidth = 1.5;
        }
        ctx.setLineDash([]);
      } else if (box.kind === "column") {
        ctx.fillStyle = box.isAiGenerated
          ? "rgba(212, 175, 55, 0.22)"
          : "rgba(212, 175, 55, 0.12)";
        ctx.strokeStyle = "#D4AF37";
        ctx.lineWidth = box.isAiGenerated ? 2.5 : 2;
        ctx.setLineDash([6, 4]);
      } else if (box.kind === "opening") {
        ctx.fillStyle = "transparent";
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = "rgba(100, 116, 139, 0.08)";
        ctx.strokeStyle = "rgba(100, 116, 139, 0.7)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
      }

      ctx.fillRect(left, top, w, h);
      ctx.strokeRect(left, top, w, h);
      ctx.setLineDash([]);

      // Label chip
      const label = `${box.label} [${box.confidence}%]${
        isResolved
          ? " · Safe"
          : clashWarning
            ? " · Clash"
            : box.isAiGenerated
              ? " · AI Planned"
              : ""
      }`;
      ctx.font = "bold 10px Inter, system-ui, sans-serif";
      const tw = ctx.measureText(label).width + 8;
      const chipY = Math.max(0, top - 18);
      ctx.fillStyle = isResolved
        ? "rgba(6, 78, 59, 0.92)"
        : clashWarning
          ? "rgba(185, 28, 28, 0.95)"
          : box.kind === "column"
            ? "rgba(30, 30, 36, 0.9)"
            : "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(left, chipY, tw, 14);
      ctx.fillStyle = isResolved
        ? "#6EE7B7"
        : clashWarning
          ? "#FFFFFF"
          : box.kind === "column"
            ? "#D4AF37"
            : "#FFFFFF";
      ctx.fillText(label, left + 4, chipY + 10);
    }

    // Footer strip
    ctx.fillStyle = "rgba(30, 30, 36, 0.85)";
    ctx.fillRect(12, height - 40, width - 24, 28);
    ctx.fillStyle = "#D4AF37";
    ctx.font = "bold 10px Inter, system-ui, sans-serif";
    ctx.fillText(
      `${count} elements · ${model} · Construction AI Resolved Blueprint`,
      20,
      height - 22
    );

    return canvas.toDataURL("image/png");
  }, [blueprintImageUrl, detections, viewMode, count, model]);

  useImperativeHandle(ref, () => ({ capturePngDataUrl }), [capturePngDataUrl]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            {showCorrectedChrome
              ? "AI-Corrected Overlay"
              : "YOLOv8 + OpenCV Overlay"}
          </p>
          {hasLiveResult && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                "border-emerald-200 bg-emerald-50 text-emerald-700"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {showCorrectedChrome ? "Corrected" : "Live Analysis"}
            </span>
          )}
        </div>
        <h2 className="mt-1 text-lg font-bold text-slate-900">
          Blueprint Inspection Canvas
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {showCorrectedChrome
            ? "Resolved geometry · emerald safe zones"
            : hasLiveResult
              ? `Synced overlay · ${openings} openings · ${columns} columns`
              : "Upload dual plans and run analysis to populate detections"}
        </p>
      </div>

      <div className="p-4 sm:p-5">
        <div
          ref={overlayRef}
          className="relative aspect-square w-full overflow-hidden rounded-xl border border-[#1E1E24]/20 bg-[#1E1E24] sm:aspect-[4/3]"
          role="img"
          aria-label="Architectural blueprint with AI detection overlays"
        >
          {blueprintImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={blueprintImageUrl}
              alt="Uploaded architectural blueprint"
              className="absolute inset-0 h-full w-full object-contain opacity-90"
            />
          ) : (
            <>
              <div
                className="absolute inset-0 opacity-40"
                style={
                  {
                    backgroundImage: `
                    linear-gradient(rgba(212,175,55,0.25) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(212,175,55,0.25) 1px, transparent 1px),
                    linear-gradient(rgba(212,175,55,0.08) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(212,175,55,0.08) 1px, transparent 1px)
                  `,
                    backgroundSize:
                      "24px 24px, 24px 24px, 120px 120px, 120px 120px",
                  } as CSSProperties
                }
              />
              <svg
                className="absolute inset-0 h-full w-full opacity-30"
                viewBox="0 0 400 300"
                preserveAspectRatio="none"
                aria-hidden
              >
                <rect
                  x="30"
                  y="25"
                  width="340"
                  height="250"
                  fill="none"
                  stroke="#D4AF37"
                  strokeWidth="1"
                />
                <line
                  x1="30"
                  y1="120"
                  x2="370"
                  y2="120"
                  stroke="#D4AF37"
                  strokeWidth="0.5"
                  strokeDasharray="4 4"
                />
                <line
                  x1="150"
                  y1="25"
                  x2="150"
                  y2="275"
                  stroke="#D4AF37"
                  strokeWidth="0.5"
                  strokeDasharray="4 4"
                />
              </svg>
            </>
          )}

          {blueprintImageUrl && (
            <div className="absolute inset-0 bg-[#1E1E24]/25" aria-hidden />
          )}

          {detections.map((box) => {
            const isHighlighted = highlightedDetectionId
              ? idsMatch(highlightedDetectionId, box.id)
              : false;
            const isResolved = Boolean(box.resolved);
            const clashWarning =
              viewMode === "original" && Boolean(box.clashWarning);
            const tx = box.translateX ?? 0;
            const ty = box.translateY ?? 0;

            return (
              <div
                key={box.id}
                className={cn(
                  "absolute transition-[transform,border-color,background-color,box-shadow] duration-700 ease-out",
                  boxStyles(
                    box.kind,
                    isHighlighted,
                    isResolved,
                    clashWarning,
                    box.wallType,
                    box.isAiGenerated
                  )
                )}
                style={{
                  top: box.top,
                  left: box.left,
                  width: box.width,
                  height: box.height,
                  transform: `translate(${tx}px, ${ty}px)`,
                }}
              >
                <span
                  className={cn(
                    "absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold shadow-sm",
                    labelStyles(
                      box.kind,
                      isResolved,
                      clashWarning,
                      box.wallType
                    )
                  )}
                >
                  {box.label} [{box.confidence}%]
                  {clashWarning ? " · Clash" : ""}
                  {isResolved ? " · Safe" : ""}
                  {box.isAiGenerated && !clashWarning && !isResolved
                    ? " · AI Planned"
                    : ""}
                  {box.wallType === "LOAD_BEARING" ? " · LB" : ""}
                  {box.wallType === "PARTITION" ? " · PT" : ""}
                </span>
                {box.isAiGenerated && box.kind === "column" && (
                  <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#D4AF37]/50 bg-[#1E1E24]/95 px-1.5 py-px text-[8px] font-bold uppercase tracking-wider text-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.35)]">
                    AI Planned
                  </span>
                )}
              </div>
            );
          })}

          {statusBanner && resolutionSuccess && viewMode !== "corrected" && (
            <div
              className="absolute left-3 right-3 top-3 z-20 flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-950/90 px-3.5 py-2.5 shadow-lg backdrop-blur-md"
              role="status"
            >
              <CheckCircle2
                className="h-4 w-4 shrink-0 text-emerald-400"
                aria-hidden
              />
              <p className="text-xs font-semibold leading-snug text-emerald-100 sm:text-sm">
                Clash Resolved Successfully!
              </p>
            </div>
          )}

          <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#1E1E24]/85 px-3 py-2 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-3 text-[10px]">
              {viewMode === "original" ? (
                <>
                  <span className="inline-flex items-center gap-1.5 text-red-300">
                    <span className="h-2 w-3 rounded-sm border-2 border-red-500 bg-red-500/30" />
                    Clash zone
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#D4AF37]">
                    <span className="h-2 w-3 rounded-sm border-2 border-dashed border-[#D4AF37]" />
                    Column
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#D4AF37]">
                    <span className="h-2 w-3 rounded-sm border-2 border-dashed border-[#D4AF37] bg-[#D4AF37]/40 shadow-[0_0_6px_rgba(212,175,55,0.5)]" />
                    AI Planned
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-emerald-300">
                  <span className="h-2 w-3 rounded-sm border-2 border-emerald-500 bg-emerald-500/30" />
                  AI-corrected safe
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold text-gold">
              {count} element{count === 1 ? "" : "s"} · {model}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
