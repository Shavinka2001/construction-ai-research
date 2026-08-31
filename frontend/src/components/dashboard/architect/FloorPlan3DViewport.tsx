"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { Eye, Footprints, Moon, Sun, X } from "lucide-react";
import { OpeningsScheduleCard } from "@/components/dashboard/architect/OpeningsScheduleCard";
import type { DetectionBox, OpeningsSchedule } from "@/lib/clash-detection";
import {
  MIN_WALL_RUN_M,
  anchorOpeningToRun,
  boundsFromRuns,
  buildOrthogonalLayout,
  collapseCoplanarRuns,
  collectWallJunctions,
  findCornerCutout,
  gapSpans,
  mergeSpans,
  runAxis,
  runLength,
  trimRunsAgainstCutout,
  weldRunCorners,
  type CornerCutout,
  type Span,
  type WallAnchor,
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
  openings_schedule?: OpeningsSchedule | null;
};

export interface FloorPlan3DViewportProps {
  data?: Blueprint3DData | Record<string, unknown> | null;
  detections?: DetectionBox[];
  recommendations?: unknown[];
  architecturalAudit?: unknown;
  openingsSchedule?: OpeningsSchedule | null;
  viewMode?: MaquetteViewMode;
  hasLiveResult?: boolean;
  className?: string;
  projectName?: string | null;
  modelUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Architectural constants
// ---------------------------------------------------------------------------

const WALL_HEIGHT = 2.8;
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
const WALK_SPEED = 4.0;
const SPRINT_SPEED = 7.0;
const HEAD_BOB_AMPLITUDE = 0.04;
const LOOK_SENSITIVITY = 0.0022;
const LOOK_DAMPING = 0.14;
const TELEPORT_DURATION_MS = 900;
const SLAB_PAD = 0.5;

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
const DOOR_NMS_PX = 60;
const DOOR_MIN_CONFIDENCE = 40;
const DOOR_MAX_COUNT = 4;
const DOOR_WALL_SNAP_PX = 55;
const DOOR_JUNCTION_RADIUS_PX = 72;
const DOOR_WIDTH_HARD_MIN_PX = 25;
const DOOR_WIDTH_HARD_MAX_PX = 50;
const WINDOW_MAX_COUNT = 3;
const WINDOW_WIDTH_MIN_PX = 35;
const WINDOW_WIDTH_MAX_PX = 65;
const STAIR_REJECT_RADIUS_PX = 92;
const OPENING_NMS_M = 0.8;

/** Architectural dimension line height above the floor slab. */
const DIM_LINE_Y = 0.12;
const DIM_OFFSET_M = 0.78;
const DIM_OFFSET_TIER_M = 0.32;
const DIM_LABEL_PUSH_M = 0.28;
const DIM_TICK_M = 0.08;
/** Only dimension major perimeter walls and primary partitions (metres). */
const MIN_DIMENSION_WALL_M = 2.0;
const MIN_ROOM_AREA_SQ_M = 3.5;
const MIN_ROOM_CELL_M = 0.85;

/** Tolerance for deduplicating blueprint strokes that sit on the envelope. */
const PERIMETER_DEDUPE_TOL = 0.4;
/** Snap interior partition endpoints to the exterior shell. */
const INTERIOR_SNAP_DIST = 0.42;
/** Max distance a detected opening may be from a perimeter wall. */
const PERIMETER_OPENING_SNAP_M = 1.65;

type PerimeterSide = "back" | "front" | "left" | "right";

// ---------------------------------------------------------------------------
// Lifecycle helpers
// ---------------------------------------------------------------------------

function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof CSS2DObject) {
      obj.element.remove();
      return;
    }
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
/** Bathtubs, closets, and stair treads — not structural room dividers (px on 1024²). */
const MIN_INTERIOR_PARTITION_PX = 55;
/** Exterior shell classification tolerance — mirrors backend PERIMETER_WALL_TOL_PX. */
const PERIMETER_EDGE_TOL_PX = 14;
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

function wallSegmentLengthPx(seg: { x1: number; y1: number; x2: number; y2: number }): number {
  return Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
}

function perimeterTolerancePx(bounds: PixelBounds): number {
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  return Math.max(6, Math.min(PERIMETER_EDGE_TOL_PX, span * 0.028));
}

function isPerimeterWallSegment(
  seg: { x1: number; y1: number; x2: number; y2: number },
  bounds: PixelBounds
): boolean {
  const tol = perimeterTolerancePx(bounds);
  const horizontal = Math.abs(seg.x2 - seg.x1) >= Math.abs(seg.y2 - seg.y1);
  if (horizontal) {
    const y = (seg.y1 + seg.y2) / 2;
    return Math.abs(y - bounds.minY) <= tol || Math.abs(y - bounds.maxY) <= tol;
  }
  const x = (seg.x1 + seg.x2) / 2;
  return Math.abs(x - bounds.minX) <= tol || Math.abs(x - bounds.maxX) <= tol;
}

