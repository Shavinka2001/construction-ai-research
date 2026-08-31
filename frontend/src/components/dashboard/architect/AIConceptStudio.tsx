"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Download,
  Layers,
  Box,
  ImageIcon,
  X,
  Check,
  Loader2,
  Terminal,
} from "lucide-react";
import type {
  ArchitecturalAudit,
  Blueprint3DPayload,
  DetectionBox,
} from "@/lib/clash-detection";
import {
  AI_RENDER_METADATA,
  CONCEPT_STYLES,
  buildGenerativeRenderRequest,
  buildPollinationsImageUrl,
  deriveBlueprintSeed,
  downloadConceptRender,
  exportPresentationBoard,
  extractBlueprintFeatures,
  FALLBACK_RENDER_URL,
  formatSeedMetadata,
  randomGenerationSeed,
  synthesizeGenerationPrompt,
  type BlueprintFeatureMatrix,
  type ConceptStyle,
  type ConceptStyleId,
  type StudioViewMode,
  captureElementSnapshot,
} from "@/lib/concept-studio";
import { cn } from "@/lib/utils";

const VIEWPORT_CAPTURE_SELECTOR = "[data-bim-viewport]";

export type AIConceptStudioProps = {
  projectName?: string | null;
  projectLocation?: string | null;
  blueprintImageUrl?: string | null;
  blueprint3d?: Blueprint3DPayload | null;
  detections?: DetectionBox[];
  architecturalAudit?: ArchitecturalAudit | null;
  hasLiveResult: boolean;
  wallCount?: number;
  elementsDetected?: number;
  wallLengthFt?: number;
  bimViewport: React.ReactNode;
  className?: string;
};

