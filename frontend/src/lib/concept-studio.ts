import { jsPDF } from "jspdf";
import type {
  ArchitecturalAudit,
  Blueprint3DPayload,
  DetectionBox,
} from "@/lib/clash-detection";

// ---------------------------------------------------------------------------
// Architectural style catalogue
// ---------------------------------------------------------------------------

export type ConceptStyleId =
  | "ultra-modern"
  | "tropical-eco"
  | "japandi"
  | "terracotta-farmhouse";

export type ConceptStyle = {
  id: ConceptStyleId;
  emoji: string;
  title: string;
  tabLabel: string;
  tagline: string;
  previewGradient: string;
  accent: string;
};

export const CONCEPT_STYLES: ConceptStyle[] = [
  {
    id: "ultra-modern",
    emoji: "🏢",
    title: "Ultra-Modern Luxury",
    tabLabel: "Ultra-Modern Luxury",
    tagline:
      "Floor-to-ceiling glass, polished concrete, floating slabs, warm LED glow",
    previewGradient:
      "linear-gradient(135deg, #0f172a 0%, #334155 40%, #94a3b8 70%, #fbbf24 100%)",
    accent: "#fbbf24",
  },
  {
    id: "tropical-eco",
    emoji: "🌿",
    title: "Tropical Eco-Villa",
    tabLabel: "Tropical Eco-Villa",
    tagline:
      "Rich teak wood, indoor courtyards, lush greenery, shaded louver pergolas",
    previewGradient:
      "linear-gradient(135deg, #14532d 0%, #166534 35%, #ca8a04 65%, #fef3c7 100%)",
    accent: "#22c55e",
  },
  {
    id: "japandi",
    emoji: "🏯",
    title: "Japandi Zen Minimalist",
    tabLabel: "Japandi Zen Minimalist",
    tagline:
      "Light oak timber, smooth white lime-plaster, organic textures, diffused daylight",
    previewGradient:
      "linear-gradient(135deg, #f8fafc 0%, #e7e5e4 45%, #d6d3d1 75%, #a8a29e 100%)",
    accent: "#78716c",
  },
  {
    id: "terracotta-farmhouse",
    emoji: "🏡",
    title: "Classic Heritage Farmhouse",
    tabLabel: "Classic Heritage Farmhouse",
    tagline:
      "Clay roof tiles, exposed brick accents, warm timber beams, cozy heritage aesthetic",
    previewGradient:
      "linear-gradient(135deg, #7c2d12 0%, #c2410c 35%, #f59e0b 65%, #fef3c7 100%)",
    accent: "#ea580c",
  },
];

export const GENERATION_STEPS = [
  "Analyzing blueprint geometry…",
  "Applying material shaders…",
  "Rendering lighting & atmospheric reflections…",
  "Finalizing 4K architectural composite…",
] as const;

export const AI_RENDER_METADATA =
  "✨ Live Generative AI • Pollinations Flux Diffusion • 4K Neural Architecture";

export type StudioViewMode = "bim" | "photorealistic" | "split";

// ---------------------------------------------------------------------------
// Blueprint feature matrix
// ---------------------------------------------------------------------------

const PLAN_WORLD_SPAN = 18;
const DEFAULT_SQFT = 1110;
const DEFAULT_ROOM_COUNT = 3;

const PORCH_LABEL_RE =
  /\b(porch|garage|car\s*porch|carport|car\s*park|driveway|veranda)\b/i;
const ROOM_LABEL_RE =
  /\b(bedroom|room|toilet|pantry|dining|sitting|living|kitchen|bath|hall|foyer|study)\b/i;
const BEDROOM_LABEL_RE = /\b(bedroom|bed\s*room)\b/i;

export type BlueprintFeatureMatrix = {
  hasCarPorch: boolean;
  roomCount: number;
  bedroomCount: number;
  sqft: number;
  projectCode: string;
};

/** Verified permanent HD architectural renders — 3 variations per style. */
export const STYLE_VARIATIONS: Record<string, string[]> = {
  modern: [
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80",
  ],
  tropical: [
    "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1600&q=80",
  ],
  japandi: [
    "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=80",
  ],
  farmhouse: [
    "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1576941089067-2de3c901e126?auto=format&fit=crop&w=1600&q=80",
  ],
};

