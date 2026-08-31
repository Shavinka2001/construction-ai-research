"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Eye, Footprints, Moon, Sun, X } from "lucide-react";
import type { DetectionBox } from "@/lib/clash-detection";
import {
  MIN_WALL_RUN_M,
  anchorOpeningToRun,
  boundsFromRuns,
  buildOrthogonalLayout,
  collectWallJunctions,
  exteriorRunIndices,
  findCornerCutout,
  gapSpans,
  mergeSpans,
  runLength,
  trimRunsAgainstCutout,
  type CornerCutout,
  type Span,
  type WallBounds,
  type WallRun,
} from "@/lib/wall-runs";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MaquetteViewMode = "original" | "corrected";

export type BlueprintWall = {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  thickness?: number;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  start_x?: number;
  start_y?: number;
  end_x?: number;
  end_y?: number;
};

export type BlueprintDetection = {
  id?: string;
  label?: string;
  class_name?: string;
  kind?: string;
  bbox?: number[];
  top?: string | number;
  left?: string | number;
  width?: string | number;
  height?: string | number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  ymin?: number;
  xmin?: number;
  ymax?: number;
  xmax?: number;
  confidence?: number | string;
  segment?: { x1: number; y1: number; x2: number; y2: number };
};

/** Pixel footprint of the building with the drawing-sheet frame excluded. */
export type HouseBounds = {
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
  center_x?: number;
  center_y?: number;
  width?: number;
  height?: number;
  cutout?: {
    min_x: number;
    min_y: number;
    max_x: number;
    max_y: number;
    corner?: string;
  } | null;
};

export type Blueprint3DData = {
  image_width?: number;
  image_height?: number;
  walls?: BlueprintWall[];
  architectural_detections?: BlueprintDetection[];
  structural_detections?: BlueprintDetection[];
  house_bounds?: HouseBounds | null;
};

export interface FloorPlan3DViewportProps {
  data?: Blueprint3DData | Record<string, unknown> | null;
  detections?: DetectionBox[];
  recommendations?: unknown[];
  architecturalAudit?: unknown;
  viewMode?: MaquetteViewMode;
  hasLiveResult?: boolean;
  className?: string;
  projectName?: string | null;
  modelUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Architectural constants
// ---------------------------------------------------------------------------

const WALL_HEIGHT = 2.6;
/** Dark trim cap along the top face of every wall (dollhouse view). */
const WALL_CAP_HEIGHT = 0.045;
/** Uniform masonry depth for a clean architectural read. */
const WALL_DEPTH_M = 0.22;
/** Lowest roof edge — sits just above wall tops so eaves never cover walls. */
const EAVE_Y = WALL_HEIGHT + 0.05;
const RIDGE_Y = WALL_HEIGHT + 1.75;
const EAVE_OVERHANG = 0.4;
const DOOR_OPEN_ANGLE = (30 * Math.PI) / 180;
const EYE_LEVEL = 1.62;
const SLAB_PAD = 0.8;

// Door assembly: the leaf plus its jambs define how wide a hole the masonry
// needs, so the frame always lands inside a real opening.
const DOOR_LEAF_W = 0.95;
const DOOR_LEAF_H = 2.15;
const DOOR_JAMB_THICK = 0.1;
const DOOR_OPENING_W = DOOR_LEAF_W + DOOR_JAMB_THICK * 2;
const DOOR_HEAD_Y = DOOR_LEAF_H + DOOR_JAMB_THICK * 2;
/** Centre height of a window opening above the floor. */
const WINDOW_CENTER_Y = 1.55;
/** Reveal left around a frame so masonry never Z-fights the joinery. */
const OPENING_CUT_PAD = 0.09;
/** NMS radius — duplicate detections within this plan distance merge to one opening. */
const OPENING_NMS_PX = 40;
const OPENING_NMS_M = 0.8;

// ---------------------------------------------------------------------------
// Lifecycle helpers
// ---------------------------------------------------------------------------

function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => m?.dispose());
    } else if (obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
      obj.geometry?.dispose();
      (obj.material as THREE.Material)?.dispose();
    }
  });
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

type HouseMaterials = {
  wall: THREE.MeshStandardMaterial;
  wallCap: THREE.MeshStandardMaterial;
  edge: THREE.LineBasicMaterial;
  roof: THREE.MeshStandardMaterial;
  roofEdge: THREE.LineBasicMaterial;
  glass: THREE.MeshPhysicalMaterial;
  glassGlow: THREE.MeshBasicMaterial;
  frame: THREE.MeshStandardMaterial;
  sill: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  woodPanel: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  column: THREE.MeshStandardMaterial;
  slab: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial;
};

function createHouseMaterials(): HouseMaterials {
  return {
    wall: new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.88,
      metalness: 0.0,
    }),
    wallCap: new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.42,
      metalness: 0.05,
    }),
    edge: new THREE.LineBasicMaterial({ color: 0x94a3b8 }),
    roof: new THREE.MeshStandardMaterial({
      color: 0x9a3412,
      roughness: 0.65,
      metalness: 0.1,
      side: THREE.DoubleSide,
    }),
    roofEdge: new THREE.LineBasicMaterial({ color: 0x78716c }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      emissive: 0x0284c7,
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0.65,
      roughness: 0.08,
      metalness: 0.1,
      transmission: 0.6,
      ior: 1.5,
      thickness: 0.04,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    glassGlow: new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    frame: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 }),
    sill: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.45 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.52 }),
    woodPanel: new THREE.MeshStandardMaterial({ color: 0x5c3a0a, roughness: 0.62 }),
    brass: new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.9,
      roughness: 0.2,
    }),
    column: new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.4,
      metalness: 0.35,
    }),
    slab: new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 }),
  };
}

function disposeMaterials(m: HouseMaterials) {
  Object.values(m).forEach((mat) => mat.dispose());
}

// ---------------------------------------------------------------------------
// Blueprint coordinate / detection helpers
// ---------------------------------------------------------------------------

type CoordMap = {
  imgW: number;
  imgH: number;
  scale: number;
  toX: (px: number) => number;
  toZ: (py: number) => number;
};

type PixelBounds = { minX: number; minY: number; maxX: number; maxY: number };

/** Longest world-space dimension the plan is fitted into, in metres. */
const PLAN_WORLD_SPAN = 18;
/**
 * A footprint smaller than this fraction of the canvas is treated as a bad
 * measurement (stray stroke) and we fall back to the full image.
 */
const MIN_HOUSE_SPAN_RATIO = 0.08;

/** True pixel footprint of the house from its wall centrelines. */
function pixelBoundsFromWalls(walls: BlueprintWall[] | undefined): PixelBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const wall of walls ?? []) {
    const seg = wallEndpoints(wall);
    if (!seg) continue;
    minX = Math.min(minX, seg.x1, seg.x2);
    maxX = Math.max(maxX, seg.x1, seg.x2);
    minY = Math.min(minY, seg.y1, seg.y2);
    maxY = Math.max(maxY, seg.y1, seg.y2);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { minX, minY, maxX, maxY };
}