export function AIConceptStudio({
  projectName,
  projectLocation,
  blueprintImageUrl,
  blueprint3d,
  detections = [],
  architecturalAudit,
  hasLiveResult,
  wallCount = 0,
  elementsDetected = 0,
  wallLengthFt = 0,
  bimViewport,
  className,
}: AIConceptStudioProps) {
  const [studioOpen, setStudioOpen] = useState(true);
  const [selectedStyleId, setSelectedStyleId] = useState<ConceptStyleId>("ultra-modern");
  const [viewMode, setViewMode] = useState<StudioViewMode>("bim");
  const [studioActive, setStudioActive] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [bimSnapshotUrl, setBimSnapshotUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [seed, setSeed] = useState(0);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const features = useMemo(
    () =>
      extractBlueprintFeatures({
        detections,
        blueprint3d,
        architecturalAudit,
        wallLengthFt,
        projectName,
      }),
    [architecturalAudit, blueprint3d, detections, projectName, wallLengthFt]
  );

  const selectedStyle = useMemo(
    () => CONCEPT_STYLES.find((s) => s.id === selectedStyleId) ?? CONCEPT_STYLES[0],
    [selectedStyleId]
  );

  const aiPrompt = useMemo(
    () => synthesizeGenerationPrompt(selectedStyle, features),
    [features, selectedStyle]
  );

  const seedMetadata = useMemo(() => formatSeedMetadata(seed), [seed]);

  const activeRenderUrl = generatedImageUrl ?? "";

  useEffect(() => {
    setSeed(deriveBlueprintSeed(features, selectedStyleId));
  }, [features, selectedStyleId]);

  useEffect(() => {
    setGeneratedImageUrl(null);
    setStudioActive(false);
  }, [features]);

  const startLiveGeneration = useCallback(
    (style: ConceptStyle, styleId: ConceptStyleId, nextSeed: number) => {
      const { url } = buildGenerativeRenderRequest(style, features, nextSeed);
      setSeed(nextSeed);
      setIsGenerating(true);
      setGeneratedImageUrl(url);
      return url;
    },
    [features]
  );

  const canGenerate = hasLiveResult && Boolean(blueprint3d?.walls?.length);

  const handleGenerate = useCallback(() => {
    if (!canGenerate || isGenerating) return;
    const snap = captureElementSnapshot(VIEWPORT_CAPTURE_SELECTOR);
    if (snap) setBimSnapshotUrl(snap);
    startLiveGeneration(selectedStyle, selectedStyleId, seed);
    setStudioActive(true);
    setViewMode("photorealistic");
  }, [canGenerate, isGenerating, seed, selectedStyle, selectedStyleId, startLiveGeneration]);

  const handleRegenerate = useCallback(() => {
    if (isGenerating) return;
    startLiveGeneration(selectedStyle, selectedStyleId, randomGenerationSeed());
  }, [isGenerating, selectedStyle, selectedStyleId, startLiveGeneration]);

  const handleStyleSelect = useCallback(
    (id: ConceptStyleId) => {
      if (id === selectedStyleId) return;
      setSelectedStyleId(id);
      if (!studioActive) return;
      const style = CONCEPT_STYLES.find((s) => s.id === id) ?? CONCEPT_STYLES[0];
      startLiveGeneration(style, id, deriveBlueprintSeed(features, id));
    },
    [features, selectedStyleId, startLiveGeneration, studioActive]
  );

  const handleImageLoaded = useCallback(() => {
    setIsGenerating(false);
  }, []);

  useEffect(() => {
    if (!isGenerating) return;
    const timer = window.setTimeout(() => setIsGenerating(false), 90_000);
    return () => clearTimeout(timer);
  }, [isGenerating]);

  const handleExportBoard = useCallback(async () => {
    if (!studioActive) return;
    setExporting(true);
    try {
      let floorPlanDataUrl: string | null = null;
      if (blueprintImageUrl) {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = blueprintImageUrl;
          });
          const c = document.createElement("canvas");
          c.width = img.naturalWidth || 800;
          c.height = img.naturalHeight || 800;
          c.getContext("2d")?.drawImage(img, 0, 0);
          floorPlanDataUrl = c.toDataURL("image/jpeg", 0.85);
        } catch {
          floorPlanDataUrl = null;
        }
      }

      const bimSnapshot =
        bimSnapshotUrl ?? captureElementSnapshot(VIEWPORT_CAPTURE_SELECTOR);

      await exportPresentationBoard({
        projectName: projectName ?? "Blueprint Project",
        location: projectLocation ?? undefined,
        styleTitle: selectedStyle.title,
        floorPlanDataUrl,
        bimSnapshotDataUrl: bimSnapshot,
        renderDataUrl: generatedImageUrl ?? buildPollinationsImageUrl(aiPrompt, seed),
        wallCount,
        elementsDetected,
        wallLengthFt,
      });
    } finally {
      setExporting(false);
    }
  }, [
    generatedImageUrl,
    aiPrompt,
    seed,
    blueprintImageUrl,
    bimSnapshotUrl,
    elementsDetected,
    projectLocation,
    projectName,
    selectedStyle.title,
    studioActive,
    wallCount,
    wallLengthFt,
  ]);

  const handleDownloadRender = useCallback(async () => {
    if (!generatedImageUrl) return;
    setDownloading(true);
    try {
      await downloadConceptRender(generatedImageUrl, selectedStyle.title);
    } finally {
      setDownloading(false);
    }
  }, [generatedImageUrl, selectedStyle.title]);

  const openCompare = useCallback(() => {
    const snap = captureElementSnapshot(VIEWPORT_CAPTURE_SELECTOR);
    if (snap) setBimSnapshotUrl(snap);
    setCompareOpen(true);
  }, []);

  const showBim = viewMode === "bim" || viewMode === "split";
  const showPhoto = viewMode === "photorealistic" || viewMode === "split";

  return (
    <div className={cn("space-y-4", className)}>
      <div className="overflow-hidden rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-luxury-lg">
        <button
          type="button"
          onClick={() => setStudioOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-amber-600 shadow-lg shadow-amber-900/40">
              <Sparkles className="h-5 w-5 text-slate-950" aria-hidden />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight text-white sm:text-base">
                  AI Concept Studio
                </h3>
                <span className="inline-flex items-center rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">
                  Photorealistic Reality
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Live Pollinations Flux diffusion · blueprint-driven prompts
              </p>
            </div>
          </div>
          {studioOpen ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
          )}
        </button>

        {studioOpen && (
          <div className="border-t border-white/10 px-5 pb-5 pt-4">
            {canGenerate && (
              <FeatureMatrixStrip features={features} className="mb-4" />
            )}

            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Architectural Style
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {CONCEPT_STYLES.map((style) => (
                <StyleCard
                  key={style.id}
                  style={style}
                  selected={selectedStyleId === style.id}
                  onSelect={() => handleStyleSelect(style.id)}
                />
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!canGenerate || isGenerating}
                onClick={handleGenerate}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-lg transition-all",
                  canGenerate && !isGenerating
                    ? "bg-gradient-to-r from-[#D4AF37] to-amber-500 text-slate-950 hover:brightness-110"
                    : "cursor-not-allowed bg-slate-700 text-slate-400"
                )}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate 4K AI Architectural Render
              </button>

              {studioActive && (
                <>
                  <button
                    type="button"
                    onClick={openCompare}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Compare BIM ⟷ Reality
                  </button>
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={() => void handleExportBoard()}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-2.5 text-xs font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/20 disabled:opacity-50"
                  >
                    {exporting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Export Presentation Board
                  </button>
                </>
              )}
            </div>

            {!canGenerate && (
              <p className="mt-3 text-xs text-slate-500">
                Run blueprint analysis first to unlock adaptive AI photorealistic staging.
              </p>
            )}
          </div>
        )}
      </div>

      <div
        role="tablist"
        aria-label="BIM vs photorealistic view"
        className="inline-flex w-full flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 sm:w-auto"
      >
        <ViewTab
          active={viewMode === "bim"}
          onClick={() => setViewMode("bim")}
          icon={<Box className="h-3.5 w-3.5" />}
          label="3D Engineering BIM"
        />
        <ViewTab
          active={viewMode === "photorealistic"}
          onClick={() => setViewMode("photorealistic")}
          icon={<ImageIcon className="h-3.5 w-3.5 text-[#D4AF37]" />}
          label="4K Photorealistic Reality"
          disabled={!studioActive && !isGenerating}
        />
        <ViewTab
          active={viewMode === "split"}
          onClick={() => setViewMode("split")}
          icon={<Layers className="h-3.5 w-3.5" />}
          label="Split View"
          disabled={!studioActive}
        />
      </div>

      <div
        className={cn(
          "relative min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-inner",
          viewMode === "split" ? "grid gap-0 lg:grid-cols-2" : ""
        )}
      >
        {showBim && (
          <div
            data-bim-viewport
            className={cn(
              "relative min-h-[420px]",
              viewMode === "split" ? "border-b border-slate-800 lg:border-b-0 lg:border-r" : ""
            )}
          >
            <ViewportBadge label="📐 3D Engineering BIM View" />
            <div className="h-full">{bimViewport}</div>
          </div>
        )}

        {showPhoto && (
          <PhotorealisticStudioPanel
            style={selectedStyle}
            features={features}
            selectedStyleId={selectedStyleId}
            onStyleSelect={handleStyleSelect}
            renderUrl={activeRenderUrl}
            studioActive={studioActive}
            isGenerating={isGenerating}
            downloading={downloading}
            aiPrompt={aiPrompt}
            seedMetadata={seedMetadata}
            seed={seed}
            onImageLoaded={handleImageLoaded}
            onDownload={() => void handleDownloadRender()}
            onRegenerate={handleRegenerate}
            showPromptTerminal={canGenerate}
          />
        )}
      </div>

      {compareOpen && studioActive && generatedImageUrl && (
        <CompareModal
          bimSnapshotUrl={bimSnapshotUrl}
          renderUrl={generatedImageUrl}
          styleTitle={selectedStyle.title}
          prompt={aiPrompt}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  );
}

function FeatureMatrixStrip({
  features,
  className,
}: {
  features: BlueprintFeatureMatrix;
  className?: string;
}) {
  const items = [
    {
      label: "Car Porch",
      value: features.hasCarPorch ? "Detected" : "Not detected",
      active: features.hasCarPorch,
    },
    { label: "Rooms", value: String(features.roomCount), active: true },
    { label: "Bedrooms", value: String(features.bedroomCount), active: true },
    { label: "Est. Area", value: `${features.sqft.toLocaleString()} sq.ft`, active: true },
    { label: "Blueprint", value: features.projectCode, active: true },
  ];

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2",
        className
      )}
    >
      {items.map((item) => (
        <span
          key={item.label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold",
            item.active
              ? "bg-[#D4AF37]/15 text-[#D4AF37]"
              : "bg-slate-800/80 text-slate-500"
          )}
        >
          <span className="uppercase tracking-wider text-slate-500">{item.label}</span>
          <span className="text-white">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

function PhotorealisticStudioPanel({
  style,
  features,
  selectedStyleId,
  onStyleSelect,
  renderUrl,
  studioActive,
  isGenerating,
  downloading,
  aiPrompt,
  seedMetadata,
  seed,
  onImageLoaded,
  onDownload,
  onRegenerate,
  showPromptTerminal,
}: {
  style: ConceptStyle;
  features: BlueprintFeatureMatrix;
  selectedStyleId: ConceptStyleId;
  onStyleSelect: (id: ConceptStyleId) => void;
  renderUrl: string;
  studioActive: boolean;
  isGenerating: boolean;
  downloading: boolean;
  aiPrompt: string;
  seedMetadata: string;
  seed: number;
  onImageLoaded: () => void;
  onDownload: () => void;
  onRegenerate: () => void;
  showPromptTerminal: boolean;
}) {
  const showImage = studioActive && Boolean(renderUrl);

  return (
    <div className="flex min-h-[420px] flex-col bg-slate-950">
      <div
        role="tablist"
        aria-label="Photorealistic architectural style"
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 bg-slate-900/90 p-2 backdrop-blur-md"
      >
        {CONCEPT_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={selectedStyleId === s.id}
            onClick={() => onStyleSelect(s.id)}
            disabled={isGenerating}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold transition-all sm:text-[11px]",
              selectedStyleId === s.id
                ? "bg-gradient-to-r from-[#D4AF37]/20 to-amber-500/10 text-[#D4AF37] ring-1 ring-[#D4AF37]/50"
                : "text-slate-400 hover:bg-white/5 hover:text-white",
              isGenerating && "cursor-wait opacity-70"
            )}
          >
            <span aria-hidden>{s.emoji}</span>
            <span className="whitespace-nowrap">{s.tabLabel}</span>
          </button>
        ))}
      </div>

      <div className="relative min-h-[320px] flex-1 overflow-hidden">
        <ViewportBadge label="✨ 4K Live AI Generation" gold />

        {!showImage && (
          <div
            className="absolute inset-0"
            style={{ background: style.previewGradient }}
            aria-hidden
          />
        )}

        {showImage && (
          <ConceptRenderImage
            src={renderUrl}
            alt={`${style.title} AI-generated architectural concept`}
            onLoad={onImageLoaded}
            className="absolute inset-0 h-full w-full"
            imageClassName={cn(
              "h-full w-full object-cover transition-opacity duration-500",
              isGenerating ? "opacity-0" : "opacity-100"
            )}
          />
        )}

        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-slate-950/25"
          aria-hidden
        />

        {isGenerating && <NeuralDiffusionLoader seed={seed} />}

        {!studioActive && !isGenerating && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center">
            <Sparkles className="h-10 w-10 text-[#D4AF37]/80" />
            <p className="mt-4 max-w-xs text-sm font-semibold text-white">
              Generate a live AI architectural concept from your blueprint
            </p>
            <p className="mt-2 text-xs text-slate-300">
              {features.hasCarPorch ? "Car porch layout detected" : "Garden frontage layout"} ·{" "}
              {features.sqft.toLocaleString()} sq.ft · Pollinations Flux
            </p>
          </div>
        )}

        {studioActive && !isGenerating && showImage && (
          <>
            <div className="absolute bottom-4 left-4 z-20 max-w-[min(100%-2rem,28rem)] rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 shadow-2xl backdrop-blur-xl">
              <p className="text-[10px] font-semibold leading-relaxed tracking-wide text-white/95 sm:text-[11px]">
                {AI_RENDER_METADATA}
              </p>
            </div>

            <button
              type="button"
              onClick={onDownload}
              disabled={downloading}
              className="absolute bottom-4 right-4 z-20 inline-flex items-center gap-2 rounded-xl border border-white/25 bg-slate-900/70 px-4 py-2.5 text-[11px] font-bold text-white shadow-2xl backdrop-blur-xl transition-all hover:bg-slate-800/90 disabled:opacity-60"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span aria-hidden>⬇️</span>
              )}
              Download 4K Concept Render
            </button>
          </>
        )}
      </div>

      {showPromptTerminal && (
        <PromptTerminal
          prompt={aiPrompt}
          seedMetadata={seedMetadata}
          studioActive={studioActive}
          isGenerating={isGenerating}
          onRegenerate={onRegenerate}
        />
      )}
    </div>
  );
}