/** Guaranteed fallback when any CDN request fails. */
export const FALLBACK_RENDER_URL = STYLE_VARIATIONS.modern[0];

const STYLE_ID_TO_POOL_KEY: Record<ConceptStyleId, keyof typeof STYLE_VARIATIONS> = {
  "ultra-modern": "modern",
  "tropical-eco": "tropical",
  japandi: "japandi",
  "terracotta-farmhouse": "farmhouse",
};

export function getStyleVariationPool(styleId: ConceptStyleId): string[] {
  const key = STYLE_ID_TO_POOL_KEY[styleId];
  return STYLE_VARIATIONS[key] ?? STYLE_VARIATIONS.modern;
}

function collectLabels(
  detections: DetectionBox[],
  blueprint3d?: Blueprint3DPayload | null
): string[] {
  const labels: string[] = [];
  for (const d of detections) labels.push(d.label);
  for (const d of blueprint3d?.architectural_detections ?? []) labels.push(d.label);
  for (const d of blueprint3d?.structural_detections ?? []) labels.push(d.label);
  return labels;
}

function detectCarPorch(
  labels: string[],
  blueprint3d?: Blueprint3DPayload | null
): boolean {
  if (labels.some((l) => PORCH_LABEL_RE.test(l) || /\bcar\b/i.test(l))) return true;
  if (blueprint3d?.house_bounds?.cutout) return true;
  return false;
}

function countBedrooms(labels: string[]): number {
  const bedrooms = labels.filter((l) => BEDROOM_LABEL_RE.test(l)).length;
  if (bedrooms > 0) return bedrooms;
  const numbered = labels.filter((l) => /bedroom\s*\d/i.test(l)).length;
  return numbered > 0 ? numbered : 0;
}

function countRooms(
  labels: string[],
  audit?: ArchitecturalAudit | null
): number {
  const auditRooms = audit?.crossVentilation?.rooms?.length ?? 0;
  if (auditRooms > 0) return auditRooms;

  const matched = labels.filter((l) => ROOM_LABEL_RE.test(l));
  const unique = new Set(matched.map((l) => l.toLowerCase().trim()));
  if (unique.size > 0) return unique.size;

  return DEFAULT_ROOM_COUNT;
}

function estimateSqft(
  blueprint3d?: Blueprint3DPayload | null,
  wallLengthFt?: number
): number {
  const bounds = blueprint3d?.house_bounds;
  if (bounds && bounds.width > 0 && bounds.height > 0) {
    const span = Math.max(bounds.width, bounds.height);
    const scale = PLAN_WORLD_SPAN / span;
    const widthM = bounds.width * scale;
    const depthM = bounds.height * scale;
    let areaSqM = widthM * depthM;

    if (bounds.cutout) {
      const cw = Math.max(0, bounds.cutout.max_x - bounds.cutout.min_x);
      const ch = Math.max(0, bounds.cutout.max_y - bounds.cutout.min_y);
      areaSqM = Math.max(areaSqM * 0.78, areaSqM - cw * ch * scale * scale * 0.55);
    } else {
      areaSqM *= 0.82;
    }

    const sqft = Math.round(areaSqM * 10.7639);
    if (sqft >= 600 && sqft <= 8000) return sqft;
  }

  if (wallLengthFt && wallLengthFt > 40) {
    const side = wallLengthFt / 4.2;
    return Math.round(Math.max(800, Math.min(4500, side * side * 0.88)));
  }

  return DEFAULT_SQFT;
}

