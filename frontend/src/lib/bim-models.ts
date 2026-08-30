/**
 * BIM GLTF / GLB catalog & clash-overlay helpers for FloorPlan3DViewport.
 *
 * Drop production Revit/SketchUp exports into `/public/models/` using the same
 * filenames (or add aliases below). Clash columns must be named so the
 * overlay can find them — preferred: `Column_C1`, `Column_C2`, …
 */
import * as THREE from "three";
import type { GcrRecommendation } from "@/lib/clash-detection";

/** World size of the lawn plane in FloorPlan3DViewport (must stay in sync). */
export const BIM_LAWN_FIT = 20;

/**
 * Explicit project-name → asset map. Keys are lower-cased trimmed names.
 * Unknown projects fall through to `/models/{slug}.glb`, then `default_house.glb`.
 */
export const BIM_MODEL_CATALOG: Record<string, string> = {
  // Structural geometry is glTF-only now, so the default must always resolve.
  default: "/models/test1.glb",
  "default house": "/models/default_house.glb",
  "southern farmhouse": "/models/southern_farmhouse.glb",
  southern_farmhouse: "/models/southern_farmhouse.glb",
  test1: "/models/test1.glb",
  "test 1": "/models/test1.glb",
};

export type BimLoadStatus = "idle" | "loading" | "ready" | "fallback";

export type BimColumnAnim = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  origin: THREE.Vector3;
  corrected: THREE.Vector3;
  isClash: boolean;
  /** Restore when the overlay is torn down. */
  restoreColor: THREE.Color;
  restoreEmissive: THREE.Color;
  restoreEmissiveIntensity: number;
};

export function slugifyProjectName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Resolve which `.glb` to request for the active project.
 * Prefer an explicit `modelUrl` override, then the catalog, then a slug path.
 */
export function resolveBimModelUrl(
  projectName?: string | null,
  modelUrl?: string | null
): string {
  if (modelUrl && modelUrl.trim()) return modelUrl.trim();
  const raw = (projectName ?? "").trim().toLowerCase();
  if (raw && BIM_MODEL_CATALOG[raw]) return BIM_MODEL_CATALOG[raw];
  const slug = slugifyProjectName(projectName ?? "");
  if (slug && BIM_MODEL_CATALOG[slug]) return BIM_MODEL_CATALOG[slug];
  if (slug) return `/models/${slug}.glb`;
  return BIM_MODEL_CATALOG.default;
}

/** Candidate URLs to try in order (primary + default fallback asset). */
export function bimUrlCandidates(
  projectName?: string | null,
  modelUrl?: string | null
): string[] {
  const primary = resolveBimModelUrl(projectName, modelUrl);
  const fallback = BIM_MODEL_CATALOG.default;
  return primary === fallback ? [primary] : [primary, fallback];
}

/**
 * Centre the model on the lawn, sit it on y=0, and scale so the plan footprint
 * fits comfortably inside the grass deck.
 */
export function fitBimModelToLawn(
  root: THREE.Object3D,
  targetSpan = BIM_LAWN_FIT
): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const span = Math.max(size.x, size.z, 0.001);
  const scale = targetSpan / span;
  root.scale.multiplyScalar(scale);

  root.updateMatrixWorld(true);
  box.setFromObject(root);
  center.copy(box.getCenter(new THREE.Vector3()));
  root.position.x += -center.x;
  root.position.z += -center.z;
  root.position.y += -box.min.y;
}

/** Enable soft shadows on every mesh in a loaded glTF graph. */
export function enableBimShadows(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}

/**
 * Extract a detection-style id from a glTF mesh name.
 * Accepts: Column_C1, column-c2, C3, Pillar_C4, StructuralColumn_AI-C1
 */
export function columnIdFromMeshName(name: string): string | null {
  const n = name.trim();
  if (!n) return null;

  const normalize = (id: string) =>
    id
      .toUpperCase()
      .replace(/^AI[-_]?/, "")
      .replace(/^COLUMN[-_]?/, "")
      .replace(/^PILLAR[-_]?/, "");

  const patterns = [
    /(?:column|pillar)[_\s-]*([a-z0-9_-]+)/i,
    /^(ai[-_]?c\d+[a-z0-9_-]*)$/i,
    /^(c\d+[a-z0-9_-]*)$/i,
  ];
  for (const re of patterns) {
    const m = n.match(re);
    if (!m) continue;
    const raw = (m[1] ?? m[0]).trim();
    if (!raw) continue;
    const id = normalize(raw);
    return id || null;
  }
  return null;
}