function ConceptRenderImage({
  src,
  alt,
  className,
  imageClassName,
  onLoad,
}: {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  onLoad?: () => void;
}) {
  const [displaySrc, setDisplaySrc] = useState(src);
  const usedFallbackRef = useRef(false);

  useEffect(() => {
    setDisplaySrc(src);
    usedFallbackRef.current = false;
  }, [src]);

  const handleError = () => {
    if (!usedFallbackRef.current && displaySrc !== FALLBACK_RENDER_URL) {
      usedFallbackRef.current = true;
      setDisplaySrc(FALLBACK_RENDER_URL);
    }
  };

  const handleLoad = () => {
    onLoad?.();
  };

  return (
    <div className={className}>
      <img
        src={displaySrc}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        className={cn("h-full w-full object-cover", imageClassName)}
      />
    </div>
  );
}

function NeuralDiffusionLoader({ seed }: { seed: number }) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label="Generating AI architectural render"
    >
      <div className="mx-4 max-w-md rounded-2xl border border-white/20 bg-white/10 px-8 py-6 text-center shadow-2xl backdrop-blur-xl">
        <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#D4AF37]" />
        <p className="mt-4 text-sm font-semibold text-white">
          Connecting to Neural Diffusion Cloud...
        </p>
        <p className="mt-2 text-xs font-medium text-[#D4AF37]">
          Synthesizing 4K Architecture with Seed #{Math.floor(seed)}
        </p>
      </div>
    </div>
  );
}