function houseBoundsToPixelBounds(
  bounds: HouseBounds | null | undefined
): PixelBounds | null {
  if (!bounds) return null;
  const { min_x, min_y, max_x, max_y } = bounds;
  if (![min_x, min_y, max_x, max_y].every((v) => Number.isFinite(v))) return null;
  return { minX: min_x, minY: min_y, maxX: max_x, maxY: max_y };
}

/**
 * Map blueprint pixels to world metres, centred on the *house* rather than the
 * paper. The drawing sheet is larger than the building and rarely concentric
 * with it, so centring on the canvas offsets every wall, door and window.
 */
function createCoordMap(
  imgW: number,
  imgH: number,
  house?: PixelBounds | null
): CoordMap {
  let centerX = imgW / 2;
  let centerY = imgH / 2;
  let span = Math.max(imgW, imgH);

  if (house) {
    const houseSpan = Math.max(house.maxX - house.minX, house.maxY - house.minY);
    if (houseSpan >= Math.max(imgW, imgH) * MIN_HOUSE_SPAN_RATIO) {
      centerX = (house.minX + house.maxX) / 2;
      centerY = (house.minY + house.maxY) / 2;
      span = houseSpan;
    }
  }

  const scale = PLAN_WORLD_SPAN / Math.max(span, 1);
  return {
    imgW,
    imgH,
    scale,
    toX: (px: number) => (px - centerX) * scale,
    toZ: (py: number) => (py - centerY) * scale,
  };
}

function parsePercent(value: string | number | undefined, imgSize: number): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") {
    if (value >= 0 && value <= 1) return value * imgSize;
    return value;
  }
  const raw = String(value);
  const n = Number.parseFloat(raw.replace("%", ""));
  if (!Number.isFinite(n)) return 0;
  if (raw.includes("%")) return (n / 100) * imgSize;
  if (n >= 0 && n <= 1) return n * imgSize;
  return n;
}

function wallEndpoints(wall: BlueprintWall): { x1: number; y1: number; x2: number; y2: number } | null {
  const x1 = wall.x1 ?? wall.start?.x ?? wall.start_x;
  const y1 = wall.y1 ?? wall.start?.y ?? wall.start_y;
  const x2 = wall.x2 ?? wall.end?.x ?? wall.end_x;
  const y2 = wall.y2 ?? wall.end?.y ?? wall.end_y;
  if (
    x1 === undefined ||
    y1 === undefined ||
    x2 === undefined ||
    y2 === undefined ||
    !Number.isFinite(x1) ||
    !Number.isFinite(y1) ||
    !Number.isFinite(x2) ||
    !Number.isFinite(y2)
  ) {
    return null;
  }
  if (Math.hypot(x2 - x1, y2 - y1) < 0.5) return null;
  return { x1, y1, x2, y2 };
}

/**
 * Center from bbox — supports:
 * - [ymin, xmin, ymax, xmax] (YOLO-style)
 * - [xmin, ymin, xmax, ymax]
 * - [x, y, w, h]
 * - CSS percent left/top/width/height
 * - 0..1 normalized or absolute pixel values
 */
function detectionCenter(
  det: BlueprintDetection,
  imgW: number,
  imgH: number
): { cx: number; cy: number } | null {
  const bbox = det.bbox;
  if (Array.isArray(bbox) && bbox.length >= 4) {
    const [a, b, c, d] = bbox.map(Number);
    if ([a, b, c, d].every(Number.isFinite)) {
      const norm = Math.max(a, b, c, d) <= 1.01;
      const A = norm ? a * imgH : a;
      const B = norm ? b * imgW : b;
      const C = norm ? c * imgH : c;
      const D = norm ? d * imgW : d;

      // Prefer [ymin, xmin, ymax, xmax] when first pair looks like Y then X
      if (C > A && D > B && Math.abs(D - B) > 0 && Math.abs(C - A) > 0) {
        // If values fit image axes as ymin/xmin (A,C vs H; B,D vs W)
        if (A <= imgH + 1 && C <= imgH + 1 && B <= imgW + 1 && D <= imgW + 1) {
          return { cx: (B + D) / 2, cy: (A + C) / 2 };
        }
      }

      // Fallback [xmin, ymin, xmax, ymax]
      const xa = norm ? a * imgW : a;
      const ya = norm ? b * imgH : b;
      const xb = norm ? c * imgW : c;
      const yb = norm ? d * imgH : d;
      if (xb > xa && yb > ya) {
        return { cx: (xa + xb) / 2, cy: (ya + yb) / 2 };
      }

      // [x, y, w, h]
      if (c > 0 && d > 0 && c < Math.max(imgW, imgH) && d < Math.max(imgW, imgH)) {
        const x = norm ? a * imgW : a;
        const y = norm ? b * imgH : b;
        const w = norm ? c * imgW : c;
        const h = norm ? d * imgH : d;
        return { cx: x + w / 2, cy: y + h / 2 };
      }
    }
  }

  if (
    det.ymin !== undefined &&
    det.xmin !== undefined &&
    det.ymax !== undefined &&
    det.xmax !== undefined
  ) {
    return { cx: (det.xmin + det.xmax) / 2, cy: (det.ymin + det.ymax) / 2 };
  }

  if (det.x !== undefined && det.y !== undefined && det.w !== undefined && det.h !== undefined) {
    const x = parsePercent(det.x, imgW);
    const y = parsePercent(det.y, imgH);
    const w = parsePercent(det.w, imgW);
    const h = parsePercent(det.h, imgH);
    return { cx: x + w / 2, cy: y + h / 2 };
  }

  if (
    det.left !== undefined &&
    det.top !== undefined &&
    det.width !== undefined &&
    det.height !== undefined
  ) {
    const left = parsePercent(det.left, imgW);
    const top = parsePercent(det.top, imgH);
    const width = parsePercent(det.width, imgW);
    const height = parsePercent(det.height, imgH);
    return { cx: left + width / 2, cy: top + height / 2 };
  }

  return null;
}

function detectionLabel(det: BlueprintDetection): string {
  return String(det.label ?? det.class_name ?? det.id ?? det.kind ?? "").toLowerCase();
}

function openingConfidence(det: BlueprintDetection): number {
  const raw = det.confidence;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw.replace("%", ""));
    if (Number.isFinite(n)) return n;
  }
  return 50;
}

/**
 * Spatial NMS for door/window detections before 3D mounting.
 *
 * Multiple YOLO boxes on one doorway become a single frame + one wall cut.
 */