function ensureStandardMaterial(
  mesh: THREE.Mesh
): THREE.MeshStandardMaterial | null {
  const mat = mesh.material;
  if (Array.isArray(mat)) {
    const first = mat[0];
    if (first && "color" in first) {
      const clone = (first as THREE.MeshStandardMaterial).clone();
      mesh.material = clone;
      return clone;
    }
    return null;
  }
  if (mat && "color" in mat) {
    const clone = (mat as THREE.MeshStandardMaterial).clone();
    mesh.material = clone;
    return clone;
  }
  // Upgrade basic materials so emissive tinting works
  const upgraded = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.4,
    metalness: 0.2,
  });
  mesh.material = upgraded;
  return upgraded;
}

/**
 * Walk the loaded BIM scene, bind clash-target columns to the GCR deltas, and
 * prepare materials for original/corrected animation.
 *
 * ``delta`` values are canvas pixels (same contract as the procedural path);
 * they are converted to world units with the shared 1024 → WORLD_SIZE scale.
 */
export function bindBimClashColumns(
  root: THREE.Object3D,
  clashTargetIds: Set<string>,
  deltasByColumn: Map<string, { dx: number; dy: number }>,
  canvasPx: number,
  worldSize: number
): BimColumnAnim[] {
  const anims: BimColumnAnim[] = [];
  const pxToWorld = worldSize / canvasPx;

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const colId = columnIdFromMeshName(mesh.name);
    if (!colId) return;

    const key = colId.toLowerCase();
    // Also accept "c1" matching target "C1" / "column c1"
    const isClash =
      clashTargetIds.has(key) ||
      [...clashTargetIds].some(
        (id) => id === key || id.endsWith(key) || key.endsWith(id)
      );

    const material = ensureStandardMaterial(mesh);
    if (!material) return;

    const origin = mesh.position.clone();
    const delta = deltasByColumn.get(key) ?? { dx: 0, dy: 0 };
    // Loose key match for AI-C1 vs C1
    let resolvedDelta = delta;
    if (delta.dx === 0 && delta.dy === 0) {
      for (const [k, v] of deltasByColumn) {
        if (k.includes(key) || key.includes(k)) {
          resolvedDelta = v;
          break;
        }
      }
    }

    const corrected = origin.clone().add(
      new THREE.Vector3(
        resolvedDelta.dx * pxToWorld,
        0,
        resolvedDelta.dy * pxToWorld
      )
    );

    anims.push({
      mesh,
      material,
      origin,
      corrected,
      isClash: isClash || resolvedDelta.dx !== 0 || resolvedDelta.dy !== 0,
      restoreColor: material.color.clone(),
      restoreEmissive: material.emissive?.clone() ?? new THREE.Color(0x000000),
      restoreEmissiveIntensity: material.emissiveIntensity ?? 0,
    });
  });

  return anims;
}

export function applyBimClashPose(
  anims: BimColumnAnim[],
  t: number,
  clashColor: number,
  resolvedColor: number
): void {
  const amber = new THREE.Color(clashColor);
  const emerald = new THREE.Color(resolvedColor);
  const tmp = new THREE.Color();

  for (const col of anims) {
    if (!col.isClash) continue;
    col.mesh.position.lerpVectors(col.origin, col.corrected, t);
    tmp.copy(amber).lerp(emerald, t);
    col.material.color.copy(tmp);
    col.material.emissive.copy(tmp).multiplyScalar(0.12);
    col.material.emissiveIntensity = 0.2 + 0.15 * (1 - Math.abs(t - 0.5) * 2);
  }
}

export function restoreBimColumnMaterials(anims: BimColumnAnim[]): void {
  for (const col of anims) {
    col.mesh.position.copy(col.origin);
    col.material.color.copy(col.restoreColor);
    col.material.emissive.copy(col.restoreEmissive);
    col.material.emissiveIntensity = col.restoreEmissiveIntensity;
  }
}

/** Convenience: build a lookup of recommendations for tests / debug HUD. */
export function summarizeClashTargets(
  recommendations: GcrRecommendation[]
): string[] {
  return [...new Set(recommendations.map((r) => r.targetDetectionId))];
}