function PromptTerminal({
  prompt,
  seedMetadata,
  studioActive,
  isGenerating,
  onRegenerate,
}: {
  prompt: string;
  seedMetadata: string;
  studioActive: boolean;
  isGenerating: boolean;
  onRegenerate: () => void;
}) {
  return (
    <div className="border-t border-white/10 bg-slate-950/95 p-4 backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-2">
        <Terminal className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          Live AI Prompt · Pollinations Flux Engine
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/80 p-4 shadow-inner backdrop-blur-md">
        <p className="font-mono text-[11px] leading-relaxed text-emerald-300/95 sm:text-xs">
          &quot;{prompt}&quot;
        </p>
        <p className="mt-3 font-mono text-[10px] text-slate-400 sm:text-[11px]">{seedMetadata}</p>
      </div>

      {studioActive && (
        <button
          type="button"
          disabled={isGenerating}
          onClick={onRegenerate}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-2.5 text-xs font-bold text-[#D4AF37] transition-all hover:bg-[#D4AF37]/20 disabled:opacity-50 sm:w-auto"
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          ✨ Regenerate Concept (New AI Seed)
        </button>
      )}
    </div>
  );
}

function StyleCard({
  style,
  selected,
  onSelect,
}: {
  style: ConceptStyle;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative overflow-hidden rounded-xl border text-left transition-all",
        selected
          ? "border-[#D4AF37] ring-2 ring-[#D4AF37]/40"
          : "border-white/10 hover:border-white/25"
      )}
    >
      <div
        className="relative h-20 w-full overflow-hidden"
        style={{ background: style.previewGradient }}
        aria-hidden
      >
        <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-80">
          {style.emoji}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
      </div>
      <div className="bg-slate-900/90 p-3 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-2">
          <span className="text-lg" aria-hidden>
            {style.emoji}
          </span>
          {selected && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#D4AF37]">
              <Check className="h-3 w-3 text-slate-950" />
            </span>
          )}
        </div>
        <p className="mt-1 text-xs font-bold text-white">{style.title}</p>
        <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-400">
          {style.tagline}
        </p>
      </div>
    </button>
  );
}