function dedupeOpeningDetections(
  detections: BlueprintDetection[],
  imgW: number,
  imgH: number,
  nmsPx = OPENING_NMS_PX
): BlueprintDetection[] {
  const doors = detections.filter((d) => detectionLabel(d).includes("door"));
  const windows = detections.filter((d) => detectionLabel(d).includes("window"));
  const other = detections.filter(
    (d) => !detectionLabel(d).includes("door") && !detectionLabel(d).includes("window")
  );

  const nms = (items: BlueprintDetection[], prefix: "D" | "W") => {
    const ranked = [...items].sort((a, b) => openingConfidence(b) - openingConfidence(a));
    const kept: BlueprintDetection[] = [];
    for (const det of ranked) {
      const center = detectionCenter(det, imgW, imgH);
      if (!center) continue;
      const duplicate = kept.some((k) => {
        const kc = detectionCenter(k, imgW, imgH);
        if (!kc) return false;
        return Math.hypot(center.cx - kc.cx, center.cy - kc.cy) <= nmsPx;
      });
      if (!duplicate) kept.push(det);
    }
    kept.sort((a, b) => {
      const ac = detectionCenter(a, imgW, imgH);
      const bc = detectionCenter(b, imgW, imgH);
      if (!ac || !bc) return 0;
      return ac.cy - bc.cy || ac.cx - bc.cx;
    });
    return kept.map((det, i) => ({
      ...det,
      id: `${prefix}${i + 1}`,
      label: prefix === "D" ? `Door D${i + 1}` : `Window W${i + 1}`,
    }));
  };

  return [...nms(doors, "D"), ...nms(windows, "W"), ...other];
}

function wallsFromDetections(
  detections: DetectionBox[],
  imgW: number,
  imgH: number
): BlueprintWall[] {
  const walls: BlueprintWall[] = [];
  for (const box of detections) {
    const label = `${box.id} ${box.label}`.toLowerCase();
    const isWall =
      box.kind === "wall" ||
      label.includes("wall") ||
      label.includes("partition") ||
      label.includes("boundary") ||
      label.includes("load-bearing");
    if (!isWall) continue;

    if (box.segment) {
      walls.push({
        x1: box.segment.x1,
        y1: box.segment.y1,
        x2: box.segment.x2,
        y2: box.segment.y2,
      });
      continue;
    }

    const left = parsePercent(box.left, imgW);
    const top = parsePercent(box.top, imgH);
    const wPx = Math.max(4, parsePercent(box.width, imgW));
    const hPx = Math.max(4, parsePercent(box.height, imgH));
    const cx = left + wPx / 2;
    const cy = top + hPx / 2;
    walls.push(
      wPx >= hPx
        ? { x1: cx - wPx / 2, y1: cy, x2: cx + wPx / 2, y2: cy }
        : { x1: cx, y1: cy - hPx / 2, x2: cx, y2: cy + hPx / 2 }
    );
  }
  return walls;
}

function boxToDetection(box: DetectionBox): BlueprintDetection {
  return {
    id: box.id,
    label: box.label,
    kind: box.kind,
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    segment: box.segment,
  };
}

/**
 * Fraction of the canvas treated as drawing-sheet margin.
 *
 * Mirrors the backend filter so a cached response containing the printed sheet
 * frame still renders a correctly centred house.
 */
const SHEET_MARGIN_RATIO = 0.06;

function isSheetBorderWall(
  wall: BlueprintWall,
  imgW: number,
  imgH: number
): boolean {
  const seg = wallEndpoints(wall);
  if (!seg) return false;
  const left = SHEET_MARGIN_RATIO * imgW;
  const right = (1 - SHEET_MARGIN_RATIO) * imgW;
  const top = SHEET_MARGIN_RATIO * imgH;
  const bottom = (1 - SHEET_MARGIN_RATIO) * imgH;
  return (
    (seg.x1 < left && seg.x2 < left) ||
    (seg.x1 > right && seg.x2 > right) ||
    (seg.y1 < top && seg.y2 < top) ||
    (seg.y1 > bottom && seg.y2 > bottom)
  );
}

/** Normalize parent `data` + `detections` into a consistent blueprint payload. */
function resolveBlueprintData(
  raw: Blueprint3DData | Record<string, unknown> | null | undefined,
  detections: DetectionBox[] | undefined,
  hasLiveResult: boolean | undefined
): Blueprint3DData | null {
  const data = (raw ?? {}) as Blueprint3DData;
  const imgW = Number(data.image_width ?? 1024) || 1024;
  const imgH = Number(data.image_height ?? 1024) || 1024;

  let walls: BlueprintWall[] = Array.isArray(data.walls) ? [...data.walls] : [];
  let architectural: BlueprintDetection[] = Array.isArray(data.architectural_detections)
    ? [...data.architectural_detections]
    : [];
  let structural: BlueprintDetection[] = Array.isArray(data.structural_detections)
    ? [...data.structural_detections]
    : [];

  if (walls.length === 0 && hasLiveResult && detections && detections.length > 0) {
    walls = wallsFromDetections(detections, imgW, imgH);
  }

  const withoutBorder = walls.filter((w) => !isSheetBorderWall(w, imgW, imgH));
  // Only apply if real walls survive — a plan drawn to the paper edge must not
  // be emptied out by the margin heuristic.
  if (withoutBorder.length >= 4) walls = withoutBorder;

  if (architectural.length === 0 && detections && detections.length > 0) {
    architectural = detections
      .filter((d) => {
        const label = `${d.id} ${d.label}`.toLowerCase();
        return (
          d.kind === "opening" ||
          label.includes("door") ||
          label.includes("window")
        );
      })
      .map(boxToDetection);
  }

  if (structural.length === 0 && detections && detections.length > 0) {
    structural = detections
      .filter((d) => {
        const label = `${d.id} ${d.label}`.toLowerCase();
        return d.kind === "column" || label.includes("column") || label.includes("pillar");
      })
      .map(boxToDetection);
  }

  if (walls.length === 0) return null;

  const rawBounds = (raw ?? {}) as {
    house_bounds?: HouseBounds | null;
    meta?: { house_bounds?: HouseBounds | null };
  };
  const houseBounds =
    data.house_bounds ??
    rawBounds.house_bounds ??
    rawBounds.meta?.house_bounds ??
    null;

  return {
    image_width: imgW,
    image_height: imgH,
    walls,
    architectural_detections: architectural,
    structural_detections: structural,
    house_bounds: houseBounds,
  };
}

// ---------------------------------------------------------------------------
// Geometry builders
// ---------------------------------------------------------------------------

type BuildContext = {
  group: THREE.Group;
  materials: HouseMaterials;
};

function shadowMesh(mesh: THREE.Mesh): THREE.Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addWallBox(
  ctx: BuildContext,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rotationY = 0,
  material: THREE.MeshStandardMaterial = ctx.materials.wall
) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = shadowMesh(new THREE.Mesh(geo, material));
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotationY;
  ctx.group.add(mesh);
}

