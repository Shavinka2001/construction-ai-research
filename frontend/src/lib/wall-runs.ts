/**
 * Wall-run geometry for the blueprint-driven 3D viewport.
 *
 * Extracted wall centrelines arrive fragmented, slightly rotated and often
 * stopping short of their corners. These helpers turn that into a watertight
 * orthogonal layout: diagonals are discarded, parallel walls share grid lines,
 * ends weld onto crossing walls, and remaining holes in the exterior boundary
 * are filled. Everything here is pure so it can be unit tested without WebGL.
 */

/** Directed wall centreline in world metres (X east, Z south). */
export type WorldSeg = { sx: number; sz: number; ex: number; ez: number };

/** A wall centreline plus the masonry thickness to extrude it at. */
export type WallRun = WorldSeg & { depth: number };

/** Axis a wall run travels along: "x" is horizontal, "z" is vertical. */
export type Axis = "x" | "z";

export type WallBounds = { minX: number; maxX: number; minZ: number; maxZ: number };

export type Span = [number, number];

export type EdgeId = "north" | "south" | "west" | "east";

export type EdgeSpec = {
  id: EdgeId;
  axis: Axis;
  /** Coordinate of the axis this edge is pinned to. */
  fixed: number;
  a0: number;
  a1: number;
};

/** Minimum wall run (metres) worth extruding — below this it's stroke noise. */
export const MIN_WALL_RUN_M = 0.45;
/** Strict residential grid: only 0° / 90° walls survive; diagonals are deleted. */
export const ORTHO_TOL_RAD = (5 * Math.PI) / 180;
/** Blueprint pixel tolerances mirrored into world metres at runtime. */
export const PIXEL_CORNER_SNAP = 15;
export const PIXEL_DOUBLE_WALL_MAX_GAP = 25;
export const PIXEL_DOUBLE_WALL_MIN_GAP = 5;
/** Parallel runs whose centrelines land this close share one grid line. */
export const GRID_SNAP_M = 0.15;
/** A run end this close to a perpendicular run's line is welded onto it. */
export const CORNER_WELD_M = 0.35;
/** How close a wall must be to a bounds edge to count as covering that side. */
export const EDGE_COVER_TOL = 0.55;

export function runLength(run: WorldSeg): number {
  return Math.hypot(run.ex - run.sx, run.ez - run.sz);
}

export function runAxis(run: WorldSeg): Axis {
  return Math.abs(run.ex - run.sx) >= Math.abs(run.ez - run.sz) ? "x" : "z";
}

/**
 * Force every run onto the orthogonal grid, discarding oblique strokes.
 *
 * Floor plans are drawn on a rectangular grid, so a slanted run is never real
 * masonry — it is a leader line, a hatch, or an arbitrary `minAreaRect` long
 * axis measured on a stubby ink blob. Extruded, those become diagonal "wing"
 * slabs sticking out of the building, so they are dropped rather than squared.
 */
export function orthogonalizeRuns(runs: WallRun[]): WallRun[] {
  const out: WallRun[] = [];
  for (const run of runs) {
    const dx = run.ex - run.sx;
    const dz = run.ez - run.sz;
    if (Math.hypot(dx, dz) < MIN_WALL_RUN_M) continue;

    const angle = Math.atan2(Math.abs(dz), Math.abs(dx));
    if (angle <= ORTHO_TOL_RAD) {
      const z = (run.sz + run.ez) / 2;
      out.push({
        sx: Math.min(run.sx, run.ex),
        ex: Math.max(run.sx, run.ex),
        sz: z,
        ez: z,
        depth: run.depth,
      });
    } else if (angle >= Math.PI / 2 - ORTHO_TOL_RAD) {
      const x = (run.sx + run.ex) / 2;
      out.push({
        sx: x,
        ex: x,
        sz: Math.min(run.sz, run.ez),
        ez: Math.max(run.sz, run.ez),
        depth: run.depth,
      });
    }
  }
  return out;
}

/** Average clusters of nearby values into shared grid lines. */
export function buildGridLines(values: number[], tol: number): number[] {
  const groups: number[][] = [];
  for (const v of [...values].sort((a, b) => a - b)) {
    const last = groups[groups.length - 1];
    if (last && v - last[0] <= tol) last.push(v);
    else groups.push([v]);
  }
  return groups.map((g) => g.reduce((a, b) => a + b, 0) / g.length);
}

export function nearestGridLine(value: number, lines: number[], tol: number): number {
  let best = value;
  let bestGap = tol;
  for (const line of lines) {
    const gap = Math.abs(line - value);
    if (gap < bestGap) {
      bestGap = gap;
      best = line;
    }
  }
  return best;
}

