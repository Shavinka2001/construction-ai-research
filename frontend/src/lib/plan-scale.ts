/**
 * Plan scale for the 3D viewport — metres per blueprint pixel, and framing.
 *
 * The backend resolves a drawing's scale once and returns it with provenance
 * (see `app/services/plan_scale.py`). This module is the frontend half: it
 * decides which scale the 3D build should use, and — because a true-scale
 * model is no longer a fixed size — works out where to put the camera so the
 * house is framed whatever its real dimensions.
 *
 * Why this matters for the walkthrough: the viewport used to normalise every
 * plan to an assumed 18 m span, while wall height, door height, window sill
 * and the player's collision radius were all absolute metres. Horizontal
 * distances were therefore scaled by the drawing and vertical ones were not,
 * so a 12 m house rendered 16 m wide with correctly-sized 2.1 m doors in it.
 * Using the measured scale puts both axes on the same ruler.
 *
 * Pure functions only — no Three.js, no React — so the geometry decisions are
 * unit-testable without a WebGL context.
 */

export type PlanScaleSource = "DIMENSION_OCR" | "USER_SPAN" | "ASSUMED_DEFAULT";

/** Resolved drawing scale, mirroring the backend `architectural_audit.scale`. */
export type PlanScale = {
  metersPerPixel: number;
  pixelsPerMeter: number;
  source: PlanScaleSource;
  /** 0.0 assumed … 1.0 exact. */
  confidence: number;
  detail: string;
  samples: number;
  /** False when the scale was assumed rather than measured. */
  isMeasured: boolean;
  /**
   * False when metric findings derived from this scale are proportional to an
   * assumed span and must not be presented as measurements.
   */
  metricsTrustworthy: boolean;
};

/** Legacy assumption: the longer side of every footprint spans this. */
export const ASSUMED_PLAN_SPAN_M = 18;

/** Plausibility envelope for a usable scale, mirroring the backend bounds. */
export const MIN_METERS_PER_PIXEL = 0.002;
export const MAX_METERS_PER_PIXEL = 0.3;

/** Extra room left around the footprint when framing the camera. */
export const FRAMING_MARGIN = 1.18;

function isUsableMetersPerPixel(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_METERS_PER_PIXEL &&
    value <= MAX_METERS_PER_PIXEL
  );
}

/**
 * The scale the viewport falls back to when the drawing carries no evidence.
 *
 * Reported as `ASSUMED_DEFAULT` with zero confidence so the UI can say so,
 * rather than presenting a normalised model as a measured one.
 */
export function assumedPlanScale(spanPx: number): PlanScale {
  const span = Math.max(spanPx, 1);
  const metersPerPixel = ASSUMED_PLAN_SPAN_M / span;
  return {
    metersPerPixel,
    pixelsPerMeter: 1 / metersPerPixel,
    source: "ASSUMED_DEFAULT",
    confidence: 0,
    detail:
      `No measured scale — the footprint was normalised to an assumed ` +
      `${ASSUMED_PLAN_SPAN_M} m span. Dimensions in the model are indicative only.`,
    samples: 0,
    isMeasured: false,
    metricsTrustworthy: false,
  };
}

/**
 * Pick the scale to build the 3D model with.
 *
 * A measured scale from the backend wins. An assumed or implausible one is
 * replaced by the local fallback, so the viewport never silently builds with a
 * scale it cannot defend — `isMeasured` always reflects reality.
 */
export function resolvePlanScale(
  apiScale: PlanScale | null | undefined,
  spanPx: number
): PlanScale {
  if (
    apiScale &&
    apiScale.isMeasured &&
    isUsableMetersPerPixel(apiScale.metersPerPixel)
  ) {
    return apiScale;
  }
  return assumedPlanScale(spanPx);
}

/**
 * Parse the backend `architectural_audit.scale` block into a {@link PlanScale}.
 *
 * Returns null for a missing or unusable block rather than inventing a scale;
 * the caller then falls back through {@link resolvePlanScale}.
 */