function addWallTopCap(
  ctx: BuildContext,
  w: number,
  d: number,
  x: number,
  z: number,
  rotationY = 0
) {
  addWallBox(
    ctx,
    w,
    WALL_CAP_HEIGHT,
    d,
    x,
    WALL_HEIGHT - WALL_CAP_HEIGHT / 2,
    z,
    rotationY,
    ctx.materials.wallCap
  );
}

function createRoofHalfGeo(corners: THREE.Vector3[]) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array([
    corners[0].x, corners[0].y, corners[0].z,
    corners[1].x, corners[1].y, corners[1].z,
    corners[2].x, corners[2].y, corners[2].z,
    corners[0].x, corners[0].y, corners[0].z,
    corners[2].x, corners[2].y, corners[2].z,
    corners[3].x, corners[3].y, corners[3].z,
  ]);
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function orientToOutward(group: THREE.Group, outward: THREE.Vector3) {
  const n = outward.clone().normalize();
  group.rotation.y = Math.atan2(n.x, n.z);
}

function embedInWall(
  anchor: { x: number; z: number; outwardX: number; outwardZ: number },
  depth: number
): { x: number; z: number } {
  const inset = depth * 0.5 - 0.02;
  return {
    x: anchor.x + anchor.outwardX * inset,
    z: anchor.z + anchor.outwardZ * inset,
  };
}

function addCornerPatches(ctx: BuildContext, runs: WallRun[]) {
  for (const junction of collectWallJunctions(runs)) {
    const d = WALL_DEPTH_M;
    addWallBox(ctx, d, WALL_HEIGHT, d, junction.x, WALL_HEIGHT / 2, junction.z);
    addWallTopCap(ctx, d, d, junction.x, junction.z);
  }
}

function addFramedWindow(
  ctx: BuildContext,
  cx: number,
  cy: number,
  cz: number,
  openingW = 1.4,
  openingH = 1.3,
  outward: THREE.Vector3 = new THREE.Vector3(0, 0, 1)
) {
  const win = new THREE.Group();
  win.position.set(cx, cy, cz);
  orientToOutward(win, outward);

  const jambDepth = 0.15;
  const framePad = 0.09;
  const mullionThick = 0.034;
  const glassW = openingW * 0.88;
  const glassH = openingH * 0.88;
  const glassZ = jambDepth * 0.52;
  const mullionZ = glassZ + 0.014;

  const outerFrame = shadowMesh(
    new THREE.Mesh(
      new THREE.BoxGeometry(openingW + framePad * 2, openingH + framePad * 2, jambDepth),
      ctx.materials.frame
    )
  );
  outerFrame.position.set(0, 0, jambDepth * 0.5);
  win.add(outerFrame);

  const sillExtend = 0.16;
  const sill = shadowMesh(
    new THREE.Mesh(
      new THREE.BoxGeometry(openingW + framePad * 2.4, 0.06, jambDepth + sillExtend),
      ctx.materials.sill
    )
  );
  sill.position.set(0, -openingH / 2 - framePad * 0.5, (jambDepth + sillExtend) * 0.5);
  win.add(sill);

  const glowBack = new THREE.Mesh(
    new THREE.PlaneGeometry(glassW * 0.98, glassH * 0.98),
    ctx.materials.glassGlow
  );
  glowBack.position.set(0, 0, glassZ - 0.008);
  win.add(glowBack);

  const glass = new THREE.Mesh(new THREE.BoxGeometry(glassW, glassH, 0.022), ctx.materials.glass);
  glass.position.set(0, 0, glassZ);
  glass.renderOrder = 2;
  win.add(glass);

  const vMullion = new THREE.Mesh(
    new THREE.BoxGeometry(mullionThick, glassH, 0.028),
    ctx.materials.frame
  );
  vMullion.position.set(0, 0, mullionZ);
  vMullion.renderOrder = 3;
  win.add(vMullion);

  const hMullion = new THREE.Mesh(
    new THREE.BoxGeometry(glassW, mullionThick, 0.028),
    ctx.materials.frame
  );
  hMullion.position.set(0, 0, mullionZ);
  hMullion.renderOrder = 3;
  win.add(hMullion);

  ctx.group.add(win);
}

function addDynamicDoor(
  ctx: BuildContext,
  wx: number,
  _wy: number,
  wz: number,
  outward: THREE.Vector3 = new THREE.Vector3(0, 0, 1)
) {
  const DOOR_WIDTH = DOOR_LEAF_W;
  const DOOR_HEIGHT = DOOR_LEAF_H;
  const doorJambDepth = 0.15;
  const jambThick = DOOR_JAMB_THICK;

  const doorAsm = new THREE.Group();
  doorAsm.position.set(wx, 0, wz);
  orientToOutward(doorAsm, outward);

  const leftJamb = shadowMesh(
    new THREE.Mesh(
      new THREE.BoxGeometry(jambThick, DOOR_HEIGHT + jambThick, doorJambDepth),
      ctx.materials.frame
    )
  );
  leftJamb.position.set(-DOOR_WIDTH / 2 + jambThick / 2, DOOR_HEIGHT / 2, doorJambDepth / 2);
  doorAsm.add(leftJamb);

  const rightJamb = shadowMesh(
    new THREE.Mesh(
      new THREE.BoxGeometry(jambThick, DOOR_HEIGHT + jambThick, doorJambDepth),
      ctx.materials.frame
    )
  );
  rightJamb.position.set(DOOR_WIDTH / 2 - jambThick / 2, DOOR_HEIGHT / 2, doorJambDepth / 2);
  doorAsm.add(rightJamb);

  const doorHead = shadowMesh(
    new THREE.Mesh(
      new THREE.BoxGeometry(DOOR_WIDTH + jambThick * 2, jambThick, doorJambDepth),
      ctx.materials.frame
    )
  );
  doorHead.position.set(0, DOOR_HEIGHT + jambThick / 2, doorJambDepth / 2);
  doorAsm.add(doorHead);

  const leafPivot = new THREE.Group();
  leafPivot.position.set(-DOOR_WIDTH / 2, 0, 0);
  leafPivot.rotation.y = DOOR_OPEN_ANGLE;

  const doorLeaf = shadowMesh(
    new THREE.Mesh(new THREE.BoxGeometry(DOOR_WIDTH, DOOR_HEIGHT, 0.1), ctx.materials.wood)
  );
  doorLeaf.position.set(DOOR_WIDTH / 2, DOOR_HEIGHT / 2, 0.05);
  leafPivot.add(doorLeaf);

  const panelMarginX = 0.1;
  const panelMarginY = 0.14;
  const panelW = (DOOR_WIDTH - panelMarginX * 3) / 2;
  const panelH = (DOOR_HEIGHT - panelMarginY * 3) / 2;

  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const px = panelMarginX + panelW / 2 + col * (panelW + panelMarginX);
      const py = panelMarginY + panelH / 2 + row * (panelH + panelMarginY);
      const recess = shadowMesh(
        new THREE.Mesh(new THREE.BoxGeometry(panelW, panelH, 0.022), ctx.materials.woodPanel)
      );
      recess.position.set(px, py, 0.092);
      leafPivot.add(recess);
    }
  }

  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.14, 16),
    ctx.materials.brass
  );
  handle.rotation.x = Math.PI / 2;
  handle.position.set(DOOR_WIDTH - 0.08, 1.0, 0.08);
  handle.castShadow = true;
  leafPivot.add(handle);

  doorAsm.add(leafPivot);
  ctx.group.add(doorAsm);
}