/** Convert blueprint pixel tolerances to world metres for the current plan scale. */
export function snapTolerancesFromScale(scale: number) {
  return {
    gridSnap: Math.max(0.08, PIXEL_CORNER_SNAP * scale),
    cornerWeld: Math.max(0.12, PIXEL_CORNER_SNAP * scale),
    doubleWallMin: Math.max(0.06, PIXEL_DOUBLE_WALL_MIN_GAP * scale),
    doubleWallMax: Math.max(0.18, PIXEL_DOUBLE_WALL_MAX_GAP * scale),
    fuseCollinear: Math.max(0.05, 6 * scale),
  };
}

function runSpan(run: WallRun, axis: Axis): { lo: number; hi: number; perp: number } {
  if (axis === "x") {
    return {
      lo: Math.min(run.sx, run.ex),
      hi: Math.max(run.sx, run.ex),
      perp: (run.sz + run.ez) / 2,
    };
  }
  return {
    lo: Math.min(run.sz, run.ez),
    hi: Math.max(run.sz, run.ez),
    perp: (run.sx + run.ex) / 2,
  };
}

/**
 * Merge parallel inner/outer CAD face lines into a single centreline.
 *
 * Two strokes spaced within the double-wall band become one run at the midpoint
 * so the 3D viewport never extrudes overlapping slabs for a single wall.
 */
export function mergeDoubleWallRuns(
  runs: WallRun[],
  minGap: number,
  maxGap: number,
  minOverlap = 0.35
): WallRun[] {
  if (runs.length < 2) return runs;

  const buckets: Record<Axis, WallRun[]> = { x: [], z: [] };
  for (const run of runs) {
    buckets[runAxis(run)].push(run);
  }

  const used = new Set<WallRun>();
  const merged: WallRun[] = [];

  for (const axis of ["x", "z"] as const) {
    for (const seed of buckets[axis]) {
      if (used.has(seed)) continue;
      const cluster = [seed];
      used.add(seed);
      let { lo, hi } = runSpan(seed, axis);
      const perps = [runSpan(seed, axis).perp];

      let expanded = true;
      while (expanded) {
        expanded = false;
        for (const other of buckets[axis]) {
          if (used.has(other)) continue;
          const span = runSpan(other, axis);
          const overlap = Math.min(hi, span.hi) - Math.max(lo, span.lo);
          if (overlap < minOverlap) continue;
          const minPerpGap = Math.min(...perps.map((p) => Math.abs(span.perp - p)));
          if (minPerpGap >= minGap && minPerpGap <= maxGap) {
            cluster.push(other);
            used.add(other);
            perps.push(span.perp);
            lo = Math.min(lo, span.lo);
            hi = Math.max(hi, span.hi);
            expanded = true;
          }
        }
      }

      if (cluster.length === 1) {
        merged.push(seed);
        continue;
      }

      const perp = perps.reduce((a, b) => a + b, 0) / perps.length;
      const depth = Math.max(...cluster.map((r) => r.depth));
      merged.push(
        axis === "x"
          ? { sx: lo, ex: hi, sz: perp, ez: perp, depth }
          : { sx: perp, ex: perp, sz: lo, ez: hi, depth }
      );
    }
  }

  return merged;
}

/**
 * Pull parallel runs onto shared grid lines.
 *
 * Separate extraction passes measure the same wall a few centimetres apart, so
 * nominally collinear walls are slightly offset and their corners never meet.
 */
export function alignRunsToGrid(runs: WallRun[], gridSnap = GRID_SNAP_M): WallRun[] {
  const xLines = buildGridLines(
    runs.filter((r) => runAxis(r) === "z").map((r) => r.sx),
    gridSnap
  );
  const zLines = buildGridLines(
    runs.filter((r) => runAxis(r) === "x").map((r) => r.sz),
    gridSnap
  );

  return runs
    .map((run) => {
      if (runAxis(run) === "x") {
        const z = nearestGridLine(run.sz, zLines, gridSnap);
        return {
          ...run,
          sz: z,
          ez: z,
          sx: nearestGridLine(run.sx, xLines, gridSnap),
          ex: nearestGridLine(run.ex, xLines, gridSnap),
        };
      }
      const x = nearestGridLine(run.sx, xLines, gridSnap);
      return {
        ...run,
        sx: x,
        ex: x,
        sz: nearestGridLine(run.sz, zLines, gridSnap),
        ez: nearestGridLine(run.ez, zLines, gridSnap),
      };
    })
    .filter((r) => runLength(r) >= MIN_WALL_RUN_M);
}