/** Keep perimeter envelope strokes; drop short interior fixture outlines. */
function filterStructuralWallSegments(
  walls: BlueprintWall[] | undefined,
  house: PixelBounds | null
): BlueprintWall[] {
  return (walls ?? []).filter((wall) => {
    const seg = wallEndpoints(wall);
    if (!seg) return false;
    const len = wallSegmentLengthPx(seg);
    if (house && isPerimeterWallSegment(seg, house)) return true;
    return len >= MIN_INTERIOR_PARTITION_PX;
  });
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

function isDoorDetection(det: BlueprintDetection): boolean {
  const id = String(det.id ?? "").toUpperCase();
  return id.startsWith("D") || detectionLabel(det).includes("door");
}

function isWindowDetection(det: BlueprintDetection): boolean {
  const id = String(det.id ?? "").toUpperCase();
  return id.startsWith("W") || detectionLabel(det).includes("window");
}

function openingIdSort(a: BlueprintDetection, b: BlueprintDetection): number {
  const idA = String(a.id ?? a.label ?? "");
  const idB = String(b.id ?? b.label ?? "");
  const numA = Number.parseInt(idA.replace(/\D/g, ""), 10) || 999;
  const numB = Number.parseInt(idB.replace(/\D/g, ""), 10) || 999;
  return numA - numB;
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

function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

function wallProjectionT(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { t: number; length: number; dist: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return { t: 0, length: 0, dist: Infinity };
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  return { t, length: Math.sqrt(lenSq), dist: Math.hypot(px - qx, py - qy) };
}

function nearWallJunction(
  px: number,
  py: number,
  walls: BlueprintWall[],
  radiusPx = DOOR_JUNCTION_RADIUS_PX
): boolean {
  let hits = 0;
  for (const wall of walls) {
    const seg = wallEndpoints(wall);
    if (!seg) continue;
    const { dist } = wallProjectionT(px, py, seg.x1, seg.y1, seg.x2, seg.y2);
    if (dist <= radiusPx) {
      hits++;
      if (hits >= 2) return true;
    }
  }
  return false;
}

function closestWallFootprint(
  px: number,
  py: number,
  walls: BlueprintWall[]
): { wall: BlueprintWall; dist: number; seg: { x1: number; y1: number; x2: number; y2: number } } | null {
  let best: {
    wall: BlueprintWall;
    dist: number;
    seg: { x1: number; y1: number; x2: number; y2: number };
  } | null = null;

  for (const wall of walls) {
    const seg = wallEndpoints(wall);
    if (!seg) continue;
    const dist = pointToSegmentDistance(px, py, seg.x1, seg.y1, seg.x2, seg.y2);
    if (!best || dist < best.dist) {
      best = { wall, dist, seg };
    }
  }
  return best;
}

function openingSpanPx(det: BlueprintDetection, imgW: number, imgH: number): number {
  const wPx = Math.max(8, parsePercent(det.width, imgW) || 40);
  const hPx = Math.max(8, parsePercent(det.height, imgH) || 40);
  return Math.max(wPx, hPx);
}

function doorWidthValid(det: BlueprintDetection, imgW: number, imgH: number): boolean {
  const span = openingSpanPx(det, imgW, imgH);
  return span >= DOOR_WIDTH_HARD_MIN_PX && span <= DOOR_WIDTH_HARD_MAX_PX;
}

function windowWidthValid(det: BlueprintDetection, imgW: number, imgH: number): boolean {
  const span = openingSpanPx(det, imgW, imgH);
  return span >= WINDOW_WIDTH_MIN_PX && span <= WINDOW_WIDTH_MAX_PX;
}

function nearStairTreads(
  px: number,
  py: number,
  walls: BlueprintWall[],
  searchRadius = STAIR_REJECT_RADIUS_PX
): boolean {
  const nearby: BlueprintWall[] = [];
  for (const wall of walls) {
    const seg = wallEndpoints(wall);
    if (!seg) continue;
    const { dist } = wallProjectionT(px, py, seg.x1, seg.y1, seg.x2, seg.y2);
    if (dist <= searchRadius) nearby.push(wall);
  }
  if (nearby.length < 4) return false;

  for (const horizontal of [true, false]) {
    const group = nearby.filter((wall) => {
      const seg = wallEndpoints(wall);
      if (!seg) return false;
      const isH = Math.abs(seg.x2 - seg.x1) >= Math.abs(seg.y2 - seg.y1);
      return isH === horizontal;
    });
    if (group.length < 4) continue;

    const positions = group
      .map((wall) => {
        const seg = wallEndpoints(wall)!;
        return horizontal ? (seg.y1 + seg.y2) / 2 : (seg.x1 + seg.x2) / 2;
      })
      .sort((a, b) => a - b);

    let cluster = 1;
    let maxCluster = 1;
    for (let i = 1; i < positions.length; i++) {
      if (positions[i] - positions[i - 1] <= 15) {
        cluster++;
        maxCluster = Math.max(maxCluster, cluster);
      } else {
        cluster = 1;
      }
    }
    if (maxCluster >= 4) return true;
  }
  return false;
}

function windowOnExterior(
  det: BlueprintDetection,
  walls: BlueprintWall[],
  house: PixelBounds | null,
  imgW: number,
  imgH: number
): boolean {
  if (!house) return false;
  const center = detectionCenter(det, imgW, imgH);
  if (!center) return false;
  const host = closestWallFootprint(center.cx, center.cy, walls);
  if (!host || host.dist > DOOR_WALL_SNAP_PX) return false;

  const tol = Math.max(12, Math.min(house.maxX - house.minX, house.maxY - house.minY) * 0.06);
  const { seg } = host;
  const horizontal = Math.abs(seg.x2 - seg.x1) >= Math.abs(seg.y2 - seg.y1);
  if (horizontal) {
    const y = (seg.y1 + seg.y2) / 2;
    return Math.abs(y - house.minY) <= tol || Math.abs(y - house.maxY) <= tol;
  }
  const x = (seg.x1 + seg.x2) / 2;
  return Math.abs(x - house.minX) <= tol || Math.abs(x - house.maxX) <= tol;
}

function doorOnValidHost(
  det: BlueprintDetection,
  walls: BlueprintWall[],
  house: PixelBounds | null,
  imgW: number,
  imgH: number,
  wallSnapPx = DOOR_WALL_SNAP_PX
): boolean {
  const center = detectionCenter(det, imgW, imgH);
  if (!center || walls.length === 0) return false;

  const host = closestWallFootprint(center.cx, center.cy, walls);
  if (!host || host.dist > wallSnapPx) return false;

  const { t, length } = wallProjectionT(
    center.cx,
    center.cy,
    host.seg.x1,
    host.seg.y1,
    host.seg.x2,
    host.seg.y2
  );
  if (length < 1e-3) return false;

  const endTol = Math.min(64, length * 0.24);
  const nearGap = t * length <= endTol || (1 - t) * length <= endTol;

  let onPerimeter = false;
  if (house) {
    const tol = Math.max(12, Math.min(house.maxX - house.minX, house.maxY - house.minY) * 0.06);
    const { seg } = host;
    const horizontal = Math.abs(seg.x2 - seg.x1) >= Math.abs(seg.y2 - seg.y1);
    if (horizontal) {
      const y = (seg.y1 + seg.y2) / 2;
      onPerimeter =
        Math.abs(y - house.minY) <= tol || Math.abs(y - house.maxY) <= tol;
    } else {
      const x = (seg.x1 + seg.x2) / 2;
      onPerimeter =
        Math.abs(x - house.minX) <= tol || Math.abs(x - house.maxX) <= tol;
    }
  }

  const atJunction = nearWallJunction(center.cx, center.cy, walls);
  if (onPerimeter) return false;
  return nearGap || atJunction;
}

function doorPriorityScore(
  det: BlueprintDetection,
  walls: BlueprintWall[],
  house: PixelBounds | null,
  imgW: number,
  imgH: number
): number {
  const center = detectionCenter(det, imgW, imgH);
  if (!center) return 0;
  let score = openingConfidence(det);
  const host = closestWallFootprint(center.cx, center.cy, walls);
  if (host) {
    score += Math.max(0, 12 - host.dist * 0.15);
    if (house) {
      const tol = Math.max(12, Math.min(house.maxX - house.minX, house.maxY - house.minY) * 0.06);
      const { seg } = host;
      const horizontal = Math.abs(seg.x2 - seg.x1) >= Math.abs(seg.y2 - seg.y1);
      const onShell = horizontal
        ? Math.abs((seg.y1 + seg.y2) / 2 - house.minY) <= tol ||
          Math.abs((seg.y1 + seg.y2) / 2 - house.maxY) <= tol
        : Math.abs((seg.x1 + seg.x2) / 2 - house.minX) <= tol ||
          Math.abs((seg.x1 + seg.x2) / 2 - house.maxX) <= tol;
      if (onShell) score += 18;
    }
  }
  if (nearWallJunction(center.cx, center.cy, walls)) score += 12;
  return score;
}

/** Strict filter — max 4 interior doors (D1–D4) and 3 exterior windows (W1–W3). */
function filterStrictOpenings(
  detections: BlueprintDetection[],
  walls: BlueprintWall[],
  house: PixelBounds | null,
  imgW: number,
  imgH: number,
  maxDoors = DOOR_MAX_COUNT,
  maxWindows = WINDOW_MAX_COUNT,
  nmsPx = DOOR_NMS_PX
): BlueprintDetection[] {
  const other = detections.filter((d) => !isDoorDetection(d) && !isWindowDetection(d));

  let doors = detections
    .filter(isDoorDetection)
    .filter((d) => openingConfidence(d) >= DOOR_MIN_CONFIDENCE)
    .filter((d) => doorWidthValid(d, imgW, imgH))
    .filter((d) => doorOnValidHost(d, walls, house, imgW, imgH))
    .filter((d) => {
      const c = detectionCenter(d, imgW, imgH);
      if (!c) return false;
      return !nearStairTreads(c.cx, c.cy, walls);
    });

  doors.sort(
    (a, b) =>
      doorPriorityScore(b, walls, house, imgW, imgH) -
      doorPriorityScore(a, walls, house, imgW, imgH)
  );

  const keptDoors: BlueprintDetection[] = [];
  for (const det of doors) {
    const center = detectionCenter(det, imgW, imgH);
    if (!center) continue;
    const duplicate = keptDoors.some((k) => {
      const kc = detectionCenter(k, imgW, imgH);
      if (!kc) return false;
      return Math.hypot(center.cx - kc.cx, center.cy - kc.cy) <= nmsPx;
    });
    if (duplicate) continue;
    keptDoors.push(det);
  }

  const clampedDoors = keptDoors.slice(0, maxDoors);
  clampedDoors.sort((a, b) => {
    const ac = detectionCenter(a, imgW, imgH);
    const bc = detectionCenter(b, imgW, imgH);
    if (!ac || !bc) return 0;
    return ac.cy - bc.cy || ac.cx - bc.cx;
  });

  const numberedDoors = clampedDoors.map((det, i) => ({
    ...det,
    id: `D${i + 1}`,
    label: `Door D${i + 1}`,
  }));

  let windows = detections
    .filter(isWindowDetection)
    .filter((d) => windowWidthValid(d, imgW, imgH))
    .filter((d) => windowOnExterior(d, walls, house, imgW, imgH))
    .filter((d) => {
      const c = detectionCenter(d, imgW, imgH);
      if (!c) return false;
      return !nearStairTreads(c.cx, c.cy, walls);
    });

  windows.sort((a, b) => openingConfidence(b) - openingConfidence(a));

  const keptWindows: BlueprintDetection[] = [];
  for (const det of windows) {
    const center = detectionCenter(det, imgW, imgH);
    if (!center) continue;
    const duplicate = keptWindows.some((k) => {
      const kc = detectionCenter(k, imgW, imgH);
      if (!kc) return false;
      return Math.hypot(center.cx - kc.cx, center.cy - kc.cy) <= OPENING_NMS_PX;
    });
    if (duplicate) continue;
    keptWindows.push(det);
  }

  const clampedWindows = keptWindows.slice(0, maxWindows);
  clampedWindows.sort((a, b) => {
    const ac = detectionCenter(a, imgW, imgH);
    const bc = detectionCenter(b, imgW, imgH);
    if (!ac || !bc) return 0;
    return ac.cy - bc.cy || ac.cx - bc.cx;
  });

  const numberedWindows = clampedWindows.map((det, i) => ({
    ...det,
    id: `W${i + 1}`,
    label: `Window W${i + 1}`,
  }));

  return [...numberedDoors, ...numberedWindows, ...other];
}

/** @deprecated Use filterStrictOpenings */
function filterStrictDoors(
  detections: BlueprintDetection[],
  walls: BlueprintWall[],
  house: PixelBounds | null,
  imgW: number,
  imgH: number,
  maxDoors = DOOR_MAX_COUNT,
  nmsPx = DOOR_NMS_PX
): BlueprintDetection[] {
  return filterStrictOpenings(detections, walls, house, imgW, imgH, maxDoors, WINDOW_MAX_COUNT, nmsPx);
}

/** Spatial NMS for window detections before 3D mounting. */
function dedupeWindowDetections(
  detections: BlueprintDetection[],
  imgW: number,
  imgH: number,
  nmsPx = OPENING_NMS_PX
): BlueprintDetection[] {
  const windows = detections.filter(isWindowDetection);
  const other = detections.filter((d) => !isWindowDetection(d));

  const ranked = [...windows].sort((a, b) => openingConfidence(b) - openingConfidence(a));
  const kept: BlueprintDetection[] = [];
  for (const det of ranked) {
    const center = detectionCenter(det, imgW, imgH);
    if (!center) continue;
    const duplicate = kept.some((k) => {
      const kc = detectionCenter(k, imgW, imgH);
      if (!kc) return false;
      return Math.hypot(center.cx - kc.cx, center.cy - kc.cy) <= nmsPx;
    });
    if (duplicate) continue;
    kept.push(det);
  }

  kept.sort((a, b) => {
    const ac = detectionCenter(a, imgW, imgH);
    const bc = detectionCenter(b, imgW, imgH);
    if (!ac || !bc) return 0;
    return ac.cy - bc.cy || ac.cx - bc.cx;
  });

  const numbered = kept.map((det, i) => ({
    ...det,
    id: `W${i + 1}`,
    label: `Window W${i + 1}`,
  }));

  return [...numbered, ...other];
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
    openings_schedule:
      (raw as Blueprint3DData).openings_schedule ??
      (raw as { openings_schedule?: OpeningsSchedule }).openings_schedule ??
      null,
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
 * Max distance (m) an opening may be moved to reach an interior wall.
 */
const INTERIOR_OPENING_SNAP_M = 0.85;

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

// ---------------------------------------------------------------------------
// Architectural dimensioning & room measurement
// ---------------------------------------------------------------------------

type HouseBuildResult = {
  roofGroup: THREE.Group;
  dimensionsGroup: THREE.Group;
  structuralWallCount: number;
  doorsMounted: number;
  windowsMounted: number;
  walkthroughNav: WalkthroughNavPoint[];
};

type InferredRoom = {
  name: string;
  cx: number;
  cz: number;
  areaSqM: number;
  areaSqFt: number;
};

type WalkthroughNavPoint = {
  id: string;
  label: string;
  emoji: string;
  x: number;
  z: number;
  lookAtX: number;
  lookAtZ: number;
};

type WalkthroughZone = WalkthroughNavPoint & {
  radius: number;
};

type TeleportState = {
  fromX: number;
  fromZ: number;
  fromYaw: number;
  toX: number;
  toZ: number;
  toYaw: number;
  startMs: number;
  durationMs: number;
};

function formatDimensionLabel(lengthM: number): string {
  return `${lengthM.toFixed(2)}m`;
}

function createCssLabel(
  text: string,
  className: string,
  y = DIM_LINE_Y + 0.35
): CSS2DObject {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = text;
  const label = new CSS2DObject(el);
  label.position.set(0, y, 0);
  return label;
}

function centerWallRunsAtOrigin(
  runs: WallRun[],
  cutout: CornerCutout | null
): { runs: WallRun[]; cutout: CornerCutout | null; offsetX: number; offsetZ: number } {
  if (runs.length === 0) return { runs, cutout, offsetX: 0, offsetZ: 0 };

  const bounds = boundsFromRuns(runs);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;

  const shiftRun = (run: WallRun): WallRun => ({
    ...run,
    sx: run.sx - cx,
    sz: run.sz - cz,
    ex: run.ex - cx,
    ez: run.ez - cz,
  });

  const shiftedCutout = cutout
    ? {
        ...cutout,
        minX: cutout.minX - cx,
        maxX: cutout.maxX - cx,
        minZ: cutout.minZ - cz,
        maxZ: cutout.maxZ - cz,
      }
    : null;

  return { runs: runs.map(shiftRun), cutout: shiftedCutout, offsetX: cx, offsetZ: cz };
}

/** Four continuous perimeter runs on the plan AABB (trimmed for porch cutouts). */
function buildPerimeterRuns(bounds: WallBounds, cutout: CornerCutout | null): WallRun[] {
  const { minX, maxX, minZ, maxZ } = bounds;
  const shell: WallRun[] = [
    { sx: minX, sz: minZ, ex: maxX, ez: minZ, depth: WALL_DEPTH_M },
    { sx: minX, sz: maxZ, ex: maxX, ez: maxZ, depth: WALL_DEPTH_M },
    { sx: minX, sz: minZ, ex: minX, ez: maxZ, depth: WALL_DEPTH_M },
    { sx: maxX, sz: minZ, ex: maxX, ez: maxZ, depth: WALL_DEPTH_M },
  ];
  if (cutout) return trimRunsAgainstCutout(shell, cutout, bounds);
  return shell;
}

function perimeterSide(run: WallRun, bounds: WallBounds): PerimeterSide | null {
  const axis = runAxis(run);
  if (axis === "x") {
    if (Math.abs(run.sz - bounds.minZ) <= PERIMETER_DEDUPE_TOL) return "back";
    if (Math.abs(run.sz - bounds.maxZ) <= PERIMETER_DEDUPE_TOL) return "front";
  } else {
    if (Math.abs(run.sx - bounds.minX) <= PERIMETER_DEDUPE_TOL) return "left";
    if (Math.abs(run.sx - bounds.maxX) <= PERIMETER_DEDUPE_TOL) return "right";
  }
  return null;
}

function isDuplicatePerimeterStroke(run: WallRun, bounds: WallBounds): boolean {
  const side = perimeterSide(run, bounds);
  if (!side) return false;
  const len = runLength(run);
  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;
  const minSpan = side === "back" || side === "front" ? spanX * 0.3 : spanZ * 0.3;
  return len >= minSpan;
}

function snapRunToEnvelope(run: WallRun, bounds: WallBounds): WallRun {
  const snap = (v: number, lo: number, hi: number) => {
    if (Math.abs(v - lo) <= INTERIOR_SNAP_DIST) return lo;
    if (Math.abs(v - hi) <= INTERIOR_SNAP_DIST) return hi;
    return v;
  };
  return {
    ...run,
    sx: snap(run.sx, bounds.minX, bounds.maxX),
    sz: snap(run.sz, bounds.minZ, bounds.maxZ),
    ex: snap(run.ex, bounds.minX, bounds.maxX),
    ez: snap(run.ez, bounds.minZ, bounds.maxZ),
  };
}

function prepareInteriorRuns(
  runs: WallRun[],
  bounds: WallBounds,
  minInteriorM: number
): WallRun[] {
  const minLen = Math.max(MIN_WALL_RUN_M, minInteriorM);
  const partitions = runs
    .filter((r) => !isDuplicatePerimeterStroke(r, bounds))
    .map((r) => snapRunToEnvelope(r, bounds))
    .filter((r) => runLength(r) >= minLen);
  const merged = collapseCoplanarRuns(partitions, 0.14);
  return weldRunCorners(merged);
}

function perimeterOutward(run: WallRun, bounds: WallBounds): THREE.Vector3 {
  switch (perimeterSide(run, bounds)) {
    case "back":
      return new THREE.Vector3(0, 0, -1);
    case "front":
      return new THREE.Vector3(0, 0, 1);
    case "left":
      return new THREE.Vector3(-1, 0, 0);
    case "right":
      return new THREE.Vector3(1, 0, 0);
    default: {
      const bcx = (bounds.minX + bounds.maxX) / 2;
      const bcz = (bounds.minZ + bounds.maxZ) / 2;
      const mx = (run.sx + run.ex) / 2;
      const mz = (run.sz + run.ez) / 2;
      if (runAxis(run) === "x") return new THREE.Vector3(0, 0, mz >= bcz ? 1 : -1);
      return new THREE.Vector3(mx >= bcx ? 1 : -1, 0, 0);
    }
  }
}

function findFrontPerimeterIndex(perimeterRuns: WallRun[], bounds: WallBounds): number {
  for (let i = 0; i < perimeterRuns.length; i++) {
    if (perimeterSide(perimeterRuns[i], bounds) === "front") return i;
  }
  return -1;
}

function anchorOnRuns(
  wx: number,
  wz: number,
  halfWidth: number,
  runs: WallRun[],
  runIndexOffset = 0
): (WallAnchor & { globalIndex: number }) | null {
  const anchor = anchorOpeningToRun(wx, wz, halfWidth, runs);
  if (!anchor) return null;
  return { ...anchor, globalIndex: runIndexOffset + anchor.runIndex };
}

function mountOpeningOnRun(
  ctx: BuildContext,
  run: WallRun,
  runIndex: number,
  anchor: WallAnchor,
  bounds: WallBounds,
  isWindow: boolean,
  openingW: number,
  size: { w: number; h: number },
  addCut: (runIndex: number, cut: RunCut) => void,
  forceOutward?: THREE.Vector3
) {
  const outward = forceOutward ?? perimeterOutward(run, bounds);
  const half = openingW / 2 + OPENING_CUT_PAD;
  const embed = embedInWall(anchor, WALL_DEPTH_M);

  if (isWindow) {
    const sillY = Math.max(0.35, WINDOW_CENTER_Y - size.h / 2 - 0.08);
    addCut(runIndex, {
      t0: anchor.t - half,
      t1: anchor.t + half,
      sillY,
      headY: Math.min(WALL_HEIGHT, WINDOW_CENTER_Y + size.h / 2 + 0.12),
    });
    addFramedWindow(ctx, embed.x, WINDOW_CENTER_Y, embed.z, size.w, size.h, outward);
    return;
  }

  addCut(runIndex, {
    t0: anchor.t - half,
    t1: anchor.t + half,
    sillY: 0,
    headY: Math.min(WALL_HEIGHT, DOOR_HEAD_Y),
  });
  addDynamicDoor(ctx, embed.x, 0, embed.z, outward);
}

function wallOutwardNormal(
  run: WallRun,
  runs: WallRun[],
  bounds: WallBounds,
  isExterior: boolean
): { x: number; z: number } {
  const bcx = (bounds.minX + bounds.maxX) / 2;
  const bcz = (bounds.minZ + bounds.maxZ) / 2;
  const mx = (run.sx + run.ex) / 2;
  const mz = (run.sz + run.ez) / 2;
  const axis = runAxis(run);

  if (isExterior) {
    if (axis === "x") return mz >= bcz ? { x: 0, z: 1 } : { x: 0, z: -1 };
    return mx >= bcx ? { x: 1, z: 0 } : { x: -1, z: 0 };
  }

  const len = runLength(run);
  const along = axis === "x" ? (run.sx + run.ex) / 2 : (run.sz + run.ez) / 2;
  const from = axis === "x" ? run.sz : run.sx;

  const countBlockers = (dir: 1 | -1): number => {
    let count = 0;
    for (const r of runs) {
      if (r === run || runAxis(r) !== axis) continue;
      const line = axis === "x" ? r.sz : r.sx;
      const delta = (line - from) * dir;
      if (delta <= 0.02) continue;
      const limit = axis === "x" ? bounds.maxZ - from : bounds.maxX - from;
      if (dir > 0 && delta > limit) continue;
      const lo = axis === "x" ? Math.min(r.sx, r.ex) : Math.min(r.sz, r.ez);
      const hi = axis === "x" ? Math.max(r.sx, r.ex) : Math.max(r.sz, r.ez);
      if (along < lo + 0.02 || along > hi - 0.02) continue;
      count++;
    }
    return count;
  };

  if (axis === "x") {
    if (countBlockers(1) <= countBlockers(-1)) return { x: 0, z: 1 };
    return { x: 0, z: -1 };
  }
  if (countBlockers(1) <= countBlockers(-1)) return { x: 1, z: 0 };
  return { x: -1, z: 0 };
}

/** Major perimeter walls plus the longest primary partition on each grid line. */
function selectDimensionRunIndices(
  runs: WallRun[],
  exterior: Set<number>
): number[] {
  const selected: number[] = [];
  const interiorBest = new Map<string, { index: number; len: number }>();

  runs.forEach((run, index) => {
    const len = runLength(run);
    if (len < MIN_DIMENSION_WALL_M) return;

    if (exterior.has(index)) {
      selected.push(index);
      return;
    }

    const axis = runAxis(run);
    const perp =
      axis === "x"
        ? Math.round(run.sz * 8) / 8
        : Math.round(run.sx * 8) / 8;
    const key = `int:${axis}:${perp}`;
    const prev = interiorBest.get(key);
    if (!prev || len > prev.len) interiorBest.set(key, { index, len });
  });

  for (const { index } of interiorBest.values()) selected.push(index);
  return selected;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function buildWalkthroughNavPoints(
  runs: WallRun[],
  cutout: CornerCutout | null,
  bounds: WallBounds
): WalkthroughNavPoint[] {
  const inferred = inferRoomsFromRuns(runs, cutout).sort((a, b) => b.areaSqM - a.areaSqM);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;

  const slotDefs: Array<{ id: string; label: string; emoji: string }> = [
    { id: "living", label: "Living Area", emoji: "🛋️" },
    { id: "bed1", label: "Bedroom 1", emoji: "🛏️" },
    { id: "bed2", label: "Bedroom 2", emoji: "🛏️" },
    { id: "dining", label: "Dining/Pantry", emoji: "🍳" },
  ];

  const fallbackOffsets: Array<[number, number]> = [
    [0, -spanZ * 0.12],
    [-spanX * 0.22, spanZ * 0.1],
    [spanX * 0.22, spanZ * 0.1],
    [0, spanZ * 0.22],
  ];

  const points: WalkthroughNavPoint[] = slotDefs.map((slot, i) => {
    const room = inferred[i];
    if (room) {
      return {
        ...slot,
        x: room.cx,
        z: room.cz,
        lookAtX: cx,
        lookAtZ: cz,
      };
    }
    const [ox, oz] = fallbackOffsets[i] ?? [0, 0];
    return {
      ...slot,
      x: cx + ox,
      z: cz + oz,
      lookAtX: cx,
      lookAtZ: cz,
    };
  });

  points.push({
    id: "entrance",
    label: "Front Entrance",
    emoji: "🚪",
    x: cx,
    z: bounds.maxZ - Math.max(0.65, spanZ * 0.08),
    lookAtX: cx,
    lookAtZ: cz,
  });

  return points;
}

function navPointsToZones(points: WalkthroughNavPoint[]): WalkthroughZone[] {
  return points.map((p) => ({
    ...p,
    radius: p.id === "entrance" ? 1.35 : 2.1,
  }));
}

function resolveRoomLabel(x: number, z: number, zones: WalkthroughZone[]): string {
  let best: WalkthroughZone | null = null;
  let bestDist = Infinity;
  for (const zone of zones) {
    const dist = Math.hypot(x - zone.x, z - zone.z);
    if (dist <= zone.radius && dist < bestDist) {
      best = zone;
      bestDist = dist;
    }
  }
  return best?.label ?? "Interior Hallway";
}

function yawToward(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.atan2(toX - fromX, toZ - fromZ);
}

function applyFirstPersonRotation(camera: THREE.PerspectiveCamera, yaw: number, pitch: number) {
  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

function roomNameForArea(areaSqFt: number, index: number): string {
  if (areaSqFt >= 200) return "Living Room";
  if (areaSqFt >= 140) return index % 2 === 0 ? "Bedroom 1" : "Bedroom 2";
  if (areaSqFt >= 100) return "Dining";
  if (areaSqFt >= 70) return "Bedroom";
  if (areaSqFt >= 45) return "Bathroom";
  return `Room ${index}`;
}

function inferRoomsFromRuns(
  runs: WallRun[],
  cutout: CornerCutout | null
): InferredRoom[] {
  const xs = [...new Set(runs.flatMap((r) => [r.sx, r.ex]))].sort((a, b) => a - b);
  const zs = [...new Set(runs.flatMap((r) => [r.sz, r.ez]))].sort((a, b) => a - b);
  const rooms: InferredRoom[] = [];
  let roomIndex = 1;

  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const x0 = xs[i];
      const x1 = xs[i + 1];
      const z0 = zs[j];
      const z1 = zs[j + 1];
      const width = x1 - x0;
      const depth = z1 - z0;
      if (width < MIN_ROOM_CELL_M || depth < MIN_ROOM_CELL_M) continue;

      const areaSqM = width * depth;
      if (areaSqM < MIN_ROOM_AREA_SQ_M) continue;

      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;

      if (
        cutout &&
        cx > cutout.minX &&
        cx < cutout.maxX &&
        cz > cutout.minZ &&
        cz < cutout.maxZ
      ) {
        continue;
      }

      let enclosed = 0;
      const edges: Array<["north" | "south" | "west" | "east", number, number]> = [
        ["north", x0, x1],
        ["south", x0, x1],
        ["west", z0, z1],
        ["east", z0, z1],
      ];
      for (const [edge, lo, hi] of edges) {
        const fixed =
          edge === "north"
            ? z0
            : edge === "south"
              ? z1
              : edge === "west"
                ? x0
                : x1;
        const covered = runs.some((r) => {
          if (edge === "north" || edge === "south") {
            if (runAxis(r) !== "x") return false;
            if (Math.abs(r.sz - fixed) > 0.28) return false;
            const rLo = Math.min(r.sx, r.ex);
            const rHi = Math.max(r.sx, r.ex);
            return rLo <= lo + 0.28 && rHi >= hi - 0.28;
          }
          if (runAxis(r) !== "z") return false;
          if (Math.abs(r.sx - fixed) > 0.28) return false;
          const rLo = Math.min(r.sz, r.ez);
          const rHi = Math.max(r.sz, r.ez);
          return rLo <= lo + 0.28 && rHi >= hi - 0.28;
        });
        if (covered) enclosed++;
      }
      if (enclosed < 3) continue;

      const areaSqFt = areaSqM * 10.7639;
      rooms.push({
        name: roomNameForArea(areaSqFt, roomIndex),
        cx,
        cz,
        areaSqM,
        areaSqFt: Math.round(areaSqFt),
      });
      roomIndex++;
    }
  }

  return rooms
    .sort((a, b) => b.areaSqM - a.areaSqM)
    .filter(
      (room, idx, arr) =>
        !arr
          .slice(0, idx)
          .some((other) => Math.hypot(other.cx - room.cx, other.cz - room.cz) < 1.2)
    );
}

function addWallDimensionLine(
  group: THREE.Group,
  run: WallRun,
  outward: { x: number; z: number },
  offsetM: number,
  lineMat: THREE.LineBasicMaterial,
  tickMat: THREE.LineBasicMaterial
) {
  const len = runLength(run);
  if (len < MIN_DIMENSION_WALL_M) return;

  const ox = outward.x * offsetM;
  const oz = outward.z * offsetM;
  const y = DIM_LINE_Y;

  const sx = run.sx + ox;
  const sz = run.sz + oz;
  const ex = run.ex + ox;
  const ez = run.ez + oz;

  const mainGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(sx, y, sz),
    new THREE.Vector3(ex, y, ez),
  ]);
  group.add(new THREE.Line(mainGeo, lineMat));

  const axis = runAxis(run);
  const tickDx = axis === "x" ? 0 : DIM_TICK_M;
  const tickDz = axis === "x" ? DIM_TICK_M : 0;

  for (const [px, pz] of [
    [sx, sz],
    [ex, ez],
  ] as const) {
    const tickGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(px - tickDx / 2, y, pz - tickDz / 2),
      new THREE.Vector3(px + tickDx / 2, y, pz + tickDz / 2),
    ]);
    group.add(new THREE.Line(tickGeo, tickMat));
  }

  const midX = (sx + ex) / 2 + outward.x * DIM_LABEL_PUSH_M;
  const midZ = (sz + ez) / 2 + outward.z * DIM_LABEL_PUSH_M;
  const label = createCssLabel(
    formatDimensionLabel(len),
    "pointer-events-none select-none whitespace-nowrap rounded-md border border-slate-700/80 bg-white/95 px-2 py-0.5 text-[10px] font-semibold tracking-tight text-slate-800 shadow-md"
  );
  label.position.set(midX, y + 0.04, midZ);
  group.add(label);
}