export function extractBlueprintFeatures(opts: {
  detections?: DetectionBox[];
  blueprint3d?: Blueprint3DPayload | null;
  architecturalAudit?: ArchitecturalAudit | null;
  wallLengthFt?: number;
  projectName?: string | null;
}): BlueprintFeatureMatrix {
  const labels = collectLabels(opts.detections ?? [], opts.blueprint3d);
  const hasCarPorch = detectCarPorch(labels, opts.blueprint3d);
  const roomCount = countRooms(labels, opts.architecturalAudit);
  const bedroomCount = countBedrooms(labels) || Math.max(2, roomCount - 2);
  const sqft = estimateSqft(opts.blueprint3d, opts.wallLengthFt);
  const projectCode = opts.projectName?.trim() || "PRJ-001";

  return {
    hasCarPorch,
    roomCount,
    bedroomCount,
    sqft,
    projectCode,
  };
}

export function resolveAdaptiveRenderUrl(
  styleId: ConceptStyleId,
  features: BlueprintFeatureMatrix,
  variationIndex = 0
): string {
  const pool = getStyleVariationPool(styleId);
  const porchOffset = features.hasCarPorch ? 1 : 0;
  const idx = (variationIndex + porchOffset) % pool.length;
  return pool[idx] ?? FALLBACK_RENDER_URL;
}

export function deriveBlueprintSeed(
  features: BlueprintFeatureMatrix,
  styleId: ConceptStyleId
): number {
  const raw = [
    features.projectCode,
    styleId,
    features.sqft,
    features.roomCount,
    features.hasCarPorch ? "porch" : "garden",
  ].join("|");
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 999_999_999;
}

export function randomGenerationSeed(): number {
  return Math.floor(Math.random() * 999_999_999);
}

export function synthesizeGenerationPrompt(
  style: ConceptStyle,
  features: BlueprintFeatureMatrix
): string {
  const porchPhrase = features.hasCarPorch
    ? "car porch on right side"
    : "front garden";
  const sqft = features.sqft || 1500;
  const project = features.projectCode || "PRJ001";

  return `photorealistic 4k architectural photography of a luxury modern ${style.title} house exterior, designed from blueprint ${project}, ${sqft} sqft, ${porchPhrase}, floor to ceiling glass windows, sunset warm lighting, architectural digest masterpiece, 8k resolution, octane render`;
}

/** Pollinations.ai real-time Flux diffusion endpoint (zero-config). */
export function buildPollinationsImageUrl(prompt: string, seed: number): string {
  const encodedPrompt = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1600&height=1000&seed=${Math.floor(seed)}&model=flux&nologo=true`;
}

export function buildGenerativeRenderRequest(
  style: ConceptStyle,
  features: BlueprintFeatureMatrix,
  seed: number
): { prompt: string; url: string } {
  const prompt = synthesizeGenerationPrompt(style, features);
  return { prompt, url: buildPollinationsImageUrl(prompt, seed) };
}

export function formatSeedMetadata(seed: number): string {
  return `Seed: #${Math.floor(seed)} • Engine: Pollinations Flux • Neural Diffusion Cloud • 1600×1000`;
}

// ---------------------------------------------------------------------------
// Photorealistic render helpers
// ---------------------------------------------------------------------------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Preload adaptive HD photograph; returns fallback URL on any failure. */
export async function generateConceptRender(renderUrl: string): Promise<string> {
  try {
    await loadImage(renderUrl);
    return renderUrl;
  } catch {
    try {
      await loadImage(FALLBACK_RENDER_URL);
    } catch {
      /* last-resort — FALLBACK_RENDER_URL is still returned for <img onError> */
    }
    return FALLBACK_RENDER_URL;
  }
}

export async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    try {
      const img = await loadImage(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 1600;
      canvas.height = img.naturalHeight || 900;
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.92);
    } catch {
      return null;
    }
  }
}