/**
 * Extend run ends onto crossing perpendicular runs so corners close.
 *
 * Extraction stops a wall short wherever the ink thins out, which reads as an
 * open gap in the exterior boundary or a detached floating slab.
 */
export function weldRunCorners(runs: WallRun[], cornerWeld = CORNER_WELD_M): WallRun[] {
  const verticals = runs.filter((r) => runAxis(r) === "z");
  const horizontals = runs.filter((r) => runAxis(r) === "x");

  const weldEnd = (
    value: number,
    along: number,
    others: WallRun[],
    axis: Axis
  ): number => {
    let best = value;
    let bestGap = cornerWeld;
    for (const o of others) {
      const line = axis === "x" ? o.sx : o.sz;
      const lo = axis === "x" ? Math.min(o.sz, o.ez) : Math.min(o.sx, o.ex);
      const hi = axis === "x" ? Math.max(o.sz, o.ez) : Math.max(o.sx, o.ex);
      if (along < lo - cornerWeld || along > hi + cornerWeld) continue;
      const gap = Math.abs(line - value);
      if (gap < bestGap) {
        bestGap = gap;
        best = line;
      }
    }
    return best;
  };

  return runs
    .map((run) => {
      if (runAxis(run) === "x") {
        return {
          ...run,
          sx: weldEnd(run.sx, run.sz, verticals, "x"),
          ex: weldEnd(run.ex, run.sz, verticals, "x"),
        };
      }
      return {
        ...run,
        sz: weldEnd(run.sz, run.sx, horizontals, "z"),
        ez: weldEnd(run.ez, run.sx, horizontals, "z"),
      };
    })
    .filter((r) => runLength(r) >= MIN_WALL_RUN_M);
}

export type CutoutCorner = "nw" | "ne" | "sw" | "se";

/** Axis-aligned concave inset — the car porch / veranda cutout. */
export type CornerCutout = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  corner: CutoutCorner;
};

/**
 * Split runs that ride the house AABB and overlap a known cutout.
 *
 * A dimension line or a yard-contour edge often closes the car porch mouth
 * by spanning the full south / east AABB. Those spans are removed; the inner
 * L of the porch (sitting-room east wall, dining south wall) is left alone
 * because it does not sit on the AABB.
 */
export function trimRunsAgainstCutout(
  runs: WallRun[],
  cutout: CornerCutout,
  bounds: WallBounds = boundsFromRuns(runs),
  edgeTol = EDGE_COVER_TOL
): WallRun[] {
  const keep: WallRun[] = [];

  const splitHorizontal = (run: WallRun): WallRun[] => {
    const lo = Math.min(run.sx, run.ex);
    const hi = Math.max(run.sx, run.ex);
    const pieces: WallRun[] = [];
    if (lo < cutout.minX - 0.05) {
      pieces.push({
        ...run,
        sx: lo,
        ex: Math.min(hi, cutout.minX),
        sz: run.sz,
        ez: run.sz,
      });
    }
    if (hi > cutout.maxX + 0.05) {
      pieces.push({
        ...run,
        sx: Math.max(lo, cutout.maxX),
        ex: hi,
        sz: run.sz,
        ez: run.sz,
      });
    }
    return pieces.filter((p) => runLength(p) >= MIN_WALL_RUN_M);
  };

  const splitVertical = (run: WallRun): WallRun[] => {
    const lo = Math.min(run.sz, run.ez);
    const hi = Math.max(run.sz, run.ez);
    const pieces: WallRun[] = [];
    if (lo < cutout.minZ - 0.05) {
      pieces.push({
        ...run,
        sz: lo,
        ez: Math.min(hi, cutout.minZ),
        sx: run.sx,
        ex: run.sx,
      });
    }
    if (hi > cutout.maxZ + 0.05) {
      pieces.push({
        ...run,
        sz: Math.max(lo, cutout.maxZ),
        ez: hi,
        sx: run.sx,
        ex: run.sx,
      });
    }
    return pieces.filter((p) => runLength(p) >= MIN_WALL_RUN_M);
  };

  for (const run of runs) {
    if (runAxis(run) === "x") {
      const onNorth = Math.abs(run.sz - bounds.minZ) <= edgeTol;
      const onSouth = Math.abs(run.sz - bounds.maxZ) <= edgeTol;
      const overlapsX =
        Math.min(run.sx, run.ex) < cutout.maxX - 0.05 &&
        Math.max(run.sx, run.ex) > cutout.minX + 0.05;
      if ((onNorth || onSouth) && overlapsX) {
        keep.push(...splitHorizontal(run));
        continue;
      }
    } else {
      const onWest = Math.abs(run.sx - bounds.minX) <= edgeTol;
      const onEast = Math.abs(run.sx - bounds.maxX) <= edgeTol;
      const overlapsZ =
        Math.min(run.sz, run.ez) < cutout.maxZ - 0.05 &&
        Math.max(run.sz, run.ez) > cutout.minZ + 0.05;
      if ((onWest || onEast) && overlapsZ) {
        keep.push(...splitVertical(run));
        continue;
      }
    }
    keep.push(run);
  }
  return keep;
}