function ViewTab({
  active,
  onClick,
  icon,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold transition-all sm:flex-none sm:px-4",
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ViewportBadge({ label, gold }: { label: string; gold?: boolean }) {
  return (
    <span
      className={cn(
        "absolute left-3 top-3 z-10 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-lg backdrop-blur-sm",
        gold
          ? "border border-[#D4AF37]/40 bg-slate-900/80 text-[#D4AF37]"
          : "border border-slate-600 bg-slate-900/80 text-slate-300"
      )}
    >
      {label}
    </span>
  );
}

function CompareModal({
  bimSnapshotUrl,
  renderUrl,
  styleTitle,
  prompt,
  onClose,
}: {
  bimSnapshotUrl: string | null;
  renderUrl: string;
  styleTitle: string;
  prompt: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal
      aria-label="BIM vs photorealistic comparison"
    >
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#D4AF37]/30 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-white">BIM ⟷ Photorealistic Inspection</h2>
            <p className="text-xs text-slate-400">{styleTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Close comparison"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid flex-1 gap-0 overflow-hidden lg:grid-cols-2">
          <div className="relative min-h-[300px] border-b border-white/10 bg-slate-950 lg:border-b-0 lg:border-r">
            <ViewportBadge label="📐 Engineering BIM" />
            {bimSnapshotUrl ? (
              <img
                src={bimSnapshotUrl}
                alt="BIM model snapshot"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full min-h-[300px] items-center justify-center text-xs text-slate-500">
                BIM snapshot unavailable — switch to BIM view and regenerate
              </div>
            )}
          </div>
          <div className="relative min-h-[300px]">
            <ViewportBadge label="✨ 4K Concept" gold />
            <ConceptRenderImage
              src={renderUrl}
              alt="Concept render"
              className="h-full min-h-[300px] w-full"
              imageClassName="h-full w-full object-cover"
            />
            <div className="absolute bottom-3 left-3 max-w-[90%] rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-xl">
              <p className="text-[9px] font-semibold text-white/90">{AI_RENDER_METADATA}</p>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-5 py-3">
          <p className="font-mono text-[10px] leading-relaxed text-emerald-300/90">
            &quot;{prompt}&quot;
          </p>
        </div>
      </div>
    </div>
  );
}

export default AIConceptStudio;