function addSealedGable(
  ctx: BuildContext,
  ridgeX: number,
  halfWidthX: number,
  facingZ: number,
  flip: boolean
) {
  // Gable base aligns with elevated eaves (EAVE_Y), not wall mid-height
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidthX, EAVE_Y);
  shape.lineTo(halfWidthX, EAVE_Y);
  shape.lineTo(0, RIDGE_Y);
  shape.closePath();

  const gableGeo = new THREE.ShapeGeometry(shape);
  const gable = shadowMesh(new THREE.Mesh(gableGeo, ctx.materials.wall));
  gable.position.set(ridgeX, 0, facingZ);
  if (flip) gable.rotation.y = Math.PI;
  ctx.group.add(gable);

  const gableEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(gableGeo),
    ctx.materials.edge
  );
  gableEdges.position.copy(gable.position);
  gableEdges.rotation.copy(gable.rotation);
  ctx.group.add(gableEdges);
}

function addSlabBox(
  ctx: BuildContext,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  y = 0.125,
  height = 0.25,
  material: THREE.MeshStandardMaterial = ctx.materials.slab
) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  if (w < 0.2 || d < 0.2) return;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), material);
  slab.position.set((minX + maxX) / 2, y, (minZ + maxZ) / 2);
  slab.receiveShadow = true;
  ctx.group.add(slab);
}

function addDynamicRoofAndSlab(
  ctx: BuildContext,
  bounds: WallBounds,
  cutout: CornerCutout | null
): THREE.Group {
  const minX = bounds.minX - SLAB_PAD;
  const maxX = bounds.maxX + SLAB_PAD;
  const minZ = bounds.minZ - SLAB_PAD;
  const maxZ = bounds.maxZ + SLAB_PAD;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  if (cutout) {
    // Two rectangles make the L; a lower pad in the inset is the car porch.
    const cminX = cutout.minX;
    const cmaxX = cutout.maxX;
    const cminZ = cutout.minZ;
    const cmaxZ = cutout.maxZ;
    if (cutout.corner === "se") {
      addSlabBox(ctx, minX, maxX, minZ, cminZ);
      addSlabBox(ctx, minX, cminX, cminZ, maxZ);
    } else if (cutout.corner === "sw") {
      addSlabBox(ctx, minX, maxX, minZ, cminZ);
      addSlabBox(ctx, cmaxX, maxX, cminZ, maxZ);
    } else if (cutout.corner === "ne") {
      addSlabBox(ctx, minX, maxX, cmaxZ, maxZ);
      addSlabBox(ctx, minX, cminX, minZ, cmaxZ);
    } else {
      addSlabBox(ctx, minX, maxX, cmaxZ, maxZ);
      addSlabBox(ctx, cmaxX, maxX, minZ, cmaxZ);
    }
    addSlabBox(ctx, cminX, cmaxX, cminZ, cmaxZ, 0.06, 0.12, ctx.materials.concrete);
  } else {
    addSlabBox(ctx, minX, maxX, minZ, maxZ);
  }

  const eaveMinX = minX - EAVE_OVERHANG;
  const eaveMaxX = maxX + EAVE_OVERHANG;
  const eaveMinZ = minZ - EAVE_OVERHANG;
  const eaveMaxZ = maxZ + EAVE_OVERHANG;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const ridgeAlongX = spanX >= spanZ;

  const roofGroup = new THREE.Group();

  if (ridgeAlongX) {
    const ridgeX = cx;
    const halfWidthX = spanX / 2;
    const leftGeo = createRoofHalfGeo([
      new THREE.Vector3(ridgeX, RIDGE_Y, eaveMinZ),
      new THREE.Vector3(ridgeX, RIDGE_Y, eaveMaxZ),
      new THREE.Vector3(eaveMinX, EAVE_Y, eaveMaxZ),
      new THREE.Vector3(eaveMinX, EAVE_Y, eaveMinZ),
    ]);
    roofGroup.add(shadowMesh(new THREE.Mesh(leftGeo, ctx.materials.roof)));

    const rightGeo = createRoofHalfGeo([
      new THREE.Vector3(ridgeX, RIDGE_Y, eaveMinZ),
      new THREE.Vector3(ridgeX, RIDGE_Y, eaveMaxZ),
      new THREE.Vector3(eaveMaxX, EAVE_Y, eaveMaxZ),
      new THREE.Vector3(eaveMaxX, EAVE_Y, eaveMinZ),
    ]);
    roofGroup.add(shadowMesh(new THREE.Mesh(rightGeo, ctx.materials.roof)));

    [leftGeo, rightGeo].forEach((geo) => {
      roofGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), ctx.materials.roofEdge));
    });

    addSealedGable(ctx, ridgeX, halfWidthX, maxZ, false);
    addSealedGable(ctx, ridgeX, halfWidthX, minZ, true);
  } else {
    const ridgeZ = cz;
    const halfDepthZ = spanZ / 2 + EAVE_OVERHANG;

    const westGeo = createRoofHalfGeo([
      new THREE.Vector3(eaveMinX, EAVE_Y, eaveMinZ),
      new THREE.Vector3(eaveMinX, EAVE_Y, eaveMaxZ),
      new THREE.Vector3(cx, RIDGE_Y, eaveMaxZ),
      new THREE.Vector3(cx, RIDGE_Y, eaveMinZ),
    ]);
    roofGroup.add(shadowMesh(new THREE.Mesh(westGeo, ctx.materials.roof)));

    const eastGeo = createRoofHalfGeo([
      new THREE.Vector3(cx, RIDGE_Y, eaveMinZ),
      new THREE.Vector3(cx, RIDGE_Y, eaveMaxZ),
      new THREE.Vector3(eaveMaxX, EAVE_Y, eaveMaxZ),
      new THREE.Vector3(eaveMaxX, EAVE_Y, eaveMinZ),
    ]);
    roofGroup.add(shadowMesh(new THREE.Mesh(eastGeo, ctx.materials.roof)));

    [westGeo, eastGeo].forEach((geo) => {
      roofGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), ctx.materials.roofEdge));
    });

    const gableShape = (halfW: number) => {
      const shape = new THREE.Shape();
      shape.moveTo(-halfW, EAVE_Y);
      shape.lineTo(halfW, EAVE_Y);
      shape.lineTo(0, RIDGE_Y);
      shape.closePath();
      return new THREE.ShapeGeometry(shape);
    };
    const westGable = shadowMesh(new THREE.Mesh(gableShape(halfDepthZ), ctx.materials.wall));
    westGable.position.set(minX, 0, ridgeZ);
    westGable.rotation.y = Math.PI / 2;
    roofGroup.add(westGable);

    const eastGable = shadowMesh(new THREE.Mesh(gableShape(halfDepthZ), ctx.materials.wall));
    eastGable.position.set(maxX, 0, ridgeZ);
    eastGable.rotation.y = -Math.PI / 2;
    roofGroup.add(eastGable);
  }

  ctx.group.add(roofGroup);
  return roofGroup;
}