/**
 * Infer a car-porch cutout when the backend didn't send one.
 *
 * Looks at each AABB corner for an empty rectangle bounded by an inner L.
 * Rejects roughly-square rooms (bedrooms) by requiring a long, bay-like
 * aspect ratio typical of a vehicle porch.
 */
export function findCornerCutout(runs: WallRun[]): CornerCutout | null {
  if (runs.length < 4) return null;
  const bounds = boundsFromRuns(runs);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxZ - bounds.minZ;
  if (width < 1 || height < 1) return null;

  const minSide = Math.max(1.4, Math.min(width, height) * 0.1);
  const corners: Array<{
    id: CutoutCorner;
    ox: number;
    oz: number;
    dirX: number;
    dirZ: number;
  }> = [
    { id: "nw", ox: bounds.minX, oz: bounds.minZ, dirX: 1, dirZ: 1 },
    { id: "ne", ox: bounds.maxX, oz: bounds.minZ, dirX: -1, dirZ: 1 },
    { id: "sw", ox: bounds.minX, oz: bounds.maxZ, dirX: 1, dirZ: -1 },
    { id: "se", ox: bounds.maxX, oz: bounds.maxZ, dirX: -1, dirZ: -1 },
  ];

  let best: CornerCutout | null = null;
  let bestArea = 0;

  const horizontals = runs.filter((r) => runAxis(r) === "x");
  const verticals = runs.filter((r) => runAxis(r) === "z");

  for (const corner of corners) {
    for (const h of horizontals) {
      const iz = h.sz;
      if ((iz - corner.oz) * corner.dirZ < minSide) continue;
      const hLo = Math.min(h.sx, h.ex);
      const hHi = Math.max(h.sx, h.ex);

      for (const v of verticals) {
        const ix = v.sx;
        if ((ix - corner.ox) * corner.dirX < minSide) continue;
        const vLo = Math.min(v.sz, v.ez);
        const vHi = Math.max(v.sz, v.ez);

        // The two walls must form an L at (ix, iz)
        const meetsX = hLo - 0.35 <= ix && ix <= hHi + 0.35;
        const meetsZ = vLo - 0.35 <= iz && iz <= vHi + 0.35;
        if (!meetsX || !meetsZ) continue;

        const insetX =
          Math.min(Math.abs(ix - bounds.minX), Math.abs(ix - bounds.maxX)) > 0.4;
        const insetZ =
          Math.min(Math.abs(iz - bounds.minZ), Math.abs(iz - bounds.maxZ)) > 0.4;
        if (!insetX || !insetZ) continue;

        const innerXLo = Math.min(corner.ox, ix);
        const innerXHi = Math.max(corner.ox, ix);
        const innerZLo = Math.min(corner.oz, iz);
        const innerZHi = Math.max(corner.oz, iz);
        const hCover = Math.min(hHi, innerXHi) - Math.max(hLo, innerXLo);
        const vCover = Math.min(vHi, innerZHi) - Math.max(vLo, innerZLo);
        if (hCover < (innerXHi - innerXLo) * 0.6) continue;
        if (vCover < (innerZHi - innerZLo) * 0.6) continue;

        const cut: CornerCutout = {
          minX: Math.min(corner.ox, ix),
          maxX: Math.max(corner.ox, ix),
          minZ: Math.min(corner.oz, iz),
          maxZ: Math.max(corner.oz, iz),
          corner: corner.id,
        };
        const cw = cut.maxX - cut.minX;
        const ch = cut.maxZ - cut.minZ;
        const aspect = Math.max(cw, ch) / Math.max(0.01, Math.min(cw, ch));
        // Bedrooms are nearly square; a car porch is a long bay (~2:1)
        if (aspect < 1.55) continue;

        const pad = 0.2;
        const occupied = runs.some((r) => {
          if (r === h || r === v) return false;
          const mx = (r.sx + r.ex) / 2;
          const mz = (r.sz + r.ez) / 2;
          return (
            mx > cut.minX + pad &&
            mx < cut.maxX - pad &&
            mz > cut.minZ + pad &&
            mz < cut.maxZ - pad
          );
        });
        if (occupied) continue;

        const area = cw * ch;
        if (area > bestArea) {
          bestArea = area;
          best = cut;
        }
      }
    }
  }
  return best;
}