export function parsePlanScalePayload(raw: unknown): PlanScale | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;

  const metersPerPixel = Number(data.meters_per_pixel ?? data.metersPerPixel);
  if (!isUsableMetersPerPixel(metersPerPixel)) return null;

  const rawSource = String(data.source ?? "ASSUMED_DEFAULT").toUpperCase();
  const source: PlanScaleSource =
    rawSource === "DIMENSION_OCR" || rawSource === "USER_SPAN"
      ? rawSource
      : "ASSUMED_DEFAULT";

  // Trust the backend's own verdict when it sent one; otherwise derive it from
  // the source, so an older payload without the flag still behaves correctly.
  const isMeasured =
    typeof data.is_measured === "boolean"
      ? data.is_measured
      : typeof data.isMeasured === "boolean"
        ? data.isMeasured
        : source !== "ASSUMED_DEFAULT";

  const metricsTrustworthy =
    typeof data.metrics_trustworthy === "boolean"
      ? data.metrics_trustworthy
      : typeof data.metricsTrustworthy === "boolean"
        ? data.metricsTrustworthy
        : isMeasured;

  const confidence = Number(data.confidence);
  const samples = Number(data.samples);

  return {
    metersPerPixel,
    pixelsPerMeter: 1 / metersPerPixel,
    source,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    detail: String(data.detail ?? ""),
    samples: Number.isFinite(samples) ? samples : 0,
    isMeasured,
    metricsTrustworthy,
  };
}

/** Short label for the scale badge in the viewport. */
export function planScaleLabel(scale: PlanScale): string {
  const pxPerM = scale.pixelsPerMeter.toFixed(1);
  switch (scale.source) {
    case "USER_SPAN":
      return `Scale ${pxPerM} px/m · stated span`;
    case "DIMENSION_OCR":
      return `Scale ${pxPerM} px/m · read from drawing`;
    default:
      return "Scale assumed · dimensions indicative";
  }
}

// ---------------------------------------------------------------------------
// Camera framing
// ---------------------------------------------------------------------------

export type WorldBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

/**
 * Radius of the sphere enclosing the footprint and its walls.
 *
 * The camera frames a sphere rather than the box itself: the model is orbited,
 * so a box that fits head-on can still clip a corner once rotated.
 */
export function boundingRadius(bounds: WorldBounds, wallHeight: number): number {
  const halfWidth = Math.max(bounds.maxX - bounds.minX, 0) / 2;
  const halfDepth = Math.max(bounds.maxZ - bounds.minZ, 0) / 2;
  const halfHeight = Math.max(wallHeight, 0) / 2;
  return Math.max(Math.hypot(halfWidth, halfDepth, halfHeight), 0.5);
}

/**
 * Distance at which a sphere of `radius` fits inside the frustum.
 *
 * Both axes are checked. For a wide viewport the vertical field of view is the
 * binding constraint, but on a tall/narrow one — a phone in portrait, or a
 * panel docked beside the plan — the horizontal fov is smaller and would clip
 * the model if only the vertical were considered.
 */
export function framingDistance(
  radius: number,
  verticalFovDeg: number,
  aspect: number,
  margin = FRAMING_MARGIN
): number {
  const vFov = (Math.max(verticalFovDeg, 1) * Math.PI) / 180;
  const safeAspect = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * safeAspect);

  const forVertical = radius / Math.sin(vFov / 2);
  const forHorizontal = radius / Math.sin(hFov / 2);

  return Math.max(forVertical, forHorizontal) * margin;
}

/**
 * Camera position that frames the model from the house's default viewing angle.
 *
 * The direction is taken from the viewport's original fixed camera (0, 11, 16)
 * so the framing keeps the familiar raised three-quarter view; only the
 * distance now responds to how big the building actually is. Without this a
 * true-scale 9 m cottage sat in the far distance and a 25 m block overflowed
 * the frame — the fixed position only ever worked because every plan was
 * normalised to the same assumed span.
 */
export function framingCameraPosition(
  bounds: WorldBounds,
  wallHeight: number,
  verticalFovDeg: number,
  aspect: number,
  direction: readonly [number, number, number] = [0, 11, 16],
  margin = FRAMING_MARGIN
): [number, number, number] {
  const radius = boundingRadius(bounds, wallHeight);
  const distance = framingDistance(radius, verticalFovDeg, aspect, margin);

  const [dx, dy, dz] = direction;
  const length = Math.hypot(dx, dy, dz) || 1;
  const centreX = (bounds.minX + bounds.maxX) / 2;
  const centreZ = (bounds.minZ + bounds.maxZ) / 2;

  return [
    centreX + (dx / length) * distance,
    (dy / length) * distance,
    centreZ + (dz / length) * distance,
  ];
}