/**
 * Max distance (m) an opening may be moved to reach a wall.
 *
 * Beyond this there is no plausible host wall, so the opening is dropped rather
 * than left standing in the middle of a room.
 */
const OPENING_SNAP_LIMIT_M = 0.85;

/** A carved hole in a wall run, in run-local coordinates. */
type RunCut = {
  t0: number;
  t1: number;
  /** Top of the opening — masonry above this becomes a lintel. */
  headY: number;
  /** Bottom of the opening — masonry below this becomes an apron (windows). */
  sillY: number;
};

/**
 * Extrude one wall run as solid spans plus lintels and aprons around openings.
 *
 * Carving the run means a door reads as a hole through real masonry, and the
 * wall above it stays continuous instead of the run simply stopping.
 */
function extrudeRun(ctx: BuildContext, run: WallRun, cuts: RunCut[]) {
  const len = runLength(run);
  if (len < 1e-6) return;

  const ux = (run.ex - run.sx) / len;
  const uz = (run.ez - run.sz) / len;
  const angle = -Math.atan2(run.ez - run.sz, run.ex - run.sx);
  const depth = WALL_DEPTH_M;

  const at = (t: number) => ({ x: run.sx + ux * t, z: run.sz + uz * t });

  const holes = mergeSpans(
    cuts.map((c) => [Math.max(0, c.t0), Math.min(len, c.t1)] as Span),
    0.02
  );

  for (const [a, b] of gapSpans(0, len, holes, 0.02)) {
    const start = a <= 1e-3 ? a - depth * 0.5 : a;
    const end = b >= len - 1e-3 ? b + depth * 0.5 : b;
    const mid = at((start + end) / 2);
    addWallBox(
      ctx,
      end - start,
      WALL_HEIGHT,
      depth,
      mid.x,
      WALL_HEIGHT / 2,
      mid.z,
      angle
    );
    addWallTopCap(ctx, end - start, depth, mid.x, mid.z, angle);
  }

  for (const cut of cuts) {
    const t0 = Math.max(0, cut.t0);
    const t1 = Math.min(len, cut.t1);
    if (t1 - t0 < 0.05) continue;
    const mid = at((t0 + t1) / 2);

    const lintelH = WALL_HEIGHT - cut.headY;
    if (lintelH > 0.05) {
      addWallBox(
        ctx,
        t1 - t0,
        lintelH,
        depth,
        mid.x,
        cut.headY + lintelH / 2,
        mid.z,
        angle
      );
      addWallTopCap(ctx, t1 - t0, depth, mid.x, mid.z, angle);
    }

    if (cut.sillY > 0.05) {
      addWallBox(ctx, t1 - t0, cut.sillY, depth, mid.x, cut.sillY / 2, mid.z, angle);
    }
  }
}

/** Opening frame size in metres, derived from the detected symbol footprint. */
function detectionWorldSize(
  det: BlueprintDetection,
  imgW: number,
  imgH: number,
  scale: number
): { w: number; h: number } {
  const wPx = Math.max(8, parsePercent(det.width, imgW) || 40);
  const hPx = Math.max(8, parsePercent(det.height, imgH) || 40);
  return {
    w: Math.max(0.8, Math.min(2.4, Math.max(wPx, hPx) * scale)),
    h: Math.max(0.9, Math.min(1.6, Math.min(wPx, hPx) * scale * 1.2)),
  };
}

