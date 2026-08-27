"use client";

/**
 * Photorealistic BIM 3D viewport — Three.js / WebGL.
 *
 * Grass lawn + asphalt driveway, plaster walls, oak wood deck accents,
 * MeshPhysicalMaterial glass, soft PCF sun shadows, translucent roof slab,
 * solar trajectory arc, and passive cross-ventilation wind vectors.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Box, Sofa, Sparkles, Sun, Wind } from "lucide-react";
import type {
  ArchitecturalAudit,
  DetectionBox,
  GcrRecommendation,
} from "@/lib/clash-detection";
import {
  applyBimClashPose,
  bindBimClashColumns,
  bimUrlCandidates,
  enableBimShadows,
  fitBimModelToLawn,
  restoreBimColumnMaterials,
  type BimColumnAnim,
  type BimLoadStatus,
} from "@/lib/bim-models";
import { cn } from "@/lib/utils";

export type MaquetteViewMode = "original" | "corrected";

const CANVAS_PX = 1024;
const WORLD_SIZE = 24;

const WALL_HEIGHT = 3.0;
const COLUMN_HEIGHT = 3.0;
const DOOR_HEIGHT = 2.1;
const WINDOW_HEIGHT = 1.2;
const WINDOW_ELEVATION = 1.0;
const ROOF_Y = 3.0;
/** Standard masonry wall thickness (thin axis). */
const WALL_THICKNESS = 0.18;
/** Structural column cross-section — thicker than walls so pillars read clearly. */
const COLUMN_SIZE = 0.32;
/** World-unit pad so intersecting wall boxes visually miter at corners. */
const WALL_CORNER_PAD = 0.22;
const WALL_PROXIMITY_EPS = 0.4;

/* --- BIM sanitization: grid snapping & angle straightening ---------------- */
/**
 * Endpoint weld tolerance, authored in source-image pixels because that is the
 * unit the AI noise lives in, then converted to world units once.
 */
const SNAP_TOLERANCE_PX = 10;
const PX_TO_WORLD = WORLD_SIZE / CANVAS_PX;
const SNAP_TOLERANCE = SNAP_TOLERANCE_PX * PX_TO_WORLD;
/** Bearings within this many degrees of an axis are forced onto that axis. */
const ANGLE_SNAP_DEG = 5;
/** Below this, two floats are the same coordinate. */
const COORD_EPS = 1e-6;

const GOLD = 0xd4af37;
const SUN_COLOR = 0xf5a623;
const WIND_COLOR = 0x38bdf8;
const EDGE_COLOR = 0x64748b;
const COLUMN_CLASH = 0xea580c;
const COLUMN_RESOLVED = 0x10b981;
const WALL_PLASTER = 0xf8fafc;
const WOOD_OAK = 0x854d0e;
const GRASS_BASE = 0x10b981;
const DRIVEWAY = 0x334155;
const GLASS_COLOR = 0x818cf8;
const ROOF_SLATE = 0x334155;
const FRAME_CHARCOAL = 0x1e1e24;
const WINDOW_GLASS = 0x38bdf8;
const DOOR_LEAF = 0x78350f;
/** ~35° ajar swing on the door hinge. */
const DOOR_AJAR_RAD = 0.6;
/**
 * Door/window frame depth — slightly thicker than WALL_THICKNESS so charcoal
 * sashes protrude on both faces of the white wall (no Z-fighting / swallow).
 */
const OPENING_FRAME_DEPTH = 0.24;
const OPENING_FRAME_THIN = 0.035;

/* --- Virtual staging: interior furnishing palette ------------------------- */
const BED_FRAME_OAK = 0x78350f;
const BED_SHEET_WHITE = 0xffffff;
const BED_PILLOW = 0xf1f5f9;
const SOFA_CHARCOAL = 0x334155;
const TABLE_TOP_OAK = 0x9a3412;
const TABLE_LEG_BLACK = 0x0f172a;
const COUNTER_MARBLE = 0xf8fafc;
const FAUCET_STEEL = 0x94a3b8;
const BASIN_STEEL = 0xcbd5e1;
const PLANT_POT_CLAY = 0xd97706;
const PLANT_FOLIAGE = 0x059669;

/**
 * Furnishing dimensions in metres (1 world unit ≈ 1 m at WORLD_SIZE = 24).
 * Plan extents come from the YOLOv8 footprint; heights stay ergonomic so a
 * mis-sized detection never produces an absurd silhouette.
 */
const BED_BASE_H = 0.3;
const BED_MATTRESS_H = 0.26;
const BED_HEADBOARD_H = 0.52;
const PILLOW_H = 0.13;
const SOFA_PLINTH_H = 0.17;
const SOFA_SEAT_H = 0.23;
const SOFA_BACK_H = 0.86;
const SOFA_ARM_H = 0.62;
const TABLE_TOP_Y = 0.75;
const TABLE_TOP_H = 0.06;
const TABLE_LEG_R = 0.035;
const COUNTER_H = 0.9;
const COUNTER_SLAB_H = 0.08;
const POT_H = 0.3;
/** Inset from the footprint corner so planters sit inside the room, not in the wall. */
const PLANT_CORNER_INSET = 0.85;
/** A corner is skipped when furniture already occupies this radius. */
const PLANT_CLEARANCE = 1.1;

type ArchRole = "wall" | "column" | "door" | "window";

/** Furnishings we build parametric models for; anything else stays unrendered. */
type FurnitureKind = "bed" | "sofa" | "table" | "sink";

type FloorPlan3DViewportProps = {
  detections: DetectionBox[];
  recommendations?: GcrRecommendation[];
  /** Passive design audit — drives wind vectors for PASSED rooms. */
  architecturalAudit?: ArchitecturalAudit | null;
  viewMode?: MaquetteViewMode;
  hasLiveResult?: boolean;
  className?: string;
  /**
   * Active portfolio project name — resolves `/models/{slug}.glb`
   * (e.g. "Southern Farmhouse" → southern_farmhouse.glb).
   */
  projectName?: string | null;
  /** Explicit glTF/GLB URL override (skips the project-name catalog). */
  modelUrl?: string | null;
  /**
   * When true (default), prefer a loaded BIM `.glb` over the procedural
   * extrusion. Falls back to procedural if every candidate URL fails.
   */
  preferBimModel?: boolean;
};

const FURNITURE_KEYWORDS = [
  "sofa",
  "couch",
  "bed",
  "table",
  "desk",
  "chair",
  "sink",
  "toilet",
  "bathtub",
  "bath",
  "fridge",
  "refrigerator",
  "oven",
  "stove",
  "cabinet",
  "cupboard",
  "shelf",
  "tv",
  "plant",
  "person",
  "car",
  "bicycle",
  "furniture",
  "counter",
  "appliance",
  "wardrobe",
  "dresser",
];

type ColumnAnimState = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  origin: THREE.Vector3;
  corrected: THREE.Vector3;
  isClash: boolean;
};