function buildDimensionOverlay(
  runs: WallRun[],
  exterior: Set<number>,
  cutout: CornerCutout | null
): THREE.Group {
  const group = new THREE.Group();
  group.name = "dimension-overlay";

  const bounds = boundsFromRuns(runs);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x334155, linewidth: 1 });
  const tickMat = new THREE.LineBasicMaterial({ color: 0x0f172a });

  const dimensioned = new Set<string>();
  const sideTiers = new Map<string, number>();
  const indices = selectDimensionRunIndices(runs, exterior);

  for (const index of indices) {
    const run = runs[index];
    const len = runLength(run);
    const isExterior = exterior.has(index);

    const axis = runAxis(run);
    const perp = axis === "x" ? run.sz : run.sx;
    const lo = axis === "x" ? Math.min(run.sx, run.ex) : Math.min(run.sz, run.ez);
    const hi = axis === "x" ? Math.max(run.sx, run.ex) : Math.max(run.sz, run.ez);
    const key = `${axis}:${Math.round(perp * 20)}:${Math.round(lo * 10)}:${Math.round(hi * 10)}`;
    if (dimensioned.has(key)) continue;
    dimensioned.add(key);

    const outward = wallOutwardNormal(run, runs, bounds, isExterior);
    const sideKey = `${outward.x},${outward.z}:${Math.round(perp * 4)}`;
    const tier = sideTiers.get(sideKey) ?? 0;
    sideTiers.set(sideKey, tier + 1);
    const offsetM = DIM_OFFSET_M + tier * DIM_OFFSET_TIER_M;

    addWallDimensionLine(group, run, outward, offsetM, lineMat, tickMat);
  }

  const rooms = inferRoomsFromRuns(runs, cutout);
  for (const room of rooms.slice(0, 6)) {
    const badge = createCssLabel(
      `${room.name}: ${room.areaSqFt} sq.ft`,
      "pointer-events-none select-none whitespace-nowrap rounded-full border border-[#D4AF37]/60 bg-slate-900/88 px-3 py-1 text-[11px] font-medium text-white shadow-lg backdrop-blur-sm",
      2.35
    );
    badge.position.set(room.cx, 2.35, room.cz);
    group.add(badge);
  }

  return group;
}