/** Blueprint-driven house from walls / openings / columns. */
function buildDynamicHouse(ctx: BuildContext, data: Blueprint3DData): THREE.Group {
  const imgW = data.image_width || 1024;
  const imgH = data.image_height || 1024;
  // Centre on the walls we are about to render so the geometry lands on the
  // origin exactly; the backend footprint is the fallback for wall-less payloads.
  const housePx =
    pixelBoundsFromWalls(data.walls) ?? houseBoundsToPixelBounds(data.house_bounds);
  const { toX, toZ, scale } = createCoordMap(imgW, imgH, housePx);

  // 1) Blueprint pixels -> world runs
  const candidateRuns: WallRun[] = [];
  for (const wall of data.walls ?? []) {
    const seg = wallEndpoints(wall);
    if (!seg) continue;

    const sx = toX(seg.x1);
    const sz = toZ(seg.y1);
    const ex = toX(seg.x2);
    const ez = toZ(seg.y2);
    if (Math.hypot(ex - sx, ez - sz) < MIN_WALL_RUN_M) continue;

    candidateRuns.push({ sx, sz, ex, ez, depth: WALL_DEPTH_M });
  }

  // 2) Square up: strict orthogonal, double-wall merge, corner snap
  let runs = buildOrthogonalLayout(candidateRuns, scale);

  if (runs.length === 0) {
    // Never invent a hardcoded house — callers must show an empty state instead.
    return new THREE.Group();
  }

  // 3) Open the car porch: prefer the ink-flood cutout from the backend so
  //    the inset matches the 2D plan, then fall back to a geometric guess.
  let cutout: CornerCutout | null = null;
  const pxCut = data.house_bounds?.cutout;
  if (
    pxCut &&
    [pxCut.min_x, pxCut.min_y, pxCut.max_x, pxCut.max_y].every((v) =>
      Number.isFinite(v)
    )
  ) {
    const xs = [toX(pxCut.min_x), toX(pxCut.max_x)];
    const zs = [toZ(pxCut.min_y), toZ(pxCut.max_y)];
    const corner = pxCut.corner;
    cutout = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minZ: Math.min(...zs),
      maxZ: Math.max(...zs),
      corner:
        corner === "nw" || corner === "ne" || corner === "sw" || corner === "se"
          ? corner
          : "se",
    };
    runs = trimRunsAgainstCutout(runs, cutout);
  } else {
    cutout = findCornerCutout(runs);
  }

  // 4) Walls facing open air can take glazing; partitions cannot
  const exterior = exteriorRunIndices(runs);

  // Slab and roof sit slightly proud of the masonry
  const footprint = boundsFromRuns(runs);
  const pad = 0.15;
  const closedBounds: WallBounds = {
    minX: footprint.minX - pad,
    maxX: footprint.maxX + pad,
    minZ: footprint.minZ - pad,
    maxZ: footprint.maxZ + pad,
  };

  // 4) Mount every opening inside a wall run and record the hole to carve
  const cutsByRun = new Map<number, RunCut[]>();
  const mountedOpenings: { x: number; z: number }[] = [];
  const addCut = (runIndex: number, cut: RunCut) => {
    const list = cutsByRun.get(runIndex);
    const duplicate = list?.some(
      (c) => Math.abs(c.t0 - cut.t0) < 0.45 && Math.abs(c.t1 - cut.t1) < 0.45
    );
    if (duplicate) return;
    if (list) list.push(cut);
    else cutsByRun.set(runIndex, [cut]);
  };

  const openingDetections = dedupeOpeningDetections(
    data.architectural_detections ?? [],
    imgW,
    imgH
  );

  for (const det of openingDetections) {
    const center = detectionCenter(det, imgW, imgH);
    if (!center) continue;
    const label = detectionLabel(det);
    const isWindow = label.includes("window");
    const isDoor = label.includes("door");
    if (!isWindow && !isDoor) continue;

    const size = detectionWorldSize(det, imgW, imgH, scale);
    const openingW = isDoor ? DOOR_OPENING_W : size.w;
    // Glazing belongs on walls facing open air; a window on a partition would
    // sit between two rooms. Doors can go anywhere.
    const hostable =
      isWindow && exterior.size > 0
        ? runs.filter((_, i) => exterior.has(i))
        : runs;
    const anchor = anchorOpeningToRun(
      toX(center.cx),
      toZ(center.cy),
      openingW / 2,
      hostable
    );
    // No plausible host wall — drop it rather than leave it floating in a room
    if (!anchor || anchor.distance > OPENING_SNAP_LIMIT_M) continue;

    // anchor.runIndex indexes `hostable`; map it back to the full run list
    const hostRun = hostable[anchor.runIndex];
    const runIndex = runs.indexOf(hostRun);
    if (runIndex < 0) continue;

    const outward = new THREE.Vector3(anchor.outwardX, 0, anchor.outwardZ);
    const half = openingW / 2 + OPENING_CUT_PAD;
    const embed = embedInWall(anchor, WALL_DEPTH_M);

    if (
      mountedOpenings.some(
        (p) => Math.hypot(p.x - embed.x, p.z - embed.z) < OPENING_NMS_M
      )
    ) {
      continue;
    }
    mountedOpenings.push({ x: embed.x, z: embed.z });

    if (isWindow) {
      const sillY = Math.max(0.35, WINDOW_CENTER_Y - size.h / 2 - 0.08);
      addCut(runIndex, {
        t0: anchor.t - half,
        t1: anchor.t + half,
        sillY,
        headY: Math.min(WALL_HEIGHT, WINDOW_CENTER_Y + size.h / 2 + 0.12),
      });
      addFramedWindow(
        ctx,
        embed.x,
        WINDOW_CENTER_Y,
        embed.z,
        size.w,
        size.h,
        outward
      );
    } else {
      addCut(runIndex, {
        t0: anchor.t - half,
        t1: anchor.t + half,
        sillY: 0,
        headY: Math.min(WALL_HEIGHT, DOOR_HEAD_Y),
      });
      addDynamicDoor(ctx, embed.x, 0, embed.z, outward);
    }
  }

  // 5) Extrude masonry with the openings carved out, then seal corners
  runs.forEach((run, i) => extrudeRun(ctx, run, cutsByRun.get(i) ?? []));
  addCornerPatches(ctx, runs);

  for (const det of data.structural_detections ?? []) {
    const center = detectionCenter(det, imgW, imgH);
    if (!center) continue;
    const col = shadowMesh(
      new THREE.Mesh(new THREE.BoxGeometry(0.42, WALL_HEIGHT, 0.42), ctx.materials.column)
    );
    col.position.set(toX(center.cx), WALL_HEIGHT / 2, toZ(center.cy));
    ctx.group.add(col);
  }

  return addDynamicRoofAndSlab(ctx, closedBounds, cutout);
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export function FloorPlan3DViewport({
  data,
  detections,
  hasLiveResult = false,
  className = "",
}: FloorPlan3DViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const roofGroupRef = useRef<THREE.Group | null>(null);
  const houseGroupRef = useRef<THREE.Group | null>(null);
  const materialsRef = useRef<HouseMaterials | null>(null);
  const envGroupRef = useRef<THREE.Group | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const isWalkthroughRef = useRef(false);
  const keysPressed = useRef<Record<string, boolean>>({});

  const [isNightMode, setIsNightMode] = useState(false);
  const [showRoof, setShowRoof] = useState(false);
  const [isWalkthrough, setIsWalkthrough] = useState(false);

  const blueprintData = useMemo(
    () => resolveBlueprintData(data, detections, hasLiveResult),
    [data, detections, hasLiveResult]
  );
  const hasRealWalls = Boolean(blueprintData?.walls && blueprintData.walls.length > 0);

  useEffect(() => {
    isWalkthroughRef.current = isWalkthrough;
  }, [isWalkthrough]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    while (container.firstChild) container.removeChild(container.firstChild);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isNightMode ? 0x0b132b : 0xe0f2fe);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
    camera.position.set(0, 14, 16);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch (err) {
      console.error("WebGL initialization failed:", err);
      return;
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1.4, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controlsRef.current = controls;

    scene.add(
      new THREE.AmbientLight(isNightMode ? 0x1e293b : 0xffffff, isNightMode ? 0.3 : 0.8)
    );

    const sunLight = new THREE.DirectionalLight(
      isNightMode ? 0x38bdf8 : 0xfffaed,
      isNightMode ? 0.2 : 1.4
    );
    sunLight.position.set(14, 22, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);

    [
      new THREE.Vector3(-3, 2.3, -2),
      new THREE.Vector3(3, 2.3, -2),
      new THREE.Vector3(-3, 2.3, 2),
      new THREE.Vector3(3, 2.3, 2),
    ].forEach((pos) => {
      const pLight = new THREE.PointLight(0xf59e0b, isNightMode ? 2.8 : 0, 9);
      pLight.position.copy(pos);
      scene.add(pLight);
    });

    const envGroup = new THREE.Group();
    envGroupRef.current = envGroup;

    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 })
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.receiveShadow = true;
    envGroup.add(lawn);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 60),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(18, 0.01, 0);
    road.receiveShadow = true;
    envGroup.add(road);

    const curve = new THREE.EllipseCurve(0, 0, 15, 11, 0, Math.PI, false, 0);
    const solarPath = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        curve.getPoints(48).map((p) => new THREE.Vector3(p.x, p.y, 0))
      ),
      new THREE.LineDashedMaterial({ color: 0xd4af37, dashSize: 0.5, gapSize: 0.3 })
    );
    solarPath.computeLineDistances();
    solarPath.rotation.y = -Math.PI / 6;
    solarPath.position.set(0, 0.2, 0);
    envGroup.add(solarPath);

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xf5a623 })
    );
    sun.position.set(-9, 10, -2);
    envGroup.add(sun);
    scene.add(envGroup);

    const materials = createHouseMaterials();
    materialsRef.current = materials;

    const houseGroup = new THREE.Group();
    houseGroupRef.current = houseGroup;
    const buildCtx: BuildContext = { group: houseGroup, materials };

    // Only build geometry from live blueprint walls — never the static demo house.
    if (hasRealWalls && blueprintData) {
      roofGroupRef.current = buildDynamicHouse(buildCtx, blueprintData);
      if (roofGroupRef.current) {
        roofGroupRef.current.visible = showRoof;
      }
      scene.add(houseGroup);
    } else {
      roofGroupRef.current = null;
    }

    const clock = new THREE.Clock();
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);

      if (isWalkthroughRef.current && cameraRef.current) {
        const dt = Math.min(clock.getDelta(), 0.05);
        const speed = 4.5 * dt;
        const dir = new THREE.Vector3();
        cameraRef.current.getWorldDirection(dir);
        dir.y = 0;
        dir.normalize();
        const side = new THREE.Vector3(-dir.z, 0, dir.x);

        if (keysPressed.current["w"] || keysPressed.current["arrowup"]) {
          cameraRef.current.position.addScaledVector(dir, speed);
        }
        if (keysPressed.current["s"] || keysPressed.current["arrowdown"]) {
          cameraRef.current.position.addScaledVector(dir, -speed);
        }
        if (keysPressed.current["a"] || keysPressed.current["arrowleft"]) {
          cameraRef.current.position.addScaledVector(side, -speed);
        }
        if (keysPressed.current["d"] || keysPressed.current["arrowright"]) {
          cameraRef.current.position.addScaledVector(side, speed);
        }
        cameraRef.current.position.y = EYE_LEVEL;
      } else {
        controls.update();
      }

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      controls.dispose();
      if (houseGroupRef.current) disposeObject3D(houseGroupRef.current);
      if (envGroupRef.current) disposeObject3D(envGroupRef.current);
      if (materialsRef.current) disposeMaterials(materialsRef.current);
      scene.clear();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      rendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      roofGroupRef.current = null;
      houseGroupRef.current = null;
      materialsRef.current = null;
      envGroupRef.current = null;
    };
    // showRoof applied via separate effect so night/data rebuilds don't fight visibility
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNightMode, blueprintData, hasRealWalls]);

  useEffect(() => {
    if (roofGroupRef.current) roofGroupRef.current.visible = showRoof;
  }, [showRoof]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const enterWalkthrough = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    setIsWalkthrough(true);
    setShowRoof(false);
    controlsRef.current.enabled = false;
    cameraRef.current.position.set(0, EYE_LEVEL, 3);
    cameraRef.current.lookAt(0, EYE_LEVEL, 0);
  };

  const exitWalkthrough = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    setIsWalkthrough(false);
    setShowRoof(true);
    controlsRef.current.enabled = true;
    cameraRef.current.position.set(0, 9, 15);
    controlsRef.current.target.set(0, 1.4, 0);
  };

  const wallCount = blueprintData?.walls?.length ?? 0;
  const windowCount =
    blueprintData?.architectural_detections?.filter((d) =>
      detectionLabel(d).includes("window")
    ).length ?? 0;
  const columnCount = blueprintData?.structural_detections?.length ?? 0;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]">
            Premium BIM Viewport
          </p>
          <h2 className="mt-0.5 text-lg font-bold text-slate-900">3D Floor Plan View</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {hasRealWalls
              ? `${wallCount} walls · ${windowCount} windows · ${columnCount} columns · Blueprint-driven`
              : hasLiveResult
                ? "No wall segments in analysis result — re-run detection on a clearer floor plan"
                : "Upload a blueprint and run analysis to generate a live 3D floor plan"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setIsNightMode(false)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 transition-colors ${
                !isNightMode ? "bg-amber-100 font-bold text-amber-900" : "text-slate-500"
              }`}
            >
              <Sun className="h-3 w-3" /> Day
            </button>
            <button
              type="button"
              onClick={() => setIsNightMode(true)}
              className={`inline-flex items-center gap-1 border-l border-slate-200 px-3 py-1.5 transition-colors ${
                isNightMode ? "bg-indigo-950 font-bold text-indigo-100" : "text-slate-500"
              }`}
            >
              <Moon className="h-3 w-3" /> Night
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowRoof((v) => !v)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all ${
              showRoof
                ? "border-[#D4AF37] bg-[#D4AF37] font-bold text-slate-950"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {showRoof ? "🏠 Hide Roof" : "🏠 Show Roof"}
          </button>
        </div>
      </div>

      <div className="relative p-4 sm:p-5">
        <div
          ref={containerRef}
          className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-inner sm:aspect-[16/10]"
        />

        {!hasRealWalls && (
          <div className="pointer-events-none absolute inset-4 z-20 flex items-center justify-center sm:inset-5">
            <div className="max-w-md rounded-2xl border border-dashed border-slate-300/80 bg-white/90 px-6 py-8 text-center shadow-lg backdrop-blur-sm">
              <p className="text-sm font-bold text-slate-900">
                {hasLiveResult
                  ? "No walls extracted from this blueprint"
                  : "Waiting for blueprint analysis"}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                {hasLiveResult
                  ? "The 3D model stays empty until wall segments are returned. Try a higher-contrast floor plan and re-run analysis."
                  : "Upload an architectural plan and run clash detection. The maquette will rebuild uniquely from that floor plan’s walls, doors, windows, and columns."}
              </p>
            </div>
          </div>
        )}

        <div className="absolute bottom-8 right-8 z-10">
          {isWalkthrough ? (
            <button
              type="button"
              onClick={exitWalkthrough}
              className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/95 px-4 py-2 text-xs font-semibold text-rose-700 shadow-xl backdrop-blur-sm"
            >
              <X className="h-4 w-4" /> Exit Walkthrough
            </button>
          ) : (
            <button
              type="button"
              onClick={enterWalkthrough}
              disabled={!hasRealWalls}
              className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/50 bg-white/95 px-4 py-2 text-xs font-bold text-slate-900 shadow-xl backdrop-blur-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Footprints className="h-4 w-4 text-[#D4AF37]" />
              <Eye className="h-4 w-4 text-slate-600" />
              Walk Inside House
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3 rounded-sm bg-[#15803d]" /> Grass lawn
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <span className="h-2.5 w-3 rounded-sm bg-[#334155]" /> Asphalt road
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-900">
            <span className="h-2.5 w-3 rounded-sm bg-[#451a03]" /> Foundation slab
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#D4AF37]">
            <Sun className="h-3.5 w-3.5" /> Solar path
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-sky-500">
            <span className="h-2.5 w-3 rounded-sm border border-sky-400 bg-sky-400/40" /> Glass
            windows
          </span>
        </div>
      </div>
    </div>
  );
}

export default FloorPlan3DViewport;