/** Procedural seamless textures (no external asset dependency). */
function makeCanvasTexture(
  size: number,
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
  repeat = 8
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas unavailable for procedural texture");
  }
  paint(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function createGrassTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    256,
    (ctx, size) => {
      ctx.fillStyle = "#059669";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 4200; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const h = 2 + Math.random() * 5;
        const shade = 100 + Math.floor(Math.random() * 80);
        ctx.strokeStyle = `rgb(${40 + Math.random() * 30},${shade},${60 + Math.random() * 40})`;
        ctx.lineWidth = 0.8 + Math.random();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 2, y - h);
        ctx.stroke();
      }
      // Subtle patch variation
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(16,185,129,${0.08 + Math.random() * 0.12})`;
        ctx.beginPath();
        ctx.ellipse(
          Math.random() * size,
          Math.random() * size,
          8 + Math.random() * 18,
          6 + Math.random() * 12,
          Math.random() * Math.PI,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    },
    14
  );
}

function createWoodTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    256,
    (ctx, size) => {
      ctx.fillStyle = "#854D0E";
      ctx.fillRect(0, 0, size, size);
      const plankH = size / 8;
      for (let row = 0; row < 8; row++) {
        const y = row * plankH;
        const tone = 110 + ((row * 17) % 40);
        ctx.fillStyle = `rgb(${tone},${70 + (row % 3) * 8},${20})`;
        ctx.fillRect(0, y, size, plankH - 1);
        // Grain lines
        for (let g = 0; g < 18; g++) {
          ctx.strokeStyle = `rgba(60,30,8,${0.15 + Math.random() * 0.25})`;
          ctx.lineWidth = 0.6;
          const gy = y + 2 + Math.random() * (plankH - 4);
          ctx.beginPath();
          ctx.moveTo(0, gy);
          for (let x = 0; x <= size; x += 16) {
            ctx.lineTo(x, gy + Math.sin(x * 0.08 + row) * 1.2);
          }
          ctx.stroke();
        }
        // Plank seam
        ctx.fillStyle = "rgba(40,20,5,0.55)";
        ctx.fillRect(0, y + plankH - 1.5, size, 1.5);
      }
    },
    6
  );
}

function createPlasterTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    128,
    (ctx, size) => {
      ctx.fillStyle = "#F1F5F9";
      ctx.fillRect(0, 0, size, size);
      const img = ctx.getImageData(0, 0, size, size);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 14;
        img.data[i] = Math.min(255, Math.max(0, 241 + n));
        img.data[i + 1] = Math.min(255, Math.max(0, 245 + n));
        img.data[i + 2] = Math.min(255, Math.max(0, 249 + n));
      }
      ctx.putImageData(img, 0, 0);
    },
    4
  );
}

function createAsphaltTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    128,
    (ctx, size) => {
      ctx.fillStyle = "#334155";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 900; i++) {
        const g = 40 + Math.floor(Math.random() * 50);
        ctx.fillStyle = `rgba(${g},${g},${g + 10},0.35)`;
        ctx.fillRect(
          Math.random() * size,
          Math.random() * size,
          1 + Math.random() * 2,
          1 + Math.random() * 2
        );
      }
      // Dashed road stripe suggestion
      ctx.strokeStyle = "rgba(226,232,240,0.35)";
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(size * 0.5, 0);
      ctx.lineTo(size * 0.5, size);
      ctx.stroke();
    },
    6
  );
}

function parsePercent(value: string | undefined): number {
  if (!value) return 0;
  const n = Number.parseFloat(String(value).replace("%", ""));
  return Number.isFinite(n) ? n / 100 : 0;
}

function boxToWorld(box: DetectionBox, translateX = 0, translateY = 0) {
  const left = parsePercent(box.left);
  const top = parsePercent(box.top);
  const w = Math.max(0.004, parsePercent(box.width));
  const h = Math.max(0.004, parsePercent(box.height));
  const tx = translateX / CANVAS_PX;
  const ty = translateY / CANVAS_PX;
  const cx = left + w / 2 + tx;
  const cy = top + h / 2 + ty;
  return {
    x: (cx - 0.5) * WORLD_SIZE,
    z: (cy - 0.5) * WORLD_SIZE,
    sx: Math.max(0.08, w * WORLD_SIZE),
    sz: Math.max(0.08, h * WORLD_SIZE),
  };
}

/** Case-insensitive haystack combining id + label, e.g. "w17 window w17 [52%]". */
function labelOf(box: DetectionBox): string {
  return `${box.id ?? ""} ${box.label ?? ""}`.toLowerCase();
}

function isFurnitureLabel(box: DetectionBox): boolean {
  return FURNITURE_KEYWORDS.some((k) => labelOf(box).includes(k));
}

/**
 * Case-insensitive, label-first classifier.
 *
 * Backend YOLOv8 labels arrive as `"Window W17 [52%]"`, `"Column C9 [96%]"`,
 * etc. We lowercase and substring-match so casing / suffixes never fall through
 * to a generic gray box. `kind` / `wallType` are used only as a fallback.
 */
function classifyArchRole(box: DetectionBox): ArchRole | null {
  if (isFurnitureLabel(box)) return null;

  const label = labelOf(box);

  // 1) Explicit label keywords win (case-insensitive substring match)
  if (label.includes("window")) return "window";
  if (label.includes("door")) return "door";
  if (label.includes("column") || label.includes("pillar")) return "column";
  if (
    label.includes("wall") ||
    label.includes("partition") ||
    label.includes("boundary") ||
    label.includes("load-bearing")
  ) {
    return "wall";
  }

  // 2) Structured hints from the normalizer
  if (box.kind === "column") return "column";
  if (box.kind === "wall" || box.wallType) return "wall";

  // 3) Loose id conventions (D1 → door, W1 → window)
  const id = (box.id ?? "").toLowerCase();
  if (/^d\d/.test(id)) return "door";
  if (/^w\d/.test(id)) return "window";
  if (/^c\d/.test(id) || /^ai-c\d/.test(id)) return "column";

  // Unrecognized openings are intentionally skipped (no gray box)
  if (box.kind === "opening") return null;
  return null;
}

function roleExtrusion(role: ArchRole): { height: number; elevation: number } {
  switch (role) {
    case "wall":
      return { height: WALL_HEIGHT, elevation: 0 };
    case "column":
      return { height: COLUMN_HEIGHT, elevation: 0 };
    case "door":
      return { height: DOOR_HEIGHT, elevation: 0 };
    case "window":
      return { height: WINDOW_HEIGHT, elevation: WINDOW_ELEVATION };
  }
}

function disposeMaterial(mat: THREE.Material) {
  mat.dispose();
}

function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => disposeMaterial(m));
    } else if (mat) {
      disposeMaterial(mat as THREE.Material);
    }
  });
}

/** Release a WebGLRenderer completely — critical for Next.js HMR context limits. */
function disposeWebGLRenderer(
  renderer: THREE.WebGLRenderer,
  mount: HTMLElement | null
) {
  try {
    renderer.setAnimationLoop(null);
  } catch {
    /* ignore */
  }
  try {
    // Force the browser to drop the underlying WebGL context immediately
    renderer.forceContextLoss();
  } catch {
    /* ignore */
  }
  try {
    renderer.dispose();
  } catch {
    /* ignore */
  }
  const el = renderer.domElement;
  if (el?.parentNode) {
    el.parentNode.removeChild(el);
  } else if (mount && el && mount.contains(el)) {
    mount.removeChild(el);
  }
}

function addEdges(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  color: number
) {
  const edges = new THREE.EdgesGeometry(geometry, 20);
  const lines = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
    })
  );
  parent.add(lines);
}

function idsMatchLoose(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** Axis-aligned footprint of walls/columns in world XZ (building-local). */
function computeBuildingFootprint(detections: DetectionBox[]): {
  cx: number;
  cz: number;
  sx: number;
  sz: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let count = 0;

  for (const box of detections) {
    const role = classifyArchRole(box);
    if (role !== "wall" && role !== "column") continue;
    const foot = boxToWorld(box);
    minX = Math.min(minX, foot.x - foot.sx / 2);
    maxX = Math.max(maxX, foot.x + foot.sx / 2);
    minZ = Math.min(minZ, foot.z - foot.sz / 2);
    maxZ = Math.max(maxZ, foot.z + foot.sz / 2);
    count += 1;
  }

  if (!count || !Number.isFinite(minX)) {
    return { cx: 0, cz: 0, sx: WORLD_SIZE * 0.72, sz: WORLD_SIZE * 0.72 };
  }

  const pad = 0.35;
  return {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    sx: Math.max(2, maxX - minX + pad * 2),
    sz: Math.max(2, maxZ - minZ + pad * 2),
  };
}

function openingWorldPoint(box: DetectionBox): THREE.Vector3 {
  const foot = boxToWorld(box);
  const role = classifyArchRole(box);
  const y =
    role === "window"
      ? WINDOW_ELEVATION + WINDOW_HEIGHT * 0.55
      : role === "door"
        ? DOOR_HEIGHT * 0.55
        : WALL_HEIGHT * 0.45;
  return new THREE.Vector3(foot.x, y, foot.z);
}

function findOpeningById(
  detections: DetectionBox[],
  openingId: string
): DetectionBox | undefined {
  const key = openingId.toLowerCase();
  return detections.find(
    (d) =>
      idsMatchLoose(d.id, key) ||
      d.id.toLowerCase().includes(key) ||
      key.includes(d.id.toLowerCase())
  );
}

/** Gold dashed solar arc East → apex → West (North-up: +X East, −X West). */
function buildSolarTrajectory(parent: THREE.Group) {
  const east = new THREE.Vector3(16, 2.2, 0);
  const apex = new THREE.Vector3(0, 14.5, 0);
  const west = new THREE.Vector3(-16, 2.2, 0);
  const curve = new THREE.QuadraticBezierCurve3(east, apex, west);
  const points = curve.getPoints(64);
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineDashedMaterial({
    color: GOLD,
    dashSize: 0.55,
    gapSize: 0.28,
    transparent: true,
    opacity: 0.9,
    linewidth: 1,
  });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  parent.add(line);

  // Soft glow ribbon under the dashed path
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 48, 0.04, 8, false),
    new THREE.MeshBasicMaterial({
      color: GOLD,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    })
  );
  parent.add(tube);

  // Physical glowing sun on the West
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 32, 32),
    new THREE.MeshStandardMaterial({
      color: SUN_COLOR,
      emissive: SUN_COLOR,
      emissiveIntensity: 1.35,
      roughness: 0.25,
      metalness: 0.1,
    })
  );
  sunMesh.position.copy(west).setY(11.5);
  sunMesh.position.x = -14.5;
  parent.add(sunMesh);

  const sunAura = new THREE.Mesh(
    new THREE.SphereGeometry(1.35, 24, 24),
    new THREE.MeshBasicMaterial({
      color: SUN_COLOR,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })
  );
  sunAura.position.copy(sunMesh.position);
  parent.add(sunAura);

  const sunLight = new THREE.PointLight(SUN_COLOR, 1.8, 55, 2);
  sunLight.position.copy(sunMesh.position);
  parent.add(sunLight);
}

/** Smooth translucent breeze tubes through opposite openings. */
function buildWindFlowVectors(
  parent: THREE.Group,
  detections: DetectionBox[],
  audit: ArchitecturalAudit | null | undefined
) {
  const passedRooms =
    audit?.crossVentilation.rooms.filter((r) => r.status === "PASSED") ?? [];

  const pairs: Array<[THREE.Vector3, THREE.Vector3]> = [];

  for (const room of passedRooms) {
    const pts: THREE.Vector3[] = [];
    for (const oid of room.openingIds) {
      const box = findOpeningById(detections, oid);
      if (!box) continue;
      const role = classifyArchRole(box);
      if (role !== "window" && role !== "door" && box.kind !== "opening") {
        continue;
      }
      pts.push(openingWorldPoint(box));
    }
    if (pts.length >= 2) {
      pairs.push([pts[0], pts[pts.length - 1]]);
      if (pts.length >= 3) {
        pairs.push([pts[0], pts[1]]);
        pairs.push([pts[1], pts[pts.length - 1]]);
      }
    }
  }

  // Fallback: opposite window pairs when audit has global PASS but sparse rooms
  if (
    pairs.length === 0 &&
    audit?.crossVentilation.status === "PASSED"
  ) {
    const windows = detections.filter((d) => classifyArchRole(d) === "window");
    if (windows.length >= 2) {
      const a = openingWorldPoint(windows[0]);
      const b = openingWorldPoint(windows[windows.length - 1]);
      pairs.push([a, b]);
    }
  }

  // Evaluation fallback: synthesize breeze between spatially opposite openings
  if (pairs.length === 0) {
    const openings = detections.filter((d) => {
      const role = classifyArchRole(d);
      return role === "window" || role === "door";
    });
    if (openings.length >= 2) {
      const pts = openings.map((o) => ({
        box: o,
        p: openingWorldPoint(o),
      }));
      let best: [THREE.Vector3, THREE.Vector3] | null = null;
      let bestDist = 0;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = pts[i].p.distanceTo(pts[j].p);
          if (d > bestDist) {
            bestDist = d;
            best = [pts[i].p, pts[j].p];
          }
        }
      }
      if (best && bestDist > 1.5) pairs.push(best);
    }
  }

  const windMat = new THREE.MeshStandardMaterial({
    color: WIND_COLOR,
    emissive: WIND_COLOR,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.38,
    roughness: 0.4,
    metalness: 0.05,
    depthWrite: false,
  });

  for (const [from, to] of pairs.slice(0, 6)) {
    const mid = from.clone().lerp(to, 0.5);
    mid.y += 0.55 + Math.min(1.2, from.distanceTo(to) * 0.08);
    // Slight lateral drift for a natural breeze path
    mid.x += (to.z - from.z) * 0.08;
    mid.z -= (to.x - from.x) * 0.08;

    const curve = new THREE.CatmullRomCurve3([from, mid, to]);
    const tubeGeo = new THREE.TubeGeometry(curve, 36, 0.07, 10, false);
    const tube = new THREE.Mesh(tubeGeo, windMat.clone());
    parent.add(tube);

    const dir = to.clone().sub(from).normalize();
    const arrow = new THREE.ArrowHelper(
      dir,
      from.clone().lerp(to, 0.72),
      Math.min(1.6, from.distanceTo(to) * 0.22),
      WIND_COLOR,
      0.35,
      0.22
    );
    // Soften arrow materials
    arrow.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.material && "opacity" in mesh.material) {
        const m = mesh.material as THREE.Material & {
          transparent?: boolean;
          opacity?: number;
        };
        m.transparent = true;
        m.opacity = 0.55;
      }
    });
    parent.add(arrow);

    // Secondary parallel ribbon for richer flow (2–3 streams)
    const offset = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.35);
    const curve2 = new THREE.CatmullRomCurve3([
      from.clone().add(offset),
      mid.clone().add(offset).add(new THREE.Vector3(0, 0.2, 0)),
      to.clone().add(offset),
    ]);
    const tube2 = new THREE.Mesh(
      new THREE.TubeGeometry(curve2, 28, 0.045, 8, false),
      windMat.clone()
    );
    (tube2.material as THREE.MeshStandardMaterial).opacity = 0.22;
    parent.add(tube2);
  }
}

function buildGabledRoof(
  parent: THREE.Group,
  footprint: { cx: number; cz: number; sx: number; sz: number },
  visible: boolean
) {
  const group = new THREE.Group();
  group.name = "roofGroup";
  group.visible = visible;

  const overhang = 0.4;
  const halfX = footprint.sx / 2 + overhang;
  const halfZ = footprint.sz / 2 + overhang;
  const eaveY = ROOF_Y;
  const rise = Math.max(1.15, Math.min(footprint.sx, footprint.sz) * 0.2);
  const ridgeY = ROOF_Y + rise;
  const { cx, cz } = footprint;

  const mat = new THREE.MeshStandardMaterial({
    color: ROOF_SLATE,
    transparent: true,
    opacity: 0.45,
    roughness: 0.72,
    metalness: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Ridge along the longer plan axis
  const ridgeAlongX = footprint.sx >= footprint.sz;

  const makePitch = (
    verts: [number, number, number][]
  ): THREE.Mesh => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(verts.flat());
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    // Two triangles for a quad
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    return mesh;
  };

  if (ridgeAlongX) {
    // Slopes face ±Z — ridge runs East–West (X)
    group.add(
      makePitch([
        [cx - halfX, eaveY, cz - halfZ],
        [cx + halfX, eaveY, cz - halfZ],
        [cx + halfX, ridgeY, cz],
        [cx - halfX, ridgeY, cz],
      ])
    );
    group.add(
      makePitch([
        [cx + halfX, eaveY, cz + halfZ],
        [cx - halfX, eaveY, cz + halfZ],
        [cx - halfX, ridgeY, cz],
        [cx + halfX, ridgeY, cz],
      ])
    );
    // Gable end triangles (East / West)
    const gableMat = mat.clone();
    gableMat.opacity = 0.4;
    for (const x of [cx - halfX, cx + halfX]) {
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.BufferAttribute(
          new Float32Array([
            x,
            eaveY,
            cz - halfZ,
            x,
            eaveY,
            cz + halfZ,
            x,
            ridgeY,
            cz,
          ]),
          3
        )
      );
      g.computeVertexNormals();
      group.add(new THREE.Mesh(g, gableMat));
    }
  } else {
    // Slopes face ±X — ridge runs North–South (Z)
    group.add(
      makePitch([
        [cx - halfX, eaveY, cz - halfZ],
        [cx - halfX, eaveY, cz + halfZ],
        [cx, ridgeY, cz + halfZ],
        [cx, ridgeY, cz - halfZ],
      ])
    );
    group.add(
      makePitch([
        [cx + halfX, eaveY, cz + halfZ],
        [cx + halfX, eaveY, cz - halfZ],
        [cx, ridgeY, cz - halfZ],
        [cx, ridgeY, cz + halfZ],
      ])
    );
    const gableMat = mat.clone();
    gableMat.opacity = 0.4;
    for (const z of [cz - halfZ, cz + halfZ]) {
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.BufferAttribute(
          new Float32Array([
            cx - halfX,
            eaveY,
            z,
            cx + halfX,
            eaveY,
            z,
            cx,
            ridgeY,
            z,
          ]),
          3
        )
      );
      g.computeVertexNormals();
      group.add(new THREE.Mesh(g, gableMat));
    }
  }

  // Subtle ridge beam
  const ridgeLen = ridgeAlongX ? halfX * 2 : halfZ * 2;
  const ridgeBeam = new THREE.Mesh(
    new THREE.BoxGeometry(
      ridgeAlongX ? ridgeLen : 0.08,
      0.06,
      ridgeAlongX ? 0.08 : ridgeLen
    ),
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.55,
      roughness: 0.6,
      metalness: 0.2,
    })
  );
  ridgeBeam.position.set(cx, ridgeY, cz);
  group.add(ridgeBeam);

  parent.add(group);
}

/**
 * Oriented wall segment in world XZ.
 * Endpoints (x1,z1)→(x2,z2) define the long axis; BoxGeometry length runs along
 * local +X and is rotated with ``rotation.y = -atan2(dz, dx)``.
 */
type WallSegment = {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  /** World-space length of the (possibly extended) segment. */
  length: number;
  /** atan2(dz, dx) — bearing of the wall along +X before Three.js Y-rotation. */
  bearing: number;
  /** Three.js mesh.rotation.y = -bearing so local +X aligns with the segment. */
  rotationY: number;
  cx: number;
  cz: number;
  thickness: number;
  /** Axis-aligned bounds for proximity / footprint queries. */
  x: number;
  z: number;
  sx: number;
  sz: number;
};

/** Legacy alias kept for opening helpers that still speak AABB. */
type WallFoot = WallSegment;

/** Derive long-axis endpoints from an axis-aligned detection footprint. */
function footprintToEndpoints(foot: {
  x: number;
  z: number;
  sx: number;
  sz: number;
}): { x1: number; z1: number; x2: number; z2: number } {
  // Long axis = wall run; short axis = thickness
  if (foot.sx >= foot.sz) {
    return {
      x1: foot.x - foot.sx / 2,
      z1: foot.z,
      x2: foot.x + foot.sx / 2,
      z2: foot.z,
    };
  }
  return {
    x1: foot.x,
    z1: foot.z - foot.sz / 2,
    x2: foot.x,
    z2: foot.z + foot.sz / 2,
  };
}

function buildWallSegment(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  thickness = WALL_THICKNESS
): WallSegment {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.sqrt(dx * dx + dz * dz);
  const bearing = Math.atan2(dz, dx);
  // Plan Y → world Z: negate so local +X of BoxGeometry follows the segment
  const rotationY = -bearing;
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  return {
    x1,
    z1,
    x2,
    z2,
    length: Math.max(length, 0.05),
    bearing,
    rotationY,
    cx,
    cz,
    thickness,
    x: cx,
    z: cz,
    sx: Math.abs(dx) + thickness,
    sz: Math.abs(dz) + thickness,
  };
}

function wallEndpoints(w: WallSegment): Array<[number, number]> {
  return [
    [w.x1, w.z1],
    [w.x2, w.z2],
  ];
}

/** True once two segments have been welded onto the identical vertex. */
function sharesExactVertex(a: WallSegment, b: WallSegment): boolean {
  for (const [ax, az] of wallEndpoints(a)) {
    for (const [bx, bz] of wallEndpoints(b)) {
      if (Math.abs(ax - bx) < COORD_EPS && Math.abs(az - bz) < COORD_EPS) {
        return true;
      }
    }
  }
  return false;
}

function wallsMeetAtCorner(a: WallSegment, b: WallSegment): boolean {
  for (const [ax, az] of wallEndpoints(a)) {
    for (const [bx, bz] of wallEndpoints(b)) {
      if (Math.hypot(ax - bx, az - bz) <= WALL_PROXIMITY_EPS) return true;
    }
  }
  // T-junction: endpoint of a near the body of b
  for (const [ex, ez] of wallEndpoints(a)) {
    const t = projectPointOntoSegment(ex, ez, b);
    const px = b.x1 + (b.x2 - b.x1) * t;
    const pz = b.z1 + (b.z2 - b.z1) * t;
    if (Math.hypot(ex - px, ez - pz) <= WALL_PROXIMITY_EPS) return true;
  }
  return false;
}

/** Parametric projection t∈[0,1] of a point onto a wall segment. */
function projectPointOntoSegment(
  px: number,
  pz: number,
  w: WallSegment
): number {
  const dx = w.x2 - w.x1;
  const dz = w.z2 - w.z1;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-8) return 0;
  const t = ((px - w.x1) * dx + (pz - w.z1) * dz) / len2;
  return Math.min(1, Math.max(0, t));
}

function distancePointToSegment(
  px: number,
  pz: number,
  w: WallSegment
): number {
  const t = projectPointOntoSegment(px, pz, w);
  const qx = w.x1 + (w.x2 - w.x1) * t;
  const qz = w.z1 + (w.z2 - w.z1) * t;
  return Math.hypot(px - qx, pz - qz);
}

/* ================== BIM coordinate sanitization pipeline ================== */

type WallAxis = "horizontal" | "vertical" | "diagonal";

type SanitizeStats = {
  straightened: number;
  railed: number;
  welded: number;
};

function segmentAxis(seg: WallSegment): WallAxis {
  const dx = Math.abs(seg.x2 - seg.x1);
  const dz = Math.abs(seg.z2 - seg.z1);
  if (dz < COORD_EPS && dx > COORD_EPS) return "horizontal";
  if (dx < COORD_EPS && dz > COORD_EPS) return "vertical";
  return "diagonal";
}

/**
 * Stage 1 — angle straightening.
 *
 * A bearing within ``ANGLE_SNAP_DEG`` of an axis is forced onto it by collapsing
 * the off-axis coordinate to the segment's mean, i.e. rotating the run about its
 * own midpoint. Because the surviving delta is then exactly zero, the downstream
 * ``Math.atan2`` yields exactly 0, π or ±π/2 with no floating-point residue.
 * Genuinely diagonal runs are left untouched.
 */
function straightenSegment(seg: WallSegment): {
  segment: WallSegment;
  changed: boolean;
} {
  const rawAngle = Math.atan2(seg.z2 - seg.z1, seg.x2 - seg.x1);
  const deg = Math.abs((rawAngle * 180) / Math.PI);

  const nearHorizontal = deg <= ANGLE_SNAP_DEG || deg >= 180 - ANGLE_SNAP_DEG;
  const nearVertical = Math.abs(deg - 90) <= ANGLE_SNAP_DEG;

  if (nearHorizontal && Math.abs(seg.z2 - seg.z1) > COORD_EPS) {
    const z = (seg.z1 + seg.z2) / 2;
    return {
      segment: buildWallSegment(seg.x1, z, seg.x2, z, seg.thickness),
      changed: true,
    };
  }
  if (nearVertical && Math.abs(seg.x2 - seg.x1) > COORD_EPS) {
    const x = (seg.x1 + seg.x2) / 2;
    return {
      segment: buildWallSegment(x, seg.z1, x, seg.z2, seg.thickness),
      changed: true,
    };
  }
  return { segment: seg, changed: false };
}

/**
 * Single-linkage 1-D clustering: values within ``tolerance`` of a neighbour join
 * the same rail and all collapse to that rail's mean.
 */
function snapValuesToRails(values: number[], tolerance: number): number[] {
  const sorted = values
    .map((v, i) => ({ v, i }))
    .sort((a, b) => a.v - b.v);
  const out = new Array<number>(values.length).fill(0);

  let group: Array<{ v: number; i: number }> = [];
  const flush = () => {
    if (group.length === 0) return;
    const mean = group.reduce((sum, g) => sum + g.v, 0) / group.length;
    for (const g of group) out[g.i] = mean;
    group = [];
  };

  for (const item of sorted) {
    if (group.length > 0 && item.v - group[group.length - 1].v > tolerance) {
      flush();
    }
    group.push(item);
  }
  flush();
  return out;
}

/**
 * Stage 2 — grid snapping onto shared rails.
 *
 * Near-collinear parallel walls are pulled onto one exact coordinate: every
 * horizontal run within tolerance shares a single z, every vertical run shares a
 * single x. This is what removes the few-pixel stagger between walls the model
 * saw as one continuous line.
 */
function snapSegmentsToRails(segments: WallSegment[]): {
  segments: WallSegment[];
  railed: number;
} {
  const hIdx: number[] = [];
  const vIdx: number[] = [];
  for (let i = 0; i < segments.length; i++) {
    const axis = segmentAxis(segments[i]);
    if (axis === "horizontal") hIdx.push(i);
    else if (axis === "vertical") vIdx.push(i);
  }

  const out = [...segments];
  let railed = 0;

  const hRails = snapValuesToRails(
    hIdx.map((i) => segments[i].z1),
    SNAP_TOLERANCE
  );
  hIdx.forEach((i, k) => {
    const z = hRails[k];
    if (Math.abs(z - segments[i].z1) < COORD_EPS) return;
    const s = segments[i];
    out[i] = buildWallSegment(s.x1, z, s.x2, z, s.thickness);
    railed += 1;
  });

  const vRails = snapValuesToRails(
    vIdx.map((i) => segments[i].x1),
    SNAP_TOLERANCE
  );
  vIdx.forEach((i, k) => {
    const x = vRails[k];
    if (Math.abs(x - segments[i].x1) < COORD_EPS) return;
    const s = segments[i];
    out[i] = buildWallSegment(x, s.z1, x, s.z2, s.thickness);
    railed += 1;
  });

  return { segments: out, railed };
}

/**
 * Stage 3 — vertex welding to exact mathematical points.
 *
 * Naively averaging two nearby endpoints would tilt both walls off-axis and undo
 * stage 1. Instead a perpendicular pair is welded to the *intersection of its two
 * rails*: the horizontal run adopts the vertical run's x while keeping its own z,
 * and vice versa. Both endpoints land on the identical coordinate and both walls
 * stay perfectly orthogonal — the two goals stop competing.
 *
 * Parallel runs meeting end-to-end are welded along their shared axis only.
 * Diagonals fall back to a midpoint weld, which is the one case that trades a
 * sliver of angle accuracy for a closed corner.
 */
function weldSegmentEndpoints(segments: WallSegment[]): {
  segments: WallSegment[];
  welded: number;
} {
  type Pt = { x: number; z: number };
  const ends: Array<[Pt, Pt]> = segments.map((s) => [
    { x: s.x1, z: s.z1 },
    { x: s.x2, z: s.z2 },
  ]);
  const axes = segments.map(segmentAxis);
  let welded = 0;

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      for (const ei of [0, 1] as const) {
        for (const ej of [0, 1] as const) {
          const a = ends[i][ei];
          const b = ends[j][ej];
          const gap = Math.hypot(a.x - b.x, a.z - b.z);
          if (gap > SNAP_TOLERANCE || gap < COORD_EPS) continue;

          const axisA = axes[i];
          const axisB = axes[j];

          if (axisA === "horizontal" && axisB === "vertical") {
            a.x = b.x;
            b.z = a.z;
          } else if (axisA === "vertical" && axisB === "horizontal") {
            a.z = b.z;
            b.x = a.x;
          } else if (axisA === "horizontal" && axisB === "horizontal") {
            const x = (a.x + b.x) / 2;
            a.x = x;
            b.x = x;
          } else if (axisA === "vertical" && axisB === "vertical") {
            const z = (a.z + b.z) / 2;
            a.z = z;
            b.z = z;
          } else {
            const x = (a.x + b.x) / 2;
            const z = (a.z + b.z) / 2;
            a.x = x;
            a.z = z;
            b.x = x;
            b.z = z;
          }
          welded += 1;
        }
      }
    }
  }

  const out = segments.map((s, i) =>
    buildWallSegment(
      ends[i][0].x,
      ends[i][0].z,
      ends[i][1].x,
      ends[i][1].z,
      s.thickness
    )
  );
  return { segments: out, welded };
}

/**
 * Straighten → rail-snap → weld. Order matters: welding is the only stage that
 * can introduce angle error, and stage 3's rail-intersection rule is what keeps
 * it from doing so on orthogonal junctions.
 */
function sanitizeWallSegments(segments: WallSegment[]): {
  segments: WallSegment[];
  stats: SanitizeStats;
} {
  let straightened = 0;
  const straight = segments.map((seg) => {
    const result = straightenSegment(seg);
    if (result.changed) straightened += 1;
    return result.segment;
  });

  const railStage = snapSegmentsToRails(straight);
  const weldStage = weldSegmentEndpoints(railStage.segments);

  return {
    segments: weldStage.segments,
    stats: {
      straightened,
      railed: railStage.railed,
      welded: weldStage.welded,
    },
  };
}

/**
 * Convert detection AABBs → oriented segments, then extend each length by
 * ``wall_thickness * 1.1`` so L/T junctions physically overlap (seamless joints).
 */
function applyWallCornerMerging(
  walls: Array<{ x: number; z: number; sx: number; sz: number }>
): WallSegment[] {
  const seamlessExt = WALL_THICKNESS * 1.1;

  // First pass: oriented segments from detection footprints
  const base = walls.map((foot) => {
    const { x1, z1, x2, z2 } = footprintToEndpoints(foot);
    return buildWallSegment(x1, z1, x2, z2, WALL_THICKNESS);
  });

  // Second pass: CAD sanitization — straighten bearings, share rails, weld vertices
  const { segments: sanitized, stats } = sanitizeWallSegments(base);
  if (process.env.NODE_ENV !== "production" && base.length > 0) {
    console.info(
      `[FloorPlan3DViewport] BIM sanitize · ${base.length} walls · ` +
        `${stats.straightened} straightened · ${stats.railed} rail-snapped · ` +
        `${stats.welded} vertices welded · tol ${SNAP_TOLERANCE_PX}px ` +
        `(${SNAP_TOLERANCE.toFixed(3)}u) · ±${ANGLE_SNAP_DEG}°`
    );
  }

  // Third pass: extend along bearing so perpendicular ends fuse at corners
  return sanitized.map((w, i) => {
    let junctionPad = 0;
    for (let j = 0; j < sanitized.length; j++) {
      if (i === j) continue;
      if (sharesExactVertex(w, sanitized[j])) {
        // Welded vertex: half a thickness is exactly the corner square to fill
        junctionPad = Math.max(junctionPad, w.thickness / 2);
      } else if (wallsMeetAtCorner(w, sanitized[j])) {
        // Gap was too wide to weld — fall back to the brute-force bridge
        junctionPad = Math.max(junctionPad, WALL_CORNER_PAD);
      }
    }

    const totalExt = seamlessExt + junctionPad * 2;
    const halfExt = totalExt / 2;
    const dx = w.x2 - w.x1;
    const dz = w.z2 - w.z1;
    const len = Math.max(w.length, 1e-6);
    const ux = dx / len;
    const uz = dz / len;

    return buildWallSegment(
      w.x1 - ux * halfExt,
      w.z1 - uz * halfExt,
      w.x2 + ux * halfExt,
      w.z2 + uz * halfExt,
      WALL_THICKNESS
    );
  });
}

type DoorCut = {
  x: number;
  z: number;
  width: number;
  /** Wall bearing this door sits on (for 1D projection). */
  wallIndex: number;
};

function collectAlignedDoorCuts(
  detections: DetectionBox[],
  walls: WallSegment[]
): DoorCut[] {
  const cuts: DoorCut[] = [];
  for (const box of detections) {
    if (classifyArchRole(box) !== "door") continue;
    const foot = boxToWorld(box);
    const aligned = alignOpeningToWalls(foot, walls);
    const width = aligned.facingZ ? aligned.sx : aligned.sz;

    let wallIndex = -1;
    let bestDist = Infinity;
    for (let i = 0; i < walls.length; i++) {
      const d = distancePointToSegment(aligned.x, aligned.z, walls[i]);
      if (d < bestDist) {
        bestDist = d;
        wallIndex = i;
      }
    }
    if (wallIndex < 0 || bestDist > WALL_THICKNESS * 3) continue;

    cuts.push({
      x: aligned.x,
      z: aligned.z,
      width: Math.max(0.5, width),
      wallIndex,
    });
  }
  return cuts;
}

/**
 * Place a wall slab along an oriented segment.
 * BoxGeometry(length, height, thickness) with rotation.y = -atan2(dz, dx).
 */
function addOrientedWallBox(
  parent: THREE.Object3D,
  length: number,
  height: number,
  thickness: number,
  cx: number,
  cy: number,
  cz: number,
  rotationY: number,
  material: THREE.Material
) {
  if (length < 0.04 || height < 0.04 || thickness < 0.04) return;
  const geometry = new THREE.BoxGeometry(length, height, thickness);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(cx, cy, cz);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.archRole = "wall";
  parent.add(mesh);
  addEdges(mesh, geometry, EDGE_COLOR);
}

/**
 * Extrude an oriented wall with physical doorway cuts: masonry removed from
 * y=0 → DOOR_HEIGHT where a door sits; a lintel remains above the opening.
 */
function addWallWithDoorwayCuts(
  parent: THREE.Object3D,
  wall: WallSegment,
  wallIndex: number,
  doors: DoorCut[],
  material: THREE.Material
) {
  const onThisWall = doors.filter((d) => d.wallIndex === wallIndex);

  if (onThisWall.length === 0) {
    addOrientedWallBox(
      parent,
      wall.length,
      WALL_HEIGHT,
      wall.thickness,
      wall.cx,
      WALL_HEIGHT / 2,
      wall.cz,
      wall.rotationY,
      material
    );
    return;
  }

  // Project doors onto 1D parameter along the segment (world → t ∈ [0, length])
  const ux = (wall.x2 - wall.x1) / wall.length;
  const uz = (wall.z2 - wall.z1) / wall.length;

  const intervals = onThisWall
    .map((d) => {
      const t =
        (d.x - wall.x1) * ux + (d.z - wall.z1) * uz; // distance along segment from start
      const half = d.width / 2;
      return {
        a: Math.max(0, t - half),
        b: Math.min(wall.length, t + half),
      };
    })
    .filter((iv) => iv.b - iv.a > 0.08)
    .sort((u, v) => u.a - v.a);

  const merged: Array<{ a: number; b: number }> = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (last && iv.a <= last.b + 0.02) {
      last.b = Math.max(last.b, iv.b);
    } else {
      merged.push({ ...iv });
    }
  }

  const lintelH = Math.max(0.15, WALL_HEIGHT - DOOR_HEIGHT);
  const lintelY = DOOR_HEIGHT + lintelH / 2;
  let cursor = 0;

  const placeAlong = (a: number, b: number, height: number, centerY: number) => {
    const len = b - a;
    if (len < 0.04) return;
    const midT = (a + b) / 2;
    const cx = wall.x1 + ux * midT;
    const cz = wall.z1 + uz * midT;
    addOrientedWallBox(
      parent,
      len,
      height,
      wall.thickness,
      cx,
      centerY,
      cz,
      wall.rotationY,
      material
    );
  };

  for (const iv of merged) {
    placeAlong(cursor, iv.a, WALL_HEIGHT, WALL_HEIGHT / 2);
    placeAlong(iv.a, iv.b, lintelH, lintelY);
    cursor = iv.b;
  }
  placeAlong(cursor, wall.length, WALL_HEIGHT, WALL_HEIGHT / 2);
}

function openingAxes(foot: { sx: number; sz: number }) {
  const facingZ = foot.sx >= foot.sz;
  return {
    facingZ,
    width: Math.max(0.35, facingZ ? foot.sx : foot.sz),
    depth: OPENING_FRAME_DEPTH,
  };
}

/**
 * Snap an opening onto the nearest oriented wall segment so frames sit in the
 * wall plane with correct facing from the segment bearing.
 */
function alignOpeningToWalls(
  foot: { x: number; z: number; sx: number; sz: number },
  walls: WallSegment[]
): { x: number; z: number; sx: number; sz: number; facingZ: boolean } {
  let best: WallSegment | null = null;
  let bestDist = Infinity;
  for (const w of walls) {
    const d = distancePointToSegment(foot.x, foot.z, w);
    if (d < bestDist) {
      bestDist = d;
      best = w;
    }
  }

  // Wall runs mostly along X → openings face ±Z
  const facingZ = best
    ? Math.abs(Math.cos(best.bearing)) >= Math.abs(Math.sin(best.bearing))
    : foot.sx >= foot.sz;

  let width = Math.max(0.4, facingZ ? foot.sx : foot.sz);
  let x = foot.x;
  let z = foot.z;

  if (best && best.length > 1e-6) {
    const t = projectPointOntoSegment(foot.x, foot.z, best);
    // Snap to centerline of the wall segment
    x = best.x1 + (best.x2 - best.x1) * t;
    z = best.z1 + (best.z2 - best.z1) * t;
    width = Math.min(width, Math.max(0.4, best.length * 0.95));
  }

  return {
    x,
    z,
    sx: facingZ ? width : OPENING_FRAME_DEPTH,
    sz: facingZ ? OPENING_FRAME_DEPTH : width,
    facingZ,
  };
}

/** Build four frame rails (top / bottom / left / right) around an opening. */
function addOpeningFrameRails(
  group: THREE.Group,
  foot: { x: number; z: number },
  facingZ: boolean,
  width: number,
  height: number,
  depth: number,
  y: number,
  frameT: number,
  material: THREE.Material
) {
  const hw = width / 2;
  const hh = height / 2;
  const railH = Math.max(0.05, height - frameT * 2);
  const rails: Array<{
    sx: number;
    sy: number;
    sz: number;
    ox: number;
    oy: number;
    oz: number;
  }> = facingZ
    ? [
        { sx: width, sy: frameT, sz: depth, ox: 0, oy: hh - frameT / 2, oz: 0 },
        { sx: width, sy: frameT, sz: depth, ox: 0, oy: -hh + frameT / 2, oz: 0 },
        { sx: frameT, sy: railH, sz: depth, ox: -hw + frameT / 2, oy: 0, oz: 0 },
        { sx: frameT, sy: railH, sz: depth, ox: hw - frameT / 2, oy: 0, oz: 0 },
      ]
    : [
        { sx: depth, sy: frameT, sz: width, ox: 0, oy: hh - frameT / 2, oz: 0 },
        { sx: depth, sy: frameT, sz: width, ox: 0, oy: -hh + frameT / 2, oz: 0 },
        { sx: depth, sy: railH, sz: frameT, ox: 0, oy: 0, oz: -hw + frameT / 2 },
        { sx: depth, sy: railH, sz: frameT, ox: 0, oy: 0, oz: hw - frameT / 2 },
      ];

  for (const r of rails) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(r.sx, r.sy, r.sz),
      material
    );
    mesh.position.set(foot.x + r.ox, y + r.oy, foot.z + r.oz);
    mesh.castShadow = true;
    group.add(mesh);
  }
}

/**
 * Window: sill at y=1.0, head at y=2.2 (height 1.2).
 * Thin charcoal sash + translucent blue glass, flush in the wall gap.
 */
function addFramedWindow(
  parent: THREE.Object3D,
  foot: { x: number; z: number; sx: number; sz: number },
  walls: WallFoot[]
) {
  const group = new THREE.Group();
  const aligned = alignOpeningToWalls(foot, walls);
  const elevation = WINDOW_ELEVATION; // 1.0
  const height = WINDOW_HEIGHT; // 1.2 → top at 2.2
  const y = elevation + height / 2;
  const { facingZ } = aligned;
  const width = facingZ ? aligned.sx : aligned.sz;
  const depth = OPENING_FRAME_DEPTH;
  const frameT = OPENING_FRAME_THIN;
  const glassW = Math.max(0.12, width - frameT * 2);
  const glassH = Math.max(0.12, height - frameT * 2);

  const frameMat = new THREE.MeshStandardMaterial({
    color: FRAME_CHARCOAL,
    roughness: 0.5,
    metalness: 0.2,
  });

  addOpeningFrameRails(
    group,
    { x: aligned.x, z: aligned.z },
    facingZ,
    width,
    height,
    depth,
    y,
    frameT,
    frameMat
  );

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(glassW, glassH),
    new THREE.MeshPhysicalMaterial({
      color: WINDOW_GLASS,
      transparent: true,
      opacity: 0.4,
      roughness: 0.06,
      metalness: 0.04,
      transmission: 0.6,
      thickness: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  glass.position.set(aligned.x, y, aligned.z);
  if (!facingZ) glass.rotation.y = Math.PI / 2;
  group.add(glass);

  const sash = new THREE.Mesh(
    new THREE.BoxGeometry(
      facingZ ? frameT * 0.85 : depth * 0.4,
      glassH,
      facingZ ? depth * 0.4 : frameT * 0.85
    ),
    frameMat
  );
  sash.position.set(aligned.x, y, aligned.z);
  group.add(sash);

  group.userData.archRole = 'window';
  parent.add(group);
}

/**
 * Door: sill at y=0, height 2.1. Dark frame + thin #78350F leaf swung ~35° ajar.
 */
function addFramedDoor(
  parent: THREE.Object3D,
  foot: { x: number; z: number; sx: number; sz: number },
  walls: WallFoot[]
) {
  const group = new THREE.Group();
  const aligned = alignOpeningToWalls(foot, walls);
  const elevation = 0;
  const height = DOOR_HEIGHT; // 2.1
  const y = elevation + height / 2;
  const { facingZ } = aligned;
  const width = facingZ ? aligned.sx : aligned.sz;
  const depth = OPENING_FRAME_DEPTH;
  const frameT = OPENING_FRAME_THIN;
  const leafW = Math.max(0.25, width - frameT * 2);
  const leafH = Math.max(0.5, height - frameT * 2);
  const leafThickness = 0.045;

  const frameMat = new THREE.MeshStandardMaterial({
    color: FRAME_CHARCOAL,
    roughness: 0.55,
    metalness: 0.15,
  });

  addOpeningFrameRails(
    group,
    { x: aligned.x, z: aligned.z },
    facingZ,
    width,
    height,
    depth,
    y,
    frameT,
    frameMat
  );

  const hinge = new THREE.Group();
  if (facingZ) {
    hinge.position.set(aligned.x - leafW / 2, y, aligned.z);
  } else {
    hinge.position.set(aligned.x, y, aligned.z - leafW / 2);
  }
  hinge.rotation.y = DOOR_AJAR_RAD;

  const leaf = new THREE.Mesh(
    new THREE.BoxGeometry(
      facingZ ? leafW : leafThickness,
      leafH,
      facingZ ? leafThickness : leafW
    ),
    new THREE.MeshStandardMaterial({
      color: DOOR_LEAF,
      roughness: 0.72,
      metalness: 0.04,
    })
  );
  if (facingZ) {
    leaf.position.set(leafW / 2, 0, 0);
  } else {
    leaf.position.set(0, 0, leafW / 2);
  }
  leaf.castShadow = true;
  hinge.add(leaf);
  group.add(hinge);

  group.userData.archRole = 'door';
  parent.add(group);
}

/* ========================= Virtual staging (interiors) ==================== */

/**
 * Label-first furnishing classifier, ordered so compound labels resolve to the
 * more specific piece — "bedside table" must read as a table, not a bed.
 */
function classifyFurniture(box: DetectionBox): FurnitureKind | null {
  const label = labelOf(box);
  if (
    label.includes("sofa") ||
    label.includes("couch") ||
    label.includes("settee")
  ) {
    return "sofa";
  }
  if (label.includes("table") || label.includes("desk")) return "table";
  if (
    label.includes("sink") ||
    label.includes("basin") ||
    label.includes("counter")
  ) {
    return "sink";
  }
  if (label.includes("bed")) return "bed";
  return null;
}

type StagingMaterials = {
  oak: THREE.MeshStandardMaterial;
  sheet: THREE.MeshStandardMaterial;
  pillow: THREE.MeshStandardMaterial;
  fabric: THREE.MeshPhysicalMaterial;
  tableTop: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  marble: THREE.MeshPhysicalMaterial;
  steel: THREE.MeshStandardMaterial;
  basin: THREE.MeshStandardMaterial;
  clay: THREE.MeshStandardMaterial;
  soil: THREE.MeshStandardMaterial;
  foliage: THREE.MeshStandardMaterial;
};

/**
 * Staging materials are rebuilt per pass and owned solely by the staging group,
 * so tearing that group down can never dispose the shared shell materials.
 */
function createStagingMaterials(): StagingMaterials {
  return {
    oak: new THREE.MeshStandardMaterial({
      color: BED_FRAME_OAK,
      roughness: 0.66,
      metalness: 0.04,
    }),
    // Low roughness gives crisp linen highlights under the sun rig
    sheet: new THREE.MeshStandardMaterial({
      color: BED_SHEET_WHITE,
      roughness: 0.32,
      metalness: 0.02,
    }),
    pillow: new THREE.MeshStandardMaterial({
      color: BED_PILLOW,
      roughness: 0.44,
      metalness: 0.01,
    }),
    // Sheen keeps the charcoal upholstery reading as woven fabric, not plastic
    fabric: new THREE.MeshPhysicalMaterial({
      color: SOFA_CHARCOAL,
      roughness: 0.94,
      metalness: 0,
      sheen: 0.65,
      sheenRoughness: 0.55,
      sheenColor: new THREE.Color(0x94a3b8),
    }),
    tableTop: new THREE.MeshStandardMaterial({
      color: TABLE_TOP_OAK,
      roughness: 0.3,
      metalness: 0.06,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: TABLE_LEG_BLACK,
      roughness: 0.34,
      metalness: 0.72,
    }),
    marble: new THREE.MeshPhysicalMaterial({
      color: COUNTER_MARBLE,
      roughness: 0.22,
      metalness: 0.03,
      clearcoat: 0.5,
      clearcoatRoughness: 0.18,
    }),
    steel: new THREE.MeshStandardMaterial({
      color: FAUCET_STEEL,
      roughness: 0.18,
      metalness: 0.92,
    }),
    basin: new THREE.MeshStandardMaterial({
      color: BASIN_STEEL,
      roughness: 0.24,
      metalness: 0.78,
    }),
    clay: new THREE.MeshStandardMaterial({
      color: PLANT_POT_CLAY,
      roughness: 0.78,
      metalness: 0.03,
    }),
    soil: new THREE.MeshStandardMaterial({
      color: 0x3f2d1b,
      roughness: 0.95,
      metalness: 0,
    }),
    foliage: new THREE.MeshStandardMaterial({
      color: PLANT_FOLIAGE,
      roughness: 0.82,
      metalness: 0.02,
    }),
  };
}

/** Attach one furniture part; every piece casts soft shadows onto the deck. */
function addPart(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  receiveShadow = false
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = receiveShadow;
  group.add(mesh);
  return mesh;
}

/** Rotate a local XZ offset about Y, matching ``mesh.rotation.y`` semantics. */
function rotateY(lx: number, lz: number, theta: number): [number, number] {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [lx * c + lz * s, -lx * s + lz * c];
}

/** Long plan axis becomes local +X; the short axis becomes local depth (Z). */
function footprintOrientation(foot: { sx: number; sz: number }): {
  length: number;
  depth: number;
  rotationY: number;
} {
  const alongX = foot.sx >= foot.sz;
  return {
    length: Math.max(0.55, alongX ? foot.sx : foot.sz),
    depth: Math.max(0.55, alongX ? foot.sz : foot.sx),
    rotationY: alongX ? 0 : Math.PI / 2,
  };
}

function nearestWallDistance(
  x: number,
  z: number,
  walls: WallSegment[]
): number {
  let best = Infinity;
  for (const w of walls) {
    best = Math.min(best, distancePointToSegment(x, z, w));
  }
  return best;
}

/**
 * Flip the piece 180° when its designated back edge (local −X for a headboard,
 * local −Z for seating) ends up facing the room instead of the nearest wall.
 * Furniture backed into open floor is the tell-tale sign of naive staging.
 */
function faceBackToWall(
  x: number,
  z: number,
  rotationY: number,
  backLx: number,
  backLz: number,
  walls: WallSegment[]
): number {
  if (walls.length === 0) return rotationY;
  const [bx, bz] = rotateY(backLx, backLz, rotationY);
  const backDist = nearestWallDistance(x + bx, z + bz, walls);
  const frontDist = nearestWallDistance(x - bx, z - bz, walls);
  return frontDist < backDist ? rotationY + Math.PI : rotationY;
}

/** Oak base frame + headboard, soft white sheet block, two rounded pillows. */
function addStagedBed(
  parent: THREE.Object3D,
  foot: { x: number; z: number; sx: number; sz: number },
  walls: WallSegment[],
  mats: StagingMaterials
) {
  const { length, depth, rotationY } = footprintOrientation(foot);
  const group = new THREE.Group();
  group.position.set(foot.x, 0, foot.z);
  group.rotation.y = faceBackToWall(
    foot.x,
    foot.z,
    rotationY,
    -length / 2,
    0,
    walls
  );

  addPart(
    group,
    new THREE.BoxGeometry(length, BED_BASE_H, depth),
    mats.oak,
    0,
    BED_BASE_H / 2,
    0
  );

  addPart(
    group,
    new RoundedBoxGeometry(0.1, BED_HEADBOARD_H, depth, 2, 0.03),
    mats.oak,
    -length / 2 + 0.05,
    BED_BASE_H + BED_HEADBOARD_H / 2 - 0.08,
    0
  );

  // Inset slightly so the oak frame reads as a visible lip around the sheets
  addPart(
    group,
    new RoundedBoxGeometry(length * 0.94, BED_MATTRESS_H, depth * 0.93, 3, 0.05),
    mats.sheet,
    0.02,
    BED_BASE_H + BED_MATTRESS_H / 2,
    0,
    true
  );

  const pillowW = Math.min(0.44, length * 0.24);
  const pillowD = Math.min(0.6, depth * 0.38);
  const pillowY = BED_BASE_H + BED_MATTRESS_H + PILLOW_H / 2 - 0.03;
  for (const sign of [-1, 1]) {
    addPart(
      group,
      new RoundedBoxGeometry(pillowW, PILLOW_H, pillowD, 4, 0.055),
      mats.pillow,
      -length / 2 + pillowW / 2 + 0.14,
      pillowY,
      sign * depth * 0.2
    );
  }

  parent.add(group);
}

/** Charcoal plinth, seat cushion, backrest and two armrests in soft fabric. */
function addStagedSofa(
  parent: THREE.Object3D,
  foot: { x: number; z: number; sx: number; sz: number },
  walls: WallSegment[],
  mats: StagingMaterials
) {
  const { length, depth, rotationY } = footprintOrientation(foot);
  const group = new THREE.Group();
  group.position.set(foot.x, 0, foot.z);
  group.rotation.y = faceBackToWall(
    foot.x,
    foot.z,
    rotationY,
    0,
    -depth / 2,
    walls
  );

  const armW = Math.min(0.22, length * 0.14);
  const backD = Math.min(0.22, depth * 0.24);

  addPart(
    group,
    new THREE.BoxGeometry(length, SOFA_PLINTH_H, depth),
    mats.fabric,
    0,
    SOFA_PLINTH_H / 2,
    0
  );

  addPart(
    group,
    new RoundedBoxGeometry(
      Math.max(0.3, length - armW * 2),
      SOFA_SEAT_H,
      Math.max(0.3, depth - backD),
      3,
      0.06
    ),
    mats.fabric,
    0,
    SOFA_PLINTH_H + SOFA_SEAT_H / 2,
    backD / 2,
    true
  );

  const backH = SOFA_BACK_H - SOFA_PLINTH_H;
  addPart(
    group,
    new RoundedBoxGeometry(length, backH, backD, 3, 0.05),
    mats.fabric,
    0,
    SOFA_PLINTH_H + backH / 2,
    -depth / 2 + backD / 2
  );

  const armH = SOFA_ARM_H - SOFA_PLINTH_H;
  for (const sign of [-1, 1]) {
    addPart(
      group,
      new RoundedBoxGeometry(armW, armH, depth * 0.94, 3, 0.05),
      mats.fabric,
      sign * (length / 2 - armW / 2),
      SOFA_PLINTH_H + armH / 2,
      0
    );
  }

  parent.add(group);
}

/** Polished oak top on four slim black metal cylinders. */
function addStagedTable(
  parent: THREE.Object3D,
  foot: { x: number; z: number; sx: number; sz: number },
  mats: StagingMaterials
) {
  const { length, depth, rotationY } = footprintOrientation(foot);
  const group = new THREE.Group();
  group.position.set(foot.x, 0, foot.z);
  group.rotation.y = rotationY;

  addPart(
    group,
    new RoundedBoxGeometry(length, TABLE_TOP_H, depth, 2, 0.02),
    mats.tableTop,
    0,
    TABLE_TOP_Y,
    0,
    true
  );

  const legH = TABLE_TOP_Y - TABLE_TOP_H / 2;
  const legGeo = new THREE.CylinderGeometry(
    TABLE_LEG_R,
    TABLE_LEG_R,
    legH,
    16
  );
  const insetX = Math.max(TABLE_LEG_R, length / 2 - 0.14);
  const insetZ = Math.max(TABLE_LEG_R, depth / 2 - 0.14);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addPart(group, legGeo, mats.metal, sx * insetX, legH / 2, sz * insetZ);
    }
  }

  parent.add(group);
}

/** Marble counter, brushed-steel vessel basin and a curved gooseneck faucet. */
function addStagedSink(
  parent: THREE.Object3D,
  foot: { x: number; z: number; sx: number; sz: number },
  walls: WallSegment[],
  mats: StagingMaterials
) {
  const { length, depth, rotationY } = footprintOrientation(foot);
  const group = new THREE.Group();
  group.position.set(foot.x, 0, foot.z);
  group.rotation.y = faceBackToWall(
    foot.x,
    foot.z,
    rotationY,
    0,
    -depth / 2,
    walls
  );

  const bodyH = COUNTER_H - COUNTER_SLAB_H;
  addPart(
    group,
    new THREE.BoxGeometry(length * 0.94, bodyH, depth * 0.9),
    mats.marble,
    0,
    bodyH / 2,
    0
  );

  // Slab overhangs the carcass so it catches a shadow line on all four sides
  addPart(
    group,
    new RoundedBoxGeometry(length, COUNTER_SLAB_H, depth, 2, 0.015),
    mats.marble,
    0,
    COUNTER_H - COUNTER_SLAB_H / 2,
    0,
    true
  );

  const basinR = Math.min(0.26, Math.min(length, depth) * 0.3);
  const stemZ = -depth * 0.3;
  const basinZ = Math.min(depth * 0.12, stemZ + 0.2);
  const spoutR = Math.min(0.2, Math.max(0.1, basinZ - stemZ));

  addPart(
    group,
    new THREE.CylinderGeometry(basinR, basinR * 0.8, 0.13, 28),
    mats.basin,
    0,
    COUNTER_H + 0.055,
    basinZ,
    true
  );

  // Tall enough that the arc clears the basin rim instead of sinking into it
  const stemH = 0.4;
  const stemTopY = COUNTER_H + stemH;
  addPart(
    group,
    new THREE.CylinderGeometry(0.024, 0.028, stemH, 18),
    mats.steel,
    0,
    COUNTER_H + stemH / 2,
    stemZ
  );

  // Quarter torus rotated into the YZ plane: arcs up off the stem, over the basin
  const spout = addPart(
    group,
    new THREE.TorusGeometry(spoutR, 0.022, 12, 20, Math.PI / 2),
    mats.steel,
    0,
    stemTopY - spoutR,
    stemZ
  );
  spout.rotation.y = -Math.PI / 2;

  parent.add(group);
}

/** Clay pot with a leafy canopy — the deco accent for empty room corners. */
function addStagedPlant(
  parent: THREE.Object3D,
  x: number,
  z: number,
  mats: StagingMaterials
) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  addPart(
    group,
    new THREE.CylinderGeometry(0.2, 0.145, POT_H, 22),
    mats.clay,
    0,
    POT_H / 2,
    0
  );
  // Soil disc so the canopy never appears to float out of an empty pot
  addPart(
    group,
    new THREE.CylinderGeometry(0.185, 0.185, 0.03, 22),
    mats.soil,
    0,
    POT_H,
    0
  );
  addPart(
    group,
    new THREE.SphereGeometry(0.29, 20, 16),
    mats.foliage,
    0,
    POT_H + 0.3,
    0
  );
  addPart(
    group,
    new THREE.SphereGeometry(0.17, 16, 12),
    mats.foliage,
    0.16,
    POT_H + 0.17,
    0.1
  );
  addPart(
    group,
    new THREE.SphereGeometry(0.14, 16, 12),
    mats.foliage,
    -0.13,
    POT_H + 0.21,
    -0.12
  );

  parent.add(group);
}

/** Interior corners of the building footprint that no furniture already claims. */
function planCornerPlanters(
  footprint: { cx: number; cz: number; sx: number; sz: number },
  occupied: Array<{ x: number; z: number; r: number }>
): Array<[number, number]> {
  const spots: Array<[number, number]> = [];
  const hx = footprint.sx / 2 - PLANT_CORNER_INSET;
  const hz = footprint.sz / 2 - PLANT_CORNER_INSET;
  if (hx <= 0 || hz <= 0) return spots;

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = footprint.cx + sx * hx;
      const z = footprint.cz + sz * hz;
      const blocked = occupied.some(
        (o) => Math.hypot(o.x - x, o.z - z) < o.r + PLANT_CLEARANCE
      );
      if (!blocked) spots.push([x, z]);
    }
  }
  return spots;
}

/* ===================== Sample architectural template ===================== */

/**
 * Demo house rendered before the first analysis, so the viewport is never blank.
 *
 * Authored in the same CSS-percentage contract the API normalizer emits, so it
 * flows through the identical ``boxToWorld`` → sanitize → extrude path as live
 * data with no special-casing. Wall thickness is 1.2% deliberately: it puts the
 * four outer corners ~0.20 world units apart, just inside ``SNAP_TOLERANCE``, so
 * the vertex welder closes them exactly the way it does on real blueprints.
 *
 * Contents: 4 outer walls + 2 partitions (3 rooms), 4 windows, 2 doors,
 * 4 gold columns on the corner grid, and a few furnishings for virtual staging.
 */
const SAMPLE_ARCH_TEMPLATE: DetectionBox[] = [
  // --- Shell: closed rectangle, centrelines at 20.6% / 79.4% ---------------
  {
    id: "DEMO-WALL-N",
    label: "Load-Bearing Wall",
    confidence: 97,
    left: "20%",
    top: "20%",
    width: "60%",
    height: "1.2%",
    kind: "wall",
    wallType: "LOAD_BEARING",
    thicknessM: 0.28,
  },
  {
    id: "DEMO-WALL-S",
    label: "Load-Bearing Wall",
    confidence: 97,
    left: "20%",
    top: "78.8%",
    width: "60%",
    height: "1.2%",
    kind: "wall",
    wallType: "LOAD_BEARING",
    thicknessM: 0.28,
  },
  {
    id: "DEMO-WALL-W",
    label: "Load-Bearing Wall",
    confidence: 96,
    left: "20%",
    top: "20%",
    width: "1.2%",
    height: "60%",
    kind: "wall",
    wallType: "LOAD_BEARING",
    thicknessM: 0.28,
  },
  {
    id: "DEMO-WALL-E",
    label: "Load-Bearing Wall",
    confidence: 96,
    left: "78.8%",
    top: "20%",
    width: "1.2%",
    height: "60%",
    kind: "wall",
    wallType: "LOAD_BEARING",
    thicknessM: 0.28,
  },
  // --- Partitions: one N–S spur and one E–W spine → three rooms ------------
  {
    id: "DEMO-WALL-P1",
    label: "Partition Wall",
    confidence: 92,
    left: "49.4%",
    top: "20%",
    width: "1.2%",
    height: "34%",
    kind: "wall",
    wallType: "PARTITION",
    thicknessM: 0.12,
  },
  {
    id: "DEMO-WALL-P2",
    label: "Partition Wall",
    confidence: 93,
    left: "20%",
    top: "53.4%",
    width: "60%",
    height: "1.2%",
    kind: "wall",
    wallType: "PARTITION",
    thicknessM: 0.12,
  },
  // --- Four windows, centred on the outer wall centrelines -----------------
  {
    id: "DEMO-WIN-1",
    label: "Window DW1",
    confidence: 91,
    left: "31%",
    top: "20%",
    width: "7%",
    height: "1.2%",
    kind: "opening",
    source: "architectural",
  },
  {
    id: "DEMO-WIN-2",
    label: "Window DW2",
    confidence: 90,
    left: "61%",
    top: "20%",
    width: "7%",
    height: "1.2%",
    kind: "opening",
    source: "architectural",
  },
  {
    id: "DEMO-WIN-3",
    label: "Window DW3",
    confidence: 89,
    left: "78.8%",
    top: "33%",
    width: "1.2%",
    height: "7%",
    kind: "opening",
    source: "architectural",
  },
  {
    id: "DEMO-WIN-4",
    label: "Window DW4",
    confidence: 88,
    left: "20%",
    top: "61%",
    width: "1.2%",
    height: "7%",
    kind: "opening",
    source: "architectural",
  },
  // --- Two doors: south entry + interior doorway --------------------------
  {
    id: "DEMO-DOOR-1",
    label: "Door DD1",
    confidence: 94,
    left: "45.5%",
    top: "78.8%",
    width: "5%",
    height: "1.2%",
    kind: "opening",
    source: "architectural",
  },
  {
    id: "DEMO-DOOR-2",
    label: "Door DD2",
    confidence: 92,
    left: "31.5%",
    top: "53.4%",
    width: "5%",
    height: "1.2%",
    kind: "opening",
    source: "architectural",
  },
  // --- Four columns on the corner grid; isAiGenerated → gold material -----
  {
    id: "DEMO-COL-1",
    label: "Column DC1",
    confidence: 98,
    left: "19.1%",
    top: "19.1%",
    width: "3%",
    height: "3%",
    kind: "column",
    source: "structural",
    isAiGenerated: true,
  },
  {
    id: "DEMO-COL-2",
    label: "Column DC2",
    confidence: 98,
    left: "77.9%",
    top: "19.1%",
    width: "3%",
    height: "3%",
    kind: "column",
    source: "structural",
    isAiGenerated: true,
  },
  {
    id: "DEMO-COL-3",
    label: "Column DC3",
    confidence: 97,
    left: "19.1%",
    top: "77.9%",
    width: "3%",
    height: "3%",
    kind: "column",
    source: "structural",
    isAiGenerated: true,
  },
  {
    id: "DEMO-COL-4",
    label: "Column DC4",
    confidence: 97,
    left: "77.9%",
    top: "77.9%",
    width: "3%",
    height: "3%",
    kind: "column",
    source: "structural",
    isAiGenerated: true,
  },
  // --- Furnishings so the demo lands fully staged --------------------------
  {
    id: "DEMO-FURN-BED",
    label: "Bed",
    confidence: 86,
    left: "28%",
    top: "29.5%",
    width: "10%",
    height: "7%",
    kind: "other",
  },
  {
    id: "DEMO-FURN-SOFA",
    label: "Sofa",
    confidence: 85,
    left: "59%",
    top: "27.5%",
    width: "10%",
    height: "5%",
    kind: "other",
  },
  {
    id: "DEMO-FURN-TABLE",
    label: "Dining Table",
    confidence: 84,
    left: "35.5%",
    top: "63%",
    width: "9%",
    height: "6%",
    kind: "other",
  },
  {
    id: "DEMO-FURN-SINK",
    label: "Sink",
    confidence: 82,
    left: "66%",
    top: "58%",
    width: "8%",
    height: "4%",
    kind: "other",
  },
];

export function FloorPlan3DViewport({
  detections,
  recommendations = [],
  architecturalAudit = null,
  viewMode = "corrected",
  hasLiveResult = false,
  className,
  projectName = null,
  modelUrl = null,
  preferBimModel = true,
}: FloorPlan3DViewportProps) {
  const [showRoof, setShowRoof] = useState(true);
  const [isStagingEnabled, setIsStagingEnabled] = useState(true);
  const [bimStatus, setBimStatus] = useState<BimLoadStatus>("idle");
  const [bimAssetLabel, setBimAssetLabel] = useState<string | null>(null);
  /** Flips true once the WebGL boot effect has created scene groups + GLTFLoader. */
  const [sceneReady, setSceneReady] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const buildingRef = useRef<THREE.Group | null>(null);
  const climateRef = useRef<THREE.Group | null>(null);
  const envRef = useRef<THREE.Group | null>(null);
  const stagingRef = useRef<THREE.Group | null>(null);
  const bimRootRef = useRef<THREE.Group | null>(null);
  const bimColumnAnimsRef = useRef<BimColumnAnim[]>([]);
  const gltfLoaderRef = useRef<GLTFLoader | null>(null);
  /** Oriented wall segments from the last shell build — staging backs furniture onto them. */
  const wallSegmentsRef = useRef<WallSegment[]>([]);
  const texturesRef = useRef<THREE.Texture[]>([]);
  const materialsRef = useRef<{
    wall?: THREE.MeshStandardMaterial;
    wood?: THREE.MeshStandardMaterial;
    glass?: THREE.MeshPhysicalMaterial;
    door?: THREE.MeshStandardMaterial;
  }>({});
  const frameRef = useRef<number>(0);
  const columnAnimsRef = useRef<ColumnAnimState[]>([]);
  const viewModeRef = useRef<MaquetteViewMode>(viewMode);
  const animTRef = useRef(viewMode === "corrected" ? 1 : 0);
  const clockRef = useRef(new THREE.Clock());
  const showRoofRef = useRef(showRoof);

  viewModeRef.current = viewMode;
  showRoofRef.current = showRoof;

  const bimReady = preferBimModel && bimStatus === "ready";

  /**
   * Live detections once analysis has run, otherwise the sample template — so
   * first paint shows a furnished demo house rather than an empty scene.
   */
  const isDemoScene = !hasLiveResult || detections.length === 0;
  const sceneDetections = useMemo(
    () => (isDemoScene ? SAMPLE_ARCH_TEMPLATE : detections),
    [isDemoScene, detections]
  );

  const clashTargetIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of recommendations) {
      ids.add(r.targetDetectionId.toLowerCase());
    }
    return ids;
  }, [recommendations]);

  const deltasByColumn = useMemo(() => {
    const map = new Map<string, { dx: number; dy: number }>();
    for (const r of recommendations) {
      const key = r.targetDetectionId.toLowerCase();
      const prev = map.get(key) ?? { dx: 0, dy: 0 };
      map.set(key, { dx: prev.dx + r.deltaX, dy: prev.dy + r.deltaY });
    }
    return map;
  }, [recommendations]);

  const elementSummary = useMemo(() => {
    const roles = sceneDetections
      .map(classifyArchRole)
      .filter((r): r is ArchRole => r !== null);
    return {
      walls: roles.filter((r) => r === "wall").length,
      columns: roles.filter((r) => r === "column").length,
      doors: roles.filter((r) => r === "door").length,
      windows: roles.filter((r) => r === "window").length,
      clashColumns: [...clashTargetIds].length,
      furniture: sceneDetections.filter((d) => classifyFurniture(d) !== null)
        .length,
    };
  }, [sceneDetections, clashTargetIds]);

  // Boot photorealistic BIM scene once — cleanup must free the WebGL context
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Purge any leftover canvases from a previous HMR cycle that failed to clean up
    while (mount.firstChild) {
      mount.removeChild(mount.firstChild);
    }

    let alive = true;
    let frameId = 0;

    const width = mount.clientWidth || 640;
    const height = mount.clientHeight || 420;

    const scene = new THREE.Scene();
    // Soft sky wash
    scene.background = new THREE.Color(0xbfd9f2);
    scene.fog = new THREE.Fog(0xc9dff2, 42, 95);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 220);
    camera.position.set(16, 13, 18);
    camera.lookAt(0, 1.0, 0);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: false,
      });
    } catch (err) {
      console.error(
        "[FloorPlan3DViewport] Failed to create WebGL context — close other tabs or hard-refresh to free contexts.",
        err
      );
      sceneRef.current = null;
      cameraRef.current = null;
      return;
    }

    // Guard: some browsers create a renderer object but leave getContext() null
    if (!renderer.getContext()) {
      console.error(
        "[FloorPlan3DViewport] WebGL context is null — context limit likely exhausted."
      );
      try {
        renderer.dispose();
      } catch {
        /* ignore */
      }
      sceneRef.current = null;
      cameraRef.current = null;
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Soft sky-blue ambient fill (Hemisphere) + warm sun
    scene.add(new THREE.AmbientLight(0xfff8ef, 0.28));
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x4d7c0f, 0.72);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe4b5, 2.15);
    sun.position.set(15, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4.5;
    scene.add(sun);
    scene.add(sun.target);

    // Procedural material maps
    const grassMap = createGrassTexture();
    const woodMap = createWoodTexture();
    const plasterMap = createPlasterTexture();
    const asphaltMap = createAsphaltTexture();
    texturesRef.current = [grassMap, woodMap, plasterMap, asphaltMap];

    const wallMat = new THREE.MeshStandardMaterial({
      color: WALL_PLASTER,
      map: plasterMap,
      roughness: 0.88,
      metalness: 0.02,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: WOOD_OAK,
      map: woodMap,
      roughness: 0.72,
      metalness: 0.05,
    });
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      map: woodMap,
      roughness: 0.7,
      metalness: 0.04,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: GLASS_COLOR,
      transparent: true,
      transmission: 0.9,
      opacity: 1,
      roughness: 0.1,
      metalness: 0.1,
      ior: 1.45,
      thickness: 0.35,
      envMapIntensity: 1.2,
      clearcoat: 0.35,
      clearcoatRoughness: 0.12,
      side: THREE.DoubleSide,
    });
    materialsRef.current = {
      wall: wallMat,
      wood: woodMat,
      glass: glassMat,
      door: doorMat,
    };

    const env = new THREE.Group();
    env.name = "environment";
    scene.add(env);
    envRef.current = env;

    // --- Yard: massive grass lawn -------------------------------------------
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE * 3.2, WORLD_SIZE * 3.2),
      new THREE.MeshStandardMaterial({
        color: GRASS_BASE,
        map: grassMap,
        roughness: 0.95,
        metalness: 0,
      })
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = -0.02;
    lawn.receiveShadow = true;
    env.add(lawn);

    // --- Asphalt driveway / road --------------------------------------------
    const driveway = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE * 0.72, WORLD_SIZE * 2.4),
      new THREE.MeshStandardMaterial({
        color: DRIVEWAY,
        map: asphaltMap,
        roughness: 0.9,
        metalness: 0.08,
      })
    );
    driveway.rotation.x = -Math.PI / 2;
    driveway.position.set(WORLD_SIZE * 1.05, -0.015, 0);
    driveway.receiveShadow = true;
    env.add(driveway);

    // Curb strip between lawn and driveway
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.08, WORLD_SIZE * 2.4),
      new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        roughness: 0.85,
        metalness: 0.05,
      })
    );
    curb.position.set(WORLD_SIZE * 0.68, 0.02, 0);
    curb.castShadow = true;
    curb.receiveShadow = true;
    env.add(curb);

    // --- Oak wood deck / patio under the building ---------------------------
    const deckGeo = new THREE.BoxGeometry(
      WORLD_SIZE * 1.12,
      0.12,
      WORLD_SIZE * 1.12
    );
    const deck = new THREE.Mesh(deckGeo, woodMat);
    deck.position.y = 0.0;
    deck.castShadow = true;
    deck.receiveShadow = true;
    env.add(deck);
    addEdges(deck, deckGeo, EDGE_COLOR);

    // Thin concrete foundation lip under deck
    const footing = new THREE.Mesh(
      new THREE.BoxGeometry(WORLD_SIZE * 1.16, 0.1, WORLD_SIZE * 1.16),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        map: plasterMap,
        roughness: 0.9,
        metalness: 0.03,
      })
    );
    footing.position.y = -0.1;
    footing.castShadow = true;
    footing.receiveShadow = true;
    env.add(footing);

    const building = new THREE.Group();
    building.name = "building";
    building.position.y = 0.07;
    scene.add(building);
    buildingRef.current = building;

    const climate = new THREE.Group();
    climate.name = "climate";
    climate.position.y = 0.07;
    scene.add(climate);
    climateRef.current = climate;

    // Furnishings live in their own group so the staging toggle never touches the shell
    const staging = new THREE.Group();
    staging.name = "staging";
    staging.position.y = 0.07;
    scene.add(staging);
    stagingRef.current = staging;

    // Industry-standard BIM glTF root — populated by GLTFLoader when an asset resolves
    const bimRoot = new THREE.Group();
    bimRoot.name = "bimModel";
    bimRoot.position.y = 0.07;
    scene.add(bimRoot);
    bimRootRef.current = bimRoot;
    gltfLoaderRef.current = new GLTFLoader();
    setSceneReady(true);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.minDistance = 8;
    controls.maxDistance = 48;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.set(0, 1.1, 0);
    controls.update();
    controlsRef.current = controls;

    const onResize = () => {
      if (!mount || !cameraRef.current || !rendererRef.current) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      cameraRef.current.aspect = w / Math.max(h, 1);
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    const amber = new THREE.Color(COLUMN_CLASH);
    const emerald = new THREE.Color(COLUMN_RESOLVED);
    const tmpColor = new THREE.Color();

    const animate = () => {
      if (!alive) return;
      frameId = requestAnimationFrame(animate);
      frameRef.current = frameId;
      const dt = Math.min(clockRef.current.getDelta(), 0.05);

      const targetT = viewModeRef.current === "corrected" ? 1 : 0;
      animTRef.current += (targetT - animTRef.current) * Math.min(1, dt * 5.5);
      const t = animTRef.current;

      for (const col of columnAnimsRef.current) {
        if (!col.isClash) continue;
        col.mesh.position.lerpVectors(col.origin, col.corrected, t);
        tmpColor.copy(amber).lerp(emerald, t);
        col.material.color.copy(tmpColor);
        col.material.emissive.copy(tmpColor).multiplyScalar(0.1);
      }

      // BIM glTF clash overlay — same original↔corrected lerp as procedural columns
      if (bimColumnAnimsRef.current.length > 0) {
        applyBimClashPose(
          bimColumnAnimsRef.current,
          t,
          COLUMN_CLASH,
          COLUMN_RESOLVED
        );
      }

      controlsRef.current?.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    return () => {
      // 1) Stop the render loop immediately (prevents post-unmount GL calls)
      alive = false;
      cancelAnimationFrame(frameId);
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;

      window.removeEventListener("resize", onResize);

      try {
        controls.dispose();
      } catch {
        /* ignore */
      }
      columnAnimsRef.current = [];

      // 2) Dispose all GPU resources under the scene (meshes, lines, groups)
      try {
        scene.traverse((object) => {
          const obj = object as THREE.Mesh & THREE.Line;
          if (obj.isMesh || obj.isLine) {
            if (obj.geometry) obj.geometry.dispose();
            const mat = obj.material;
            if (Array.isArray(mat)) {
              mat.forEach((m) => m.dispose());
            } else if (mat) {
              (mat as THREE.Material).dispose();
            }
          }
        });
      } catch {
        /* ignore */
      }

      if (buildingRef.current) {
        disposeObject3D(buildingRef.current);
        scene.remove(buildingRef.current);
      }
      if (climateRef.current) {
        disposeObject3D(climateRef.current);
        scene.remove(climateRef.current);
      }
      if (stagingRef.current) {
        disposeObject3D(stagingRef.current);
        scene.remove(stagingRef.current);
      }
      if (bimRootRef.current) {
        restoreBimColumnMaterials(bimColumnAnimsRef.current);
        disposeObject3D(bimRootRef.current);
        scene.remove(bimRootRef.current);
        bimRootRef.current = null;
      }
      bimColumnAnimsRef.current = [];
      if (envRef.current) {
        disposeObject3D(envRef.current);
        scene.remove(envRef.current);
      }

      for (const tex of texturesRef.current) {
        try {
          tex.dispose();
        } catch {
          /* ignore */
        }
      }
      texturesRef.current = [];
      Object.values(materialsRef.current).forEach((m) => {
        try {
          m?.dispose();
        } catch {
          /* ignore */
        }
      });
      materialsRef.current = {};

      disposeObject3D(scene);
      while (scene.children.length) {
        scene.remove(scene.children[0]);
      }

      // 3) Destroy WebGL context + remove canvas from DOM (HMR-critical)
      disposeWebGLRenderer(renderer, mount);

      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      buildingRef.current = null;
      climateRef.current = null;
      envRef.current = null;
      stagingRef.current = null;
      bimRootRef.current = null;
      gltfLoaderRef.current = null;
      wallSegmentsRef.current = [];
      setSceneReady(false);
    };
  }, []);

  // Toggle gabled roof visibility without rebuilding the scene
  useEffect(() => {
    const climate = climateRef.current;
    if (!climate) return;
    const roof = climate.getObjectByName("roofGroup");
    if (roof) roof.visible = showRoof;
  }, [showRoof]);

  /**
   * BIM GLTF loader — tries project-mapped `.glb` URLs, fits the asset onto the
   * lawn, then binds named Column_* meshes to the GCR clash overlay. On total
   * failure we leave `bimStatus = "fallback"` so the procedural house stays.
   */
  useEffect(() => {
    if (!sceneReady) return;
    const scene = sceneRef.current;
    const bimRoot = bimRootRef.current;
    const loader = gltfLoaderRef.current;
    if (!scene || !bimRoot || !loader) return;

    let cancelled = false;

    const clearBim = () => {
      restoreBimColumnMaterials(bimColumnAnimsRef.current);
      bimColumnAnimsRef.current = [];
      while (bimRoot.children.length) {
        const child = bimRoot.children[0];
        bimRoot.remove(child);
        disposeObject3D(child);
      }
    };

    if (!preferBimModel) {
      clearBim();
      setBimStatus("fallback");
      setBimAssetLabel(null);
      if (buildingRef.current) buildingRef.current.visible = true;
      return;
    }

    const urls = bimUrlCandidates(projectName, modelUrl);
    setBimStatus("loading");
    setBimAssetLabel(null);

    const tryLoad = (index: number) => {
      if (cancelled) return;
      if (index >= urls.length) {
        clearBim();
        setBimStatus("fallback");
        setBimAssetLabel(null);
        if (buildingRef.current) buildingRef.current.visible = true;
        console.warn(
          "[FloorPlan3DViewport] No BIM .glb resolved — using procedural extrusion.",
          urls
        );
        return;
      }

      const url = urls[index];
      loader.load(
        url,
        (gltf) => {
          if (cancelled) {
            disposeObject3D(gltf.scene);
            return;
          }
          clearBim();
          const model = gltf.scene;
          model.name = "bimHouse";
          enableBimShadows(model);
          fitBimModelToLawn(model);
          bimRoot.add(model);

          // Clash binding happens in the dedicated effect once status is ready
          if (buildingRef.current) buildingRef.current.visible = false;
          if (stagingRef.current) stagingRef.current.visible = false;

          setBimStatus("ready");
          setBimAssetLabel(url.split("/").pop() ?? url);
          console.info(`[FloorPlan3DViewport] BIM model loaded: ${url}`);
        },
        undefined,
        (err) => {
          console.warn(
            `[FloorPlan3DViewport] BIM asset failed (${url}) — trying next candidate.`,
            err
          );
          tryLoad(index + 1);
        }
      );
    };

    tryLoad(0);

    return () => {
      cancelled = true;
    };
  }, [preferBimModel, projectName, modelUrl, sceneReady]);

  // Bind / refresh clash overlay whenever recommendations or the loaded model change
  useEffect(() => {
    const bimRoot = bimRootRef.current;
    if (!bimRoot || bimStatus !== "ready") return;
    const model = bimRoot.getObjectByName("bimHouse") ?? bimRoot.children[0];
    if (!model) return;

    restoreBimColumnMaterials(bimColumnAnimsRef.current);
    bimColumnAnimsRef.current = bindBimClashColumns(
      model,
      clashTargetIds,
      deltasByColumn,
      CANVAS_PX,
      WORLD_SIZE
    );
    animTRef.current = viewModeRef.current === "corrected" ? 1 : 0;
    applyBimClashPose(
      bimColumnAnimsRef.current,
      animTRef.current,
      COLUMN_CLASH,
      COLUMN_RESOLVED
    );
    console.info(
      `[FloorPlan3DViewport] BIM clash overlay · ` +
        `${bimColumnAnimsRef.current.length} named column(s) · ` +
        `${bimColumnAnimsRef.current.filter((c) => c.isClash).length} clash target(s)`
    );
  }, [clashTargetIds, deltasByColumn, bimStatus]);

  // Rebuild building + climate overlays when detections / audit change
  useEffect(() => {
    const building = buildingRef.current;
    const climate = climateRef.current;
    if (!building || !climate) return;

    while (building.children.length) {
      const child = building.children[0];
      building.remove(child);
      disposeObject3D(child);
    }
    while (climate.children.length) {
      const child = climate.children[0];
      climate.remove(child);
      disposeObject3D(child);
    }
    columnAnimsRef.current = [];
    wallSegmentsRef.current = [];

    // Keep procedural group hidden while a BIM asset owns the viewport
    building.visible = !bimReady;
    if (stagingRef.current) {
      stagingRef.current.visible = !bimReady && isStagingEnabled;
    }

    if (sceneDetections.length === 0) return;

    const wallMat = materialsRef.current.wall;
    const woodMat = materialsRef.current.wood;
    if (!wallMat || !woodMat) return;

    const t0 = viewModeRef.current === "corrected" ? 1 : 0;
    animTRef.current = t0;

    // When BIM is ready we still rebuild climate overlays from detections, but
    // skip the procedural masonry / openings / columns to avoid double houses.
    if (bimReady) {
      // No procedural gable — the glTF already has its own roof
      buildSolarTrajectory(climate);
      buildWindFlowVectors(climate, sceneDetections, architecturalAudit);
      return;
    }

    // Pre-pass: AABB footprints → oriented segments (atan2 rotation) + corner extend
    const rawWalls: Array<{ x: number; z: number; sx: number; sz: number }> =
      [];
    for (const box of sceneDetections) {
      if (classifyArchRole(box) !== "wall") continue;
      const foot = boxToWorld(box);
      rawWalls.push({ x: foot.x, z: foot.z, sx: foot.sx, sz: foot.sz });
    }
    const mergedWalls = applyWallCornerMerging(rawWalls);
    wallSegmentsRef.current = mergedWalls;
    const doorCuts = collectAlignedDoorCuts(sceneDetections, mergedWalls);

    for (let wi = 0; wi < mergedWalls.length; wi++) {
      addWallWithDoorwayCuts(
        building,
        mergedWalls[wi],
        wi,
        doorCuts,
        wallMat
      );
    }

    for (const box of sceneDetections) {
      const role = classifyArchRole(box);
      if (!role || role === "wall") continue;

      const { height, elevation } = roleExtrusion(role);
      const isClashColumn =
        role === "column" && clashTargetIds.has(box.id.toLowerCase());
      const delta = deltasByColumn.get(box.id.toLowerCase()) ?? {
        dx: 0,
        dy: 0,
      };

      const originFoot = boxToWorld(box, 0, 0);
      const correctedFoot = boxToWorld(box, delta.dx, delta.dy);
      const foot = t0 > 0.5 ? correctedFoot : originFoot;

      if (role === "window") {
        addFramedWindow(building, foot, mergedWalls);
        continue;
      }
      if (role === "door") {
        addFramedDoor(building, foot, mergedWalls);
        continue;
      }

      // Columns: fixed 0.32×0.32 cross-section so they protrude past 0.18 walls
      const sx = role === "column" ? COLUMN_SIZE : foot.sx;
      const sz = role === "column" ? COLUMN_SIZE : Math.max(0.1, foot.sz);

      let material: THREE.Material;
      if (isClashColumn) {
        material = new THREE.MeshStandardMaterial({
          color: t0 > 0.5 ? COLUMN_RESOLVED : COLUMN_CLASH,
          roughness: 0.42,
          metalness: 0.16,
          emissive: t0 > 0.5 ? COLUMN_RESOLVED : COLUMN_CLASH,
          emissiveIntensity: 0.1,
        });
      } else if (role === "column" && box.isAiGenerated) {
        material = new THREE.MeshStandardMaterial({
          color: GOLD,
          roughness: 0.38,
          metalness: 0.35,
          emissive: GOLD,
          emissiveIntensity: 0.12,
        });
      } else {
        material = woodMat;
      }

      const geometry = new THREE.BoxGeometry(sx, height, sz);
      const mesh = new THREE.Mesh(geometry, material);
      const y = elevation + height / 2;
      mesh.position.set(foot.x, y, foot.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.archRole = role;
      building.add(mesh);

      if (role === "column") {
        addEdges(mesh, geometry, EDGE_COLOR);
      }

      if (role === "column" && isClashColumn) {
        columnAnimsRef.current.push({
          mesh,
          material: material as THREE.MeshStandardMaterial,
          origin: new THREE.Vector3(originFoot.x, y, originFoot.z),
          corrected: new THREE.Vector3(correctedFoot.x, y, correctedFoot.z),
          isClash: true,
        });
      }
    }

    // --- Climatic & architectural overlays (gabled පියස්ස + solar + wind) ---
    const footprint = computeBuildingFootprint(sceneDetections);
    buildGabledRoof(climate, footprint, showRoofRef.current);
    buildSolarTrajectory(climate);
    buildWindFlowVectors(climate, sceneDetections, architecturalAudit);
  }, [
    sceneDetections,
    clashTargetIds,
    deltasByColumn,
    architecturalAudit,
    bimReady,
    isStagingEnabled,
  ]);

  /**
   * Virtual staging pass. Runs after the shell rebuild so ``wallSegmentsRef``
   * is populated, letting each piece orient its back against the nearest wall.
   */
  useEffect(() => {
    const staging = stagingRef.current;
    if (!staging) return;

    while (staging.children.length) {
      const child = staging.children[0];
      staging.remove(child);
      disposeObject3D(child);
    }

    // BIM glTF already contains interior geometry — skip parametric staging
    if (bimReady || !isStagingEnabled || sceneDetections.length === 0) {
      staging.visible = false;
      return;
    }
    staging.visible = true;

    const walls = wallSegmentsRef.current;
    const mats = createStagingMaterials();
    const occupied: Array<{ x: number; z: number; r: number }> = [];

    for (const box of sceneDetections) {
      const kind = classifyFurniture(box);
      if (!kind) continue;

      const foot = boxToWorld(box);
      occupied.push({
        x: foot.x,
        z: foot.z,
        r: Math.max(foot.sx, foot.sz) / 2,
      });

      switch (kind) {
        case "bed":
          addStagedBed(staging, foot, walls, mats);
          break;
        case "sofa":
          addStagedSofa(staging, foot, walls, mats);
          break;
        case "table":
          addStagedTable(staging, foot, mats);
          break;
        case "sink":
          addStagedSink(staging, foot, walls, mats);
          break;
      }
    }

    // Deco pass: planters in whichever room corners no furniture claimed
    const footprint = computeBuildingFootprint(sceneDetections);
    for (const [x, z] of planCornerPlanters(footprint, occupied)) {
      addStagedPlant(staging, x, z, mats);
    }
  }, [sceneDetections, isStagingEnabled, bimReady]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury",
        className
      )}
    >
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Photorealistic BIM Viewport
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={isStagingEnabled}
              onClick={() => setIsStagingEnabled((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all",
                isStagingEnabled
                  ? "border-[#D4AF37]/55 bg-gradient-to-r from-[#D4AF37]/20 to-[#D4AF37]/5 text-[#8A6D1F] shadow-[0_1px_10px_rgba(212,175,55,0.28)]"
                  : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
              )}
            >
              <Sofa className="h-3.5 w-3.5" aria-hidden />
              Virtual Staging (Furnish House)
              <span
                className={cn(
                  "relative ml-0.5 h-4 w-7 rounded-full transition-colors",
                  isStagingEnabled ? "bg-[#D4AF37]" : "bg-slate-300"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform",
                    isStagingEnabled ? "translate-x-3.5" : "translate-x-0.5"
                  )}
                />
              </span>
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 transition-colors hover:border-slate-300">
              <input
                type="checkbox"
                checked={showRoof}
                onChange={(e) => setShowRoof(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-slate-800 accent-[#D4AF37] focus:ring-[#D4AF37]/40"
              />
              Show Roof
            </label>
            {hasLiveResult ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  viewMode === "corrected"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-orange-200 bg-orange-50 text-orange-800"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    viewMode === "corrected" ? "bg-emerald-500" : "bg-orange-500"
                  )}
                />
                {viewMode === "corrected" ? "AI-Corrected 3D" : "Original Clash 3D"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/[0.07] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8A6D1F]">
                <Sparkles className="h-3 w-3" aria-hidden />
                Sample Template
              </span>
            )}
            {bimStatus === "loading" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">
                Loading BIM…
              </span>
            )}
            {bimStatus === "ready" && bimAssetLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-800">
                <Box className="h-3 w-3" aria-hidden />
                BIM · {bimAssetLabel}
              </span>
            )}
            {bimStatus === "fallback" && preferBimModel && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Procedural shell
              </span>
            )}
          </div>
        </div>
        <h2 className="mt-1 text-lg font-bold text-slate-900">
          3D Workspace View
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {bimStatus === "ready"
            ? `BIM glTF · ${bimAssetLabel ?? "model"} · ${
                clashTargetIds.size
              } clash column(s) · ${
                viewMode === "corrected" ? "resolved emerald" : "warning overlay"
              }`
            : `${isDemoScene ? "Sample template · " : ""}${elementSummary.walls} walls · ${
                elementSummary.columns
              } columns · ${elementSummary.doors} doors · ${
                elementSummary.windows
              } windows${
                isStagingEnabled && !bimReady
                  ? ` · ${elementSummary.furniture} staged furnishings`
                  : ""
              }`}
        </p>
      </div>

      <div className="relative p-4 sm:p-5">
        <div
          ref={mountRef}
          className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-sky-100 sm:aspect-[16/10]"
          role="img"
          aria-label="Photorealistic BIM architectural viewport"
        />

        {/* Demo notice sits in the corner: the sample house stays fully visible */}
        {!hasLiveResult && (
          <div className="pointer-events-none absolute left-7 top-7 max-w-[17rem] rounded-xl border border-[#D4AF37]/35 bg-white/92 px-3.5 py-3 shadow-luxury backdrop-blur-sm sm:left-8 sm:top-8">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">
              <Box className="h-3.5 w-3.5" aria-hidden />
              Sample Architectural Template
            </p>
            <p className="mt-1.5 text-xs font-semibold leading-snug text-slate-800">
              Process blueprints in 2D view to render your own floor plan in 3D.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Orbit to explore the demo house — 3 rooms, framed glass windows,
              ajar oak doors, gold columns and staged interiors.
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-[#10B981]" /> Grass lawn
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-3 rounded-sm border border-slate-400 bg-[#334155]/50"
              style={{ clipPath: "polygon(0% 100%, 50% 0%, 100% 100%)" }}
            />{" "}
            Gabled roof
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#D4AF37]">
            <Sun className="h-3 w-3" aria-hidden /> Solar path
          </span>
          <span className="inline-flex items-center gap-1.5 text-sky-500">
            <Wind className="h-3 w-3" aria-hidden /> Wind breeze
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-[#818cf8]/80" /> Glass
          </span>
          {isStagingEnabled && (
            <span className="inline-flex items-center gap-1.5 text-[#8A6D1F]">
              <Sofa className="h-3 w-3" aria-hidden /> Staged interior
            </span>
          )}
          <span className="ml-auto text-slate-400">
            Soft PCF sun shadows · Orbit to inspect
          </span>
        </div>
      </div>
    </div>
  );
}