/** Blueprint-driven house from walls / openings / columns. */
function buildDynamicHouse(ctx: BuildContext, data: Blueprint3DData): HouseBuildResult {
  const imgW = data.image_width || 1024;
  const imgH = data.image_height || 1024;
  // Centre on the walls we are about to render so the geometry lands on the
  // origin exactly; the backend footprint is the fallback for wall-less payloads.
  const housePx =
    pixelBoundsFromWalls(data.walls) ?? houseBoundsToPixelBounds(data.house_bounds);
  const structuralWalls = filterStructuralWallSegments(data.walls, housePx);
  const { toX, toZ, scale } = createCoordMap(imgW, imgH, housePx);
  const minInteriorM = MIN_INTERIOR_PARTITION_PX * scale;

  // 1) Blueprint pixels -> world runs (fixture outlines already removed)
  const candidateRuns: WallRun[] = [];
  for (const wall of structuralWalls) {
    const seg = wallEndpoints(wall);
    if (!seg) continue;

    const segLenPx = wallSegmentLengthPx(seg);
    if (
      housePx &&
      !isPerimeterWallSegment(seg, housePx) &&
      segLenPx < MIN_INTERIOR_PARTITION_PX
    ) {
      continue;
    }

    const sx = toX(seg.x1);
    const sz = toZ(seg.y1);
    const ex = toX(seg.x2);
    const ez = toZ(seg.y2);
    if (Math.hypot(ex - sx, ez - sz) < minInteriorM) continue;

    candidateRuns.push({ sx, sz, ex, ez, depth: WALL_DEPTH_M });
  }

  // 2) Square up: strict orthogonal, double-wall merge, corner snap
  let runs = buildOrthogonalLayout(candidateRuns, scale);

  if (runs.length === 0) {
    return {
      roofGroup: new THREE.Group(),
      dimensionsGroup: new THREE.Group(),
      structuralWallCount: 0,
      doorsMounted: 0,
      windowsMounted: 0,
      walkthroughNav: [],
    };
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

  // Centre the entire building on world origin so the slab sits at (0, 0, 0).
  const centered = centerWallRunsAtOrigin(runs, cutout);
  runs = centered.runs;
  cutout = centered.cutout;
  const { offsetX, offsetZ } = centered;

  // 4) Solid exterior envelope + interior partitions that snap flush to it
  const envelopeBounds = boundsFromRuns(runs);
  const perimeterRuns = buildPerimeterRuns(envelopeBounds, cutout);
  const interiorRuns = prepareInteriorRuns(runs, envelopeBounds, minInteriorM);
  const allRuns = [...perimeterRuns, ...interiorRuns];
  const perimeterCount = perimeterRuns.length;
  const structuralWallCount = allRuns.length;

  const exterior = new Set<number>(
    Array.from({ length: perimeterCount }, (_, i) => i)
  );

  const closedBounds: WallBounds = { ...envelopeBounds };

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

  const rawOpenings = data.architectural_detections ?? [];
  const openingDetections = filterStrictOpenings(
    rawOpenings,
    data.walls ?? [],
    housePx,
    imgW,
    imgH
  );

  const doorDetections = openingDetections
    .filter(isDoorDetection)
    .sort(openingIdSort);
  const windowDetections = openingDetections
    .filter(isWindowDetection)
    .sort(openingIdSort);

  const doorMountNmsM = Math.max(0.95, DOOR_NMS_PX * scale);

  let doorsMounted = 0;
  let windowsMounted = 0;
  let frontDoorPlaced = false;

  type MountHost = "perimeter" | "front" | "interior" | "any";

  const tryMountOpening = (
    det: BlueprintDetection,
    isWindow: boolean,
    isDoor: boolean,
    host: MountHost = "any"
  ): boolean => {
    const center = detectionCenter(det, imgW, imgH);
    if (!center) return false;

    const size = detectionWorldSize(det, imgW, imgH, scale);
    const openingW = isDoor ? DOOR_OPENING_W : size.w;
    const wx = toX(center.cx) - offsetX;
    const wz = toZ(center.cy) - offsetZ;
    const half = openingW / 2 + OPENING_CUT_PAD;

    const frontIdx = findFrontPerimeterIndex(perimeterRuns, envelopeBounds);
    let anchor: (WallAnchor & { globalIndex: number }) | null = null;

    if (isDoor && host === "front" && frontIdx >= 0) {
      const frontRun = perimeterRuns[frontIdx];
      const frontAnchor = anchorOpeningToRun(wx, wz, half, [frontRun]);
      if (frontAnchor && frontAnchor.distance <= PERIMETER_OPENING_SNAP_M) {
        anchor = { ...frontAnchor, globalIndex: frontIdx };
      }
    } else if (isWindow || host === "perimeter") {
      anchor = anchorOnRuns(wx, wz, half, perimeterRuns);
    } else if (isDoor && host === "interior") {
      anchor = anchorOnRuns(wx, wz, half, interiorRuns, perimeterCount);
    } else if (isDoor && host === "front") {
      if (frontIdx >= 0) {
        const frontRun = perimeterRuns[frontIdx];
        const frontAnchor = anchorOpeningToRun(wx, wz, half, [frontRun]);
        if (frontAnchor && frontAnchor.distance <= PERIMETER_OPENING_SNAP_M) {
          anchor = { ...frontAnchor, globalIndex: frontIdx };
        }
      }
    } else if (isDoor) {
      anchor = anchorOnRuns(wx, wz, half, interiorRuns, perimeterCount);
    } else {
      anchor = anchorOnRuns(wx, wz, half, perimeterRuns);
    }

    if (!anchor) return false;

    const snapLimit =
      anchor.globalIndex >= perimeterCount
        ? INTERIOR_OPENING_SNAP_M
        : PERIMETER_OPENING_SNAP_M;
    if (anchor.distance > snapLimit) return false;

    const runIndex = anchor.globalIndex;
    const hostRun = allRuns[runIndex];
    if (!hostRun) return false;

    const embed = embedInWall(anchor, WALL_DEPTH_M);
    const mountNms = isDoor ? doorMountNmsM : OPENING_NMS_M;
    if (
      mountedOpenings.some(
        (p) => Math.hypot(p.x - embed.x, p.z - embed.z) < mountNms
      )
    ) {
      return false;
    }
    mountedOpenings.push({ x: embed.x, z: embed.z });

    if (isDoor && frontIdx >= 0 && runIndex === frontIdx) {
      frontDoorPlaced = true;
    }
    if (isDoor) doorsMounted++;
    if (isWindow) windowsMounted++;

    mountOpeningOnRun(
      ctx,
      hostRun,
      runIndex,
      anchor,
      envelopeBounds,
      isWindow,
      openingW,
      size,
      addCut
    );
    return true;
  };

  for (const det of windowDetections) {
    tryMountOpening(det, true, false, "perimeter");
  }

  doorDetections.forEach((det) => {
    tryMountOpening(det, false, true, "interior");
  });

  // No fallback phantom doors — only mount verified schedule detections.
  // 5) Extrude perimeter shell + interior partitions, then seal corners
  allRuns.forEach((run, i) => extrudeRun(ctx, run, cutsByRun.get(i) ?? []));
  addCornerPatches(ctx, allRuns);

  for (const det of data.structural_detections ?? []) {
    const center = detectionCenter(det, imgW, imgH);
    if (!center) continue;
    const col = shadowMesh(
      new THREE.Mesh(new THREE.BoxGeometry(0.42, WALL_HEIGHT, 0.42), ctx.materials.column)
    );
    col.position.set(
      toX(center.cx) - offsetX,
      WALL_HEIGHT / 2,
      toZ(center.cy) - offsetZ
    );
    ctx.group.add(col);
  }

  const dimensionsGroup = buildDimensionOverlay(allRuns, exterior, cutout);
  const roofGroup = addDynamicRoofAndSlab(ctx, closedBounds, cutout);
  const walkthroughNav = buildWalkthroughNavPoints(allRuns, cutout, closedBounds);
  return {
    roofGroup,
    dimensionsGroup,
    structuralWallCount,
    doorsMounted,
    windowsMounted,
    walkthroughNav,
  };
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export function FloorPlan3DViewport({
  data,
  detections,
  openingsSchedule: openingsScheduleProp,
  hasLiveResult = false,
  className = "",
}: FloorPlan3DViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const roofGroupRef = useRef<THREE.Group | null>(null);
  const dimensionsGroupRef = useRef<THREE.Group | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const houseGroupRef = useRef<THREE.Group | null>(null);
  const materialsRef = useRef<HouseMaterials | null>(null);
  const envGroupRef = useRef<THREE.Group | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const isWalkthroughRef = useRef(false);
  const keysPressed = useRef<Record<string, boolean>>({});
  const walkthroughNavRef = useRef<WalkthroughNavPoint[]>([]);
  const walkthroughZonesRef = useRef<WalkthroughZone[]>([]);
  const walkClockRef = useRef<THREE.Clock | null>(null);
  const lookYawRef = useRef(0);
  const lookPitchRef = useRef(0);
  const targetYawRef = useRef(0);
  const targetPitchRef = useRef(0);
  const isDraggingLookRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const teleportRef = useRef<TeleportState | null>(null);

  const [isNightMode, setIsNightMode] = useState(false);
  const [showRoof, setShowRoof] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);
  const [isWalkthrough, setIsWalkthrough] = useState(false);
  const [currentRoomLabel, setCurrentRoomLabel] = useState("Interior");
  const [activeNavId, setActiveNavId] = useState<string | null>(null);
  const [walkthroughNavPoints, setWalkthroughNavPoints] = useState<WalkthroughNavPoint[]>([]);
  const currentRoomRef = useRef("Interior");

  const blueprintData = useMemo(
    () => resolveBlueprintData(data, detections, hasLiveResult),
    [data, detections, hasLiveResult]
  );
  const openingsSchedule = useMemo(
    () =>
      openingsScheduleProp ??
      blueprintData?.openings_schedule ??
      null,
    [openingsScheduleProp, blueprintData]
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
    camera.position.set(0, 11, 16);
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

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0";
    labelRenderer.domElement.style.left = "0";
    labelRenderer.domElement.style.pointerEvents = "none";
    container.appendChild(labelRenderer.domElement);
    labelRendererRef.current = labelRenderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1.2, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.update();
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
      const built = buildDynamicHouse(buildCtx, blueprintData);
      roofGroupRef.current = built.roofGroup;
      dimensionsGroupRef.current = built.dimensionsGroup;
      walkthroughNavRef.current = built.walkthroughNav;
      walkthroughZonesRef.current = navPointsToZones(built.walkthroughNav);
      setWalkthroughNavPoints(built.walkthroughNav);
      dimensionsGroupRef.current.visible = showDimensions;
      if (built.roofGroup) {
        built.roofGroup.visible = showRoof;
      }
      houseGroup.add(built.dimensionsGroup);
      scene.add(houseGroup);
    } else {
      roofGroupRef.current = null;
      dimensionsGroupRef.current = null;
      walkthroughNavRef.current = [];
      walkthroughZonesRef.current = [];
      setWalkthroughNavPoints([]);
    }

    const walkClock = new THREE.Clock();
    walkClockRef.current = walkClock;
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);

      if (isWalkthroughRef.current && cameraRef.current) {
        const camera = cameraRef.current;
        const dt = Math.min(walkClock.getDelta(), 0.05);
        const teleport = teleportRef.current;

        lookYawRef.current += (targetYawRef.current - lookYawRef.current) * LOOK_DAMPING;
        lookPitchRef.current +=
          (targetPitchRef.current - lookPitchRef.current) * LOOK_DAMPING;
        applyFirstPersonRotation(camera, lookYawRef.current, lookPitchRef.current);

        if (teleport) {
          const elapsed = performance.now() - teleport.startMs;
          const t = Math.min(1, elapsed / teleport.durationMs);
          const eased = easeInOutCubic(t);
          camera.position.x = teleport.fromX + (teleport.toX - teleport.fromX) * eased;
          camera.position.z = teleport.fromZ + (teleport.toZ - teleport.fromZ) * eased;
          camera.position.y = EYE_LEVEL;
          const yaw =
            teleport.fromYaw + (teleport.toYaw - teleport.fromYaw) * eased;
          lookYawRef.current = yaw;
          targetYawRef.current = yaw;
          lookPitchRef.current = 0;
          targetPitchRef.current = 0;
          applyFirstPersonRotation(camera, yaw, 0);
          if (t >= 1) teleportRef.current = null;
        } else {
          const sprinting = keysPressed.current["shift"];
          const speed = (sprinting ? SPRINT_SPEED : WALK_SPEED) * dt;
          const dir = new THREE.Vector3();
          camera.getWorldDirection(dir);
          dir.y = 0;
          if (dir.lengthSq() > 1e-6) dir.normalize();
          const side = new THREE.Vector3(-dir.z, 0, dir.x);

          let moving = false;
          if (keysPressed.current["w"] || keysPressed.current["arrowup"]) {
            camera.position.addScaledVector(dir, speed);
            moving = true;
          }
          if (keysPressed.current["s"] || keysPressed.current["arrowdown"]) {
            camera.position.addScaledVector(dir, -speed);
            moving = true;
          }
          if (keysPressed.current["a"] || keysPressed.current["arrowleft"]) {
            camera.position.addScaledVector(side, -speed);
            moving = true;
          }
          if (keysPressed.current["d"] || keysPressed.current["arrowright"]) {
            camera.position.addScaledVector(side, speed);
            moving = true;
          }

          const bob = moving
            ? Math.sin(walkClock.getElapsedTime() * (sprinting ? 14 : 9)) *
              HEAD_BOB_AMPLITUDE
            : 0;
          camera.position.y = EYE_LEVEL + bob;
        }

        const room = teleport
          ? currentRoomRef.current
          : resolveRoomLabel(
              camera.position.x,
              camera.position.z,
              walkthroughZonesRef.current
            );
        if (room !== currentRoomRef.current) {
          currentRoomRef.current = room;
          setCurrentRoomLabel(room);
        }
      } else {
        controls.update();
      }

      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      labelRendererRef.current?.setSize(w, h);
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
      if (labelRenderer.domElement.parentNode === container) {
        container.removeChild(labelRenderer.domElement);
      }
      rendererRef.current = null;
      labelRendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      roofGroupRef.current = null;
      dimensionsGroupRef.current = null;
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
    if (dimensionsGroupRef.current) dimensionsGroupRef.current.visible = showDimensions;
  }, [showDimensions]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
      if (e.key === "Escape" && isWalkthroughRef.current) {
        exitWalkthroughRef.current?.();
      }
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

  const exitWalkthroughRef = useRef<(() => void) | null>(null);

  const teleportToNavPoint = (point: WalkthroughNavPoint) => {
    if (!cameraRef.current || !isWalkthroughRef.current) return;
    const camera = cameraRef.current;
    const toYaw = yawToward(point.x, point.z, point.lookAtX, point.lookAtZ);
    teleportRef.current = {
      fromX: camera.position.x,
      fromZ: camera.position.z,
      fromYaw: lookYawRef.current,
      toX: point.x,
      toZ: point.z,
      toYaw,
      startMs: performance.now(),
      durationMs: TELEPORT_DURATION_MS,
    };
    setActiveNavId(point.id);
    setCurrentRoomLabel(point.label);
    currentRoomRef.current = point.label;
  };

  const enterWalkthrough = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    setIsWalkthrough(true);
    setShowRoof(false);
    controlsRef.current.enabled = false;
    const entrance =
      walkthroughNavRef.current.find((p) => p.id === "entrance") ??
      walkthroughNavRef.current[0];
    const startX = entrance?.x ?? 0;
    const startZ = entrance?.z ?? 3;
    const startYaw = entrance
      ? yawToward(startX, startZ, entrance.lookAtX, entrance.lookAtZ)
      : Math.PI;
    lookYawRef.current = startYaw;
    targetYawRef.current = startYaw;
    lookPitchRef.current = 0;
    targetPitchRef.current = 0;
    cameraRef.current.position.set(startX, EYE_LEVEL, startZ);
    applyFirstPersonRotation(cameraRef.current, startYaw, 0);
    teleportRef.current = null;
    walkClockRef.current?.start();
    setActiveNavId(entrance?.id ?? null);
    setCurrentRoomLabel(entrance?.label ?? "Front Entrance");
    currentRoomRef.current = entrance?.label ?? "Front Entrance";
  };

  const exitWalkthrough = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    setIsWalkthrough(false);
    setShowRoof(true);
    setActiveNavId(null);
    teleportRef.current = null;
    isDraggingLookRef.current = false;
    controlsRef.current.enabled = true;
    cameraRef.current.rotation.set(0, 0, 0);
    cameraRef.current.position.set(0, 11, 16);
    controlsRef.current.target.set(0, 1.2, 0);
    controlsRef.current.update();
  };

  exitWalkthroughRef.current = exitWalkthrough;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isWalkthrough) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      isDraggingLookRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      container.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingLookRef.current || !isWalkthroughRef.current) return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      targetYawRef.current -= dx * LOOK_SENSITIVITY;
      targetPitchRef.current = Math.max(
        -Math.PI / 2 + 0.08,
        Math.min(Math.PI / 2 - 0.08, targetPitchRef.current - dy * LOOK_SENSITIVITY)
      );
    };

    const endDrag = (e: PointerEvent) => {
      isDraggingLookRef.current = false;
      if (container.hasPointerCapture(e.pointerId)) {
        container.releasePointerCapture(e.pointerId);
      }
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", endDrag);
    container.addEventListener("pointercancel", endDrag);
    container.addEventListener("pointerleave", endDrag);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", endDrag);
      container.removeEventListener("pointercancel", endDrag);
      container.removeEventListener("pointerleave", endDrag);
    };
  }, [isWalkthrough]);

  const wallCount = useMemo(() => {
    const fromDetections =
      detections?.filter(
        (d) =>
          d.kind === "wall" ||
          /wall|partition|boundary/.test(`${d.id} ${d.label}`.toLowerCase())
      ).length ?? 0;
    if (fromDetections > 0) return fromDetections;
    return blueprintData?.walls?.length ?? 0;
  }, [detections, blueprintData?.walls]);

  const doorCount =
    openingsSchedule?.totalDoors ??
    blueprintData?.architectural_detections?.filter(isDoorDetection).length ??
    0;
  const windowCount =
    openingsSchedule?.totalWindows ??
    blueprintData?.architectural_detections?.filter(isWindowDetection).length ??
    0;
  const columnCount = blueprintData?.structural_detections?.length ?? 0;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]">
            Premium BIM Viewport
          </p>
          <h2 className="mt-0.5 text-lg font-bold text-slate-900">3D Floor Plan View</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {hasRealWalls
              ? `${wallCount} walls · ${doorCount} door${doorCount === 1 ? "" : "s"} · ${windowCount} window${windowCount === 1 ? "" : "s"} · ${columnCount} column${columnCount === 1 ? "" : "s"} · Blueprint-driven`
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
            onClick={() => setShowDimensions((v) => !v)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all ${
              showDimensions
                ? "border-slate-700 bg-slate-800 font-bold text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {showDimensions ? "📏 Dimensions: ON" : "📏 Dimensions: OFF"}
          </button>

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
          className={`relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-inner sm:aspect-[16/10] ${
            isWalkthrough ? "cursor-grab active:cursor-grabbing" : ""
          }`}
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

        {isWalkthrough && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-6 z-30 flex justify-center px-4 sm:top-8">
              <div className="max-w-2xl rounded-2xl border border-white/20 bg-slate-900/55 px-4 py-2.5 text-center shadow-2xl backdrop-blur-xl sm:px-6">
                <p className="text-[11px] font-semibold tracking-wide text-white sm:text-xs">
                  📍 Inside: {currentRoomLabel} • Elevation: {EYE_LEVEL.toFixed(2)}m • WASD to
                  move • Hold Shift to Sprint
                </p>
                <p className="mt-0.5 text-[10px] text-slate-300 sm:hidden">
                  Drag to look around
                </p>
              </div>
            </div>

            <div className="absolute right-6 top-6 z-30 sm:right-8 sm:top-8">
              <button
                type="button"
                onClick={exitWalkthrough}
                className="inline-flex items-center gap-2 rounded-full border border-rose-300/40 bg-rose-950/75 px-4 py-2 text-xs font-bold text-rose-100 shadow-2xl backdrop-blur-md transition-all hover:bg-rose-900/90"
              >
                <X className="h-4 w-4" />
                Exit Walkthrough (Esc)
              </button>
            </div>

            <div className="absolute inset-x-0 bottom-6 z-30 flex justify-center px-3 sm:bottom-8 sm:px-6">
              <div className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/15 bg-slate-900/50 p-1.5 shadow-2xl backdrop-blur-xl sm:gap-2 sm:p-2">
                {walkthroughNavPoints.map((point) => (
                  <button
                    key={point.id}
                    type="button"
                    onClick={() => teleportToNavPoint(point)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-semibold transition-all sm:px-3.5 sm:text-xs ${
                      activeNavId === point.id
                        ? "border-[#D4AF37]/70 bg-[#D4AF37]/20 text-white shadow-inner"
                        : "border-white/10 bg-white/5 text-slate-100 hover:border-white/25 hover:bg-white/10"
                    }`}
                  >
                    <span aria-hidden>{point.emoji}</span>
                    {point.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {!isWalkthrough && (
          <div className="absolute bottom-8 right-8 z-10">
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
          </div>
        )}

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

      <OpeningsScheduleCard
        schedule={openingsSchedule}
        hasLiveResult={hasLiveResult && hasRealWalls}
      />
    </div>
  );
}

export default FloorPlan3DViewport;