export async function downloadConceptRender(
  renderUrl: string,
  styleTitle: string
): Promise<void> {
  const dataUrl = await imageUrlToDataUrl(renderUrl);
  const href = dataUrl ?? renderUrl;
  const a = document.createElement("a");
  a.href = href;
  a.download = `4K_Concept_${styleTitle.replace(/\s+/g, "_")}.jpg`;
  if (!dataUrl) a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function captureElementSnapshot(selector: string): string | null {
  if (typeof document === "undefined") return null;
  const canvas = document.querySelector<HTMLCanvasElement>(`${selector} canvas`);
  if (!canvas) return null;
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export async function exportPresentationBoard(opts: {
  projectName: string;
  location?: string;
  styleTitle: string;
  floorPlanDataUrl: string | null;
  bimSnapshotDataUrl: string | null;
  renderDataUrl: string;
  wallCount: number;
  elementsDetected: number;
  wallLengthFt?: number;
}): Promise<void> {
  let renderData = opts.renderDataUrl;
  if (!renderData.startsWith("data:")) {
    renderData = (await imageUrlToDataUrl(opts.renderDataUrl)) ?? opts.renderDataUrl;
  }

  const doc = new jsPDF({ unit: "pt", format: "a3", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  const gold: [number, number, number] = [212, 175, 55];

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, pageH, "F");

  doc.setFillColor(...gold);
  doc.rect(0, 0, pageW, 6, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Architectural Concept Presentation Board", margin, 40);

  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  doc.text(opts.projectName || "Untitled Project", margin, 58);
  doc.text(
    `${opts.location ?? "Site TBD"} · ${new Date().toLocaleDateString()} · ${opts.styleTitle}`,
    margin,
    72
  );

  doc.setTextColor(...gold);
  doc.text(
    `${opts.wallCount} walls · ${opts.elementsDetected} elements · ${opts.wallLengthFt ? `${opts.wallLengthFt.toLocaleString()} ft` : "—"} linear`,
    margin,
    86
  );

  const gridTop = 100;
  const cellW = (pageW - margin * 2 - 12) / 2;
  const cellH = (pageH - gridTop - margin - 12) / 2;

  const slots: Array<{ label: string; data: string | null; x: number; y: number }> = [
    { label: "2D Floor Plan", data: opts.floorPlanDataUrl, x: margin, y: gridTop },
    {
      label: "3D BIM Engineering View",
      data: opts.bimSnapshotDataUrl,
      x: margin + cellW + 12,
      y: gridTop,
    },
    {
      label: "4K AI Photorealistic Concept",
      data: renderData.startsWith("data:") ? renderData : null,
      x: margin,
      y: gridTop + cellH + 12,
    },
    { label: "Project Metadata", data: null, x: margin + cellW + 12, y: gridTop + cellH + 12 },
  ];

  for (const slot of slots) {
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.5);
    doc.roundedRect(slot.x, slot.y, cellW, cellH, 6, 6, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...gold);
    doc.text(slot.label.toUpperCase(), slot.x + 12, slot.y + 18);

    if (slot.label === "Project Metadata") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(220, 220, 220);
      const lines = [
        `Style: ${opts.styleTitle}`,
        `Walls detected: ${opts.wallCount}`,
        `Openings & columns: ${opts.elementsDetected}`,
        `Wall length: ${opts.wallLengthFt ? `${opts.wallLengthFt} ft` : "N/A"}`,
        "",
        "Generated by Construction AI",
        "Blueprint Parser · Concept Studio",
      ];
      lines.forEach((line, i) => doc.text(line, slot.x + 12, slot.y + 40 + i * 16));
    } else if (slot.data) {
      try {
        const fmt = slot.data.startsWith("data:image/png") ? "PNG" : "JPEG";
        doc.addImage(slot.data, fmt, slot.x + 8, slot.y + 24, cellW - 16, cellH - 32);
      } catch {
        doc.setTextColor(150, 150, 150);
        doc.text("Image unavailable", slot.x + 12, slot.y + 50);
      }
    } else {
      doc.setTextColor(120, 120, 120);
      doc.text("No image captured", slot.x + 12, slot.y + 50);
    }
  }

  doc.save(
    `Concept_Board_${opts.projectName.replace(/\s+/g, "_") || "Project"}.pdf`
  );
}

export function simulateGenerationSteps(
  onStep: (index: number) => void,
  onComplete: () => void,
  stepMs = 900
): () => void {
  let step = 0;
  onStep(0);
  const id = window.setInterval(() => {
    step += 1;
    if (step >= GENERATION_STEPS.length) {
      window.clearInterval(id);
      onComplete();
      return;
    }
    onStep(step);
  }, stepMs);
  return () => window.clearInterval(id);
}