export function boundsFromRuns(runs: WallRun[]): WallBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const r of runs) {
    minX = Math.min(minX, r.sx, r.ex);
    maxX = Math.max(maxX, r.sx, r.ex);
    minZ = Math.min(minZ, r.sz, r.ez);
    maxZ = Math.max(maxZ, r.sz, r.ez);
  }
  return { minX, maxX, minZ, maxZ };
}

/** Union overlapping / touching intervals into a sorted, disjoint list. */
export function mergeSpans(spans: Span[], joinTol = 0): Span[] {
  const sorted = spans
    .filter(([a, b]) => b > a)
    .map(([a, b]) => [a, b] as Span)
    .sort((a, b) => a[0] - b[0]);
  const merged: Span[] = [];
  for (const [a, b] of sorted) {
    const last = merged[merged.length - 1];
    if (last && a - last[1] <= joinTol) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return merged;
}

/** Complement of `filled` inside `[t0, t1]`, ignoring slivers below `minLen`. */
export function gapSpans(
  t0: number,
  t1: number,
  filled: Span[],
  minLen: number
): Span[] {
  const gaps: Span[] = [];
  let cursor = t0;
  for (const [a, b] of mergeSpans(filled)) {
    if (a - cursor >= minLen) gaps.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (t1 - cursor >= minLen) gaps.push([cursor, t1]);
  return gaps;
}

export function edgeSpecs(bounds: WallBounds): EdgeSpec[] {
  const { minX, maxX, minZ, maxZ } = bounds;
  return [
    { id: "north", axis: "x", fixed: minZ, a0: minX, a1: maxX },
    { id: "south", axis: "x", fixed: maxZ, a0: minX, a1: maxX },
    { id: "west", axis: "z", fixed: minX, a0: minZ, a1: maxZ },
    { id: "east", axis: "z", fixed: maxX, a0: minZ, a1: maxZ },
  ];
}

/** Intervals of an edge already occupied by detected walls. */
export function coveredSpansAlongEdge(edge: EdgeSpec, runs: WallRun[]): Span[] {
  const spans: Span[] = [];
  for (const run of runs) {
    if (runAxis(run) !== edge.axis) continue;
    const offset = edge.axis === "x" ? run.sz : run.sx;
    if (Math.abs(offset - edge.fixed) > EDGE_COVER_TOL) continue;
    const lo = edge.axis === "x" ? Math.min(run.sx, run.ex) : Math.min(run.sz, run.ez);
    const hi = edge.axis === "x" ? Math.max(run.sx, run.ex) : Math.max(run.sz, run.ez);
    spans.push([Math.max(edge.a0, lo), Math.min(edge.a1, hi)]);
  }
  return mergeSpans(spans, 0.05);
}

export function edgeCoverageRatio(edge: EdgeSpec, runs: WallRun[]): number {
  const edgeLen = edge.a1 - edge.a0;
  if (edgeLen < 0.01) return 1;
  const covered = coveredSpansAlongEdge(edge, runs).reduce(
    (sum, [a, b]) => sum + (b - a),
    0
  );
  return Math.min(1, covered / edgeLen);
}

/**
 * Largest hole (metres) bridged between two collinear wall runs.
 *
 * Sized for extraction dropouts only — not doorways. A typical door is ~0.9 m;
 * bridging anything near that width walls the opening shut before the 3D carve
 * pass can cut a hole. Car porch mouths stay open because they are several metres.
 */
export const MAX_BRIDGE_GAP_M = 0.65;

/** Quantisation used to decide that two runs sit on the same line. */
const COLLINEAR_KEY_M = 0.05;

/**
 * Bridge short holes between collinear wall runs.
 *
 * This is the only wall the layout invents, and it only ever appears in line
 * with masonry that was actually detected. That distinction matters: filling
 * along the bounding box instead would square a concave plan into a closed box
 * and wall up the car porch cutout. Openings are carved later from the merged
 * runs, so a door inside a bridged span still gets a real hole and a lintel.
 */
export function closeCollinearGaps(
  runs: WallRun[],
  { maxGap = MAX_BRIDGE_GAP_M } = {}
): WallRun[] {
  type Interval = { lo: number; hi: number; depth: number };

  const groups = new Map<string, { axis: Axis; fixed: number[]; items: Interval[] }>();
  for (const run of runs) {
    const axis = runAxis(run);
    const fixed = axis === "x" ? run.sz : run.sx;
    const key = `${axis}:${Math.round(fixed / COLLINEAR_KEY_M)}`;
    const lo = axis === "x" ? Math.min(run.sx, run.ex) : Math.min(run.sz, run.ez);
    const hi = axis === "x" ? Math.max(run.sx, run.ex) : Math.max(run.sz, run.ez);

    const group = groups.get(key);
    if (group) {
      group.fixed.push(fixed);
      group.items.push({ lo, hi, depth: run.depth });
    } else {
      groups.set(key, { axis, fixed: [fixed], items: [{ lo, hi, depth: run.depth }] });
    }
  }

  const out: WallRun[] = [];
  for (const { axis, fixed, items } of groups.values()) {
    const line = fixed.reduce((a, b) => a + b, 0) / fixed.length;
    const sorted = [...items].sort((a, b) => a.lo - b.lo);

    let cur = { ...sorted[0] };
    const flush = () => {
      out.push(
        axis === "x"
          ? { sx: cur.lo, sz: line, ex: cur.hi, ez: line, depth: cur.depth }
          : { sx: line, sz: cur.lo, ex: line, ez: cur.hi, depth: cur.depth }
      );
    };

    for (const item of sorted.slice(1)) {
      if (item.lo - cur.hi <= maxGap) {
        cur.hi = Math.max(cur.hi, item.hi);
        cur.depth = Math.max(cur.depth, item.depth);
      } else {
        flush();
        cur = { ...item };
      }
    }
    flush();
  }

  return out;
}

/** Tolerance used when deciding whether a ray clears a wall's end. */
const EXTERIOR_RAY_EPS = 0.02;

/**
 * Count parallel walls a perpendicular ray crosses before leaving the footprint.
 *
 * Only walls sharing `run`'s axis can be crossed by a ray along its normal.
 */
function countBlockers(
  runs: WallRun[],
  skip: WallRun,
  axis: Axis,
  along: number,
  from: number,
  dir: 1 | -1,
  limit: number
): number {
  const reach = (limit - from) * dir;
  let count = 0;

  for (const r of runs) {
    if (r === skip || runAxis(r) !== axis) continue;
    const line = axis === "x" ? r.sz : r.sx;
    const delta = (line - from) * dir;
    if (delta <= EXTERIOR_RAY_EPS) continue;
    if (reach > 0 && delta > reach) continue;
    const lo = axis === "x" ? Math.min(r.sx, r.ex) : Math.min(r.sz, r.ez);
    const hi = axis === "x" ? Math.max(r.sx, r.ex) : Math.max(r.sz, r.ez);
    if (along < lo + EXTERIOR_RAY_EPS || along > hi - EXTERIOR_RAY_EPS) continue;
    count++;
  }

  return count;
}

/**
 * True when open air reaches one face of the run, making it an exterior wall.
 *
 * Rays are cast outward from both faces at three points along the run; a face
 * that no parallel wall stands in front of before the footprint edge is
 * outdoors. Windows belong only on these — glazing an internal partition would
 * put a window between two rooms.
 */
export function isExteriorRun(
  run: WallRun,
  runs: WallRun[],
  bounds: WallBounds
): boolean {
  const axis = runAxis(run);
  const len = runLength(run);
  if (len < 1e-6) return false;

  const samples = [0.3, 0.5, 0.7];
  let openPositive = 0;
  let openNegative = 0;

  for (const f of samples) {
    if (axis === "x") {
      const along = Math.min(run.sx, run.ex) + len * f;
      if (countBlockers(runs, run, "x", along, run.sz, 1, bounds.maxZ) === 0) {
        openPositive++;
      }
      if (countBlockers(runs, run, "x", along, run.sz, -1, bounds.minZ) === 0) {
        openNegative++;
      }
    } else {
      const along = Math.min(run.sz, run.ez) + len * f;
      if (countBlockers(runs, run, "z", along, run.sx, 1, bounds.maxX) === 0) {
        openPositive++;
      }
      if (countBlockers(runs, run, "z", along, run.sx, -1, bounds.minX) === 0) {
        openNegative++;
      }
    }
  }

  const majority = Math.ceil(samples.length / 2);
  return openPositive >= majority || openNegative >= majority;
}

/** Indices of the runs that face open air. */
export function exteriorRunIndices(runs: WallRun[]): Set<number> {
  const bounds = boundsFromRuns(runs);
  const exterior = new Set<number>();
  runs.forEach((run, i) => {
    if (isExteriorRun(run, runs, bounds)) exterior.add(i);
  });
  return exterior;
}

/** Collinear tolerance used to fuse duplicate strokes on the same centreline. */
export const WALL_FUSE_OFFSET_M = 0.12;
export const WALL_FUSE_ANGLE_RAD = (5 * Math.PI) / 180;

/**
 * Fuse duplicate / collinear wall runs so hand-drawn double-line conventions
 * don't extrude as overlapping slabs. Mirrors the backend consolidation so the
 * scene stays clean even against an older API response.
 */
export function fuseWallRuns(runs: WallRun[], maxOffset = WALL_FUSE_OFFSET_M): WallRun[] {
  type Cluster = {
    dx: number;
    dz: number;
    ox: number;
    oz: number;
    depth: number;
    spans: Span[];
  };

  const clusters: Cluster[] = [];
  const ordered = [...runs].sort((a, b) => runLength(b) - runLength(a));

  for (const run of ordered) {
    let dx = run.ex - run.sx;
    let dz = run.ez - run.sz;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    dx /= len;
    dz /= len;
    if (dz < 0 || (Math.abs(dz) < 1e-9 && dx < 0)) {
      dx = -dx;
      dz = -dz;
    }

    let target: Cluster | undefined;
    for (const cluster of clusters) {
      const dot = Math.min(1, Math.abs(cluster.dx * dx + cluster.dz * dz));
      if (Math.acos(dot) > WALL_FUSE_ANGLE_RAD) continue;
      // Perpendicular distance from the cluster line to this run's start
      const perp = Math.abs(
        -cluster.dz * (run.sx - cluster.ox) + cluster.dx * (run.sz - cluster.oz)
      );
      if (perp > maxOffset) continue;
      target = cluster;
      break;
    }

    if (!target) {
      const t2 = dx * (run.ex - run.sx) + dz * (run.ez - run.sz);
      clusters.push({
        dx,
        dz,
        ox: run.sx,
        oz: run.sz,
        depth: run.depth,
        spans: [[Math.min(0, t2), Math.max(0, t2)]],
      });
      continue;
    }

    const t1 =
      target.dx * (run.sx - target.ox) + target.dz * (run.sz - target.oz);
    const t2 =
      target.dx * (run.ex - target.ox) + target.dz * (run.ez - target.oz);
    target.spans.push([Math.min(t1, t2), Math.max(t1, t2)]);
    target.depth = Math.max(target.depth, run.depth);
  }

  const fused: WallRun[] = [];
  for (const cluster of clusters) {
    for (const [start, end] of mergeSpans(cluster.spans, 0.5)) {
      if (end - start < MIN_WALL_RUN_M) continue;
      fused.push({
        sx: cluster.ox + cluster.dx * start,
        sz: cluster.oz + cluster.dz * start,
        ex: cluster.ox + cluster.dx * end,
        ez: cluster.oz + cluster.dz * end,
        depth: cluster.depth,
      });
    }
  }

  return fused;
}

/**
 * Square up a raw run list into a watertight orthogonal layout.
 *
 * Order matters: diagonals go first so the collinear tests downstream are exact,
 * fusion collapses duplicate strokes, grid alignment makes parallel walls truly
 * collinear, gap bridging then joins runs that alignment proved collinear, and
 * welding is last so it operates on final coordinates.
 *
 * Nothing here fills along the bounding box, so a concave footprint — an
 * L-shaped plan with a car porch cut out of one corner — comes through as drawn
 * instead of being squared into a closed rectangle.
 */
export function buildOrthogonalLayout(candidates: WallRun[], scale = 0.036): WallRun[] {
  const tol = snapTolerancesFromScale(scale);
  let runs = orthogonalizeRuns(candidates);
  runs = mergeDoubleWallRuns(runs, tol.doubleWallMin, tol.doubleWallMax);
  runs = orthogonalizeRuns(fuseWallRuns(runs, tol.fuseCollinear));
  runs = alignRunsToGrid(runs, tol.gridSnap);
  runs = closeCollinearGaps(runs);
  runs = weldRunCorners(runs, tol.cornerWeld);
  // Only un-seal when the AABB is a closed rectangle. An already-L plan
  // has open south/east mouths; trimming those would eat real exterior walls.
  const bounds = boundsFromRuns(runs);
  const sealed = edgeSpecs(bounds).every((e) => edgeCoverageRatio(e, runs) > 0.92);
  if (sealed) {
    const cutout = findCornerCutout(runs);
    if (cutout) {
      runs = weldRunCorners(trimRunsAgainstCutout(runs, cutout, bounds));
    }
  }
  return runs;
}

export type WallAnchor = {
  /** Index into the run list this opening is mounted in. */
  runIndex: number;
  /** Opening centre, projected onto the wall centreline. */
  x: number;
  z: number;
  /** Distance along the run from its start point. */
  t: number;
  /** Wall normal pointing away from the side the symbol was drawn on. */
  outwardX: number;
  outwardZ: number;
  distance: number;
};

/**
 * Mount an opening inside a wall run.
 *
 * Detected symbol boxes sit off the masonry (door arcs swing into the room, tags
 * are offset from the wall), so the centre is projected onto the closest run
 * that is long enough to host it, and slid inward far enough that both jambs
 * stay on the wall instead of overhanging a corner.
 */
export function anchorOpeningToRun(
  wx: number,
  wz: number,
  halfWidth: number,
  runs: WallRun[]
): WallAnchor | null {
  let best: WallAnchor | null = null;

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const len = runLength(run);
    if (len < halfWidth * 2 + 0.25) continue;

    const ux = (run.ex - run.sx) / len;
    const uz = (run.ez - run.sz) / len;
    const raw = (wx - run.sx) * ux + (wz - run.sz) * uz;
    const t = Math.max(halfWidth + 0.1, Math.min(len - halfWidth - 0.1, raw));
    const px = run.sx + ux * t;
    const pz = run.sz + uz * t;
    const distance = Math.hypot(wx - px, wz - pz);
    if (best && distance >= best.distance) continue;

    let nx = -uz;
    let nz = ux;
    if ((wx - px) * nx + (wz - pz) * nz < 0) {
      nx = -nx;
      nz = -nz;
    }

    best = {
      runIndex: i,
      x: px,
      z: pz,
      t,
      outwardX: nx,
      outwardZ: nz,
      distance,
    };
  }

  return best;
}

/** Solid corner filler placed where perpendicular walls meet. */
export type WallJunction = { x: number; z: number; depth: number };

function junctionKey(x: number, z: number): string {
  const q = 0.08;
  return `${Math.round(x / q)}|${Math.round(z / q)}`;
}

function pointOnRunInterior(
  px: number,
  pz: number,
  run: WallRun,
  tol: number
): boolean {
  if (runAxis(run) === "x") {
    if (Math.abs(pz - run.sz) > tol) return false;
    const lo = Math.min(run.sx, run.ex);
    const hi = Math.max(run.sx, run.ex);
    return px >= lo + tol && px <= hi - tol;
  }
  if (Math.abs(px - run.sx) > tol) return false;
  const lo = Math.min(run.sz, run.ez);
  const hi = Math.max(run.sz, run.ez);
  return pz >= lo + tol && pz <= hi - tol;
}

/**
 * Collect L/T/+ junctions where perpendicular walls meet.
 *
 * Separate box segments leave visible corner gaps even when centrelines weld;
 * a corner cube at each junction closes the masonry without inventing new walls.
 */
export function collectWallJunctions(
  runs: WallRun[],
  tol = CORNER_WELD_M
): WallJunction[] {
  const map = new Map<string, WallJunction>();
  const horizontals = runs.filter((r) => runAxis(r) === "x");
  const verticals = runs.filter((r) => runAxis(r) === "z");

  const add = (x: number, z: number, depth: number) => {
    const key = junctionKey(x, z);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { x, z, depth });
      return;
    }
    prev.depth = Math.max(prev.depth, depth);
    prev.x = (prev.x + x) / 2;
    prev.z = (prev.z + z) / 2;
  };

  for (const h of horizontals) {
    const hz = h.sz;
    const hLo = Math.min(h.sx, h.ex);
    const hHi = Math.max(h.sx, h.ex);
    for (const v of verticals) {
      const vx = v.sx;
      const vLo = Math.min(v.sz, v.ez);
      const vHi = Math.max(v.sz, v.ez);
      if (vx < hLo - tol || vx > hHi + tol || hz < vLo - tol || hz > vHi + tol) {
        continue;
      }
      add(vx, hz, Math.max(h.depth, v.depth));
    }
  }

  for (const h of horizontals) {
    for (const ep of [
      { x: h.sx, z: h.sz },
      { x: h.ex, z: h.ez },
    ]) {
      for (const v of verticals) {
        for (const vep of [
          { x: v.sx, z: v.sz },
          { x: v.ex, z: v.ez },
        ]) {
          if (Math.hypot(ep.x - vep.x, ep.z - vep.z) <= tol) {
            add((ep.x + vep.x) / 2, (ep.z + vep.z) / 2, Math.max(h.depth, v.depth));
          }
        }
        if (pointOnRunInterior(ep.x, ep.z, v, tol)) {
          add(ep.x, ep.z, Math.max(h.depth, v.depth));
        }
      }
    }
  }

  for (const v of verticals) {
    for (const ep of [
      { x: v.sx, z: v.sz },
      { x: v.ex, z: v.ez },
    ]) {
      for (const h of horizontals) {
        if (pointOnRunInterior(ep.x, ep.z, h, tol)) {
          add(ep.x, ep.z, Math.max(h.depth, v.depth));
        }
      }
    }
  }

  return [...map.values()];
}
