import { describe, expect, it } from "vitest";
import {
  MAX_BRIDGE_GAP_M,
  anchorOpeningToRun,
  boundsFromRuns,
  buildOrthogonalLayout,
  closeCollinearGaps,
  collectWallJunctions,
  coveredSpansAlongEdge,
  edgeCoverageRatio,
  edgeSpecs,
  exteriorRunIndices,
  findCornerCutout,
  gapSpans,
  isExteriorRun,
  mergeDoubleWallRuns,
  mergeSpans,
  orthogonalizeRuns,
  runAxis,
  runLength,
  trimRunsAgainstCutout,
  weldRunCorners,
  type WallRun,
} from "./wall-runs";

const DEPTH = 0.25;

function run(sx: number, sz: number, ex: number, ez: number, depth = DEPTH): WallRun {
  return { sx, sz, ex, ez, depth };
}

/** Every run is exactly horizontal or vertical. */
function isOrthogonal(runs: WallRun[]): boolean {
  return runs.every(
    (r) => Math.abs(r.ex - r.sx) < 1e-9 || Math.abs(r.ez - r.sz) < 1e-9
  );
}

describe("orthogonalizeRuns", () => {
  it("squares up walls that are slightly off-axis", () => {
    const out = orthogonalizeRuns([run(0, 0.04, 5, -0.04), run(0.03, 0, -0.03, 4)]);
    expect(out).toHaveLength(2);
    expect(isOrthogonal(out)).toBe(true);
    expect(out[0].sz).toBeCloseTo(0, 9);
    expect(out[1].sx).toBeCloseTo(0, 9);
  });

  it("deletes the diagonal wing artifacts seen in the render", () => {
    const diagonals = [
      run(0, 0, 4, 4),
      run(0, 0, 3, -3),
      run(-2, 1, 2, 4),
    ];
    expect(orthogonalizeRuns(diagonals)).toHaveLength(0);
  });

  it("drops stroke noise below the minimum run length", () => {
    expect(orthogonalizeRuns([run(0, 0, 0.2, 0)])).toHaveLength(0);
  });

  it("keeps walls within tolerance of an axis and rejects those beyond it", () => {
    // ~4 deg is a sloppy hand-drawn wall; ~30 deg is a leader line
    const sloppy = orthogonalizeRuns([run(0, 0, 5, 0.35)]);
    const oblique = orthogonalizeRuns([run(0, 0, 5, 2.9)]);
    expect(sloppy).toHaveLength(1);
    expect(oblique).toHaveLength(0);
  });
});

describe("weldRunCorners", () => {
  it("closes a corner where the walls stop short of each other", () => {
    const runs = weldRunCorners([
      run(0, 0, 5, 0),
      run(5.3, 0.3, 5.3, 4), // vertical wall offset from the horizontal's end
    ]);
    const horizontal = runs.find((r) => runAxis(r) === "x")!;
    const vertical = runs.find((r) => runAxis(r) === "z")!;
    expect(horizontal.ex).toBeCloseTo(vertical.sx, 9);
    expect(vertical.sz).toBeCloseTo(horizontal.sz, 9);
  });

  it("leaves a far-away wall alone instead of stretching to it", () => {
    const runs = weldRunCorners([run(0, 0, 5, 0), run(9, 0, 9, 4)]);
    expect(runs.find((r) => runAxis(r) === "x")!.ex).toBeCloseTo(5, 9);
  });
});

describe("buildOrthogonalLayout", () => {
  // A square shell whose corners stop short, one duplicate double-line stroke,
  // and two diagonal artifacts — the situation in the reported render.
  const messy: WallRun[] = [
    run(0, 0, 7.8, 0.05),
    run(0.06, 0.02, 0.06, 5.9),
    run(0.1, 6, 8, 5.95),
    run(7.95, 0.2, 8.02, 6),
    run(0.2, 0.24, 7.6, 0.28), // duplicate of the north wall
    run(1.5, 1.5, 6, 1.52), // interior partition
    run(6.2, 2, 9.5, 5.4), // diagonal artifact
    run(0.4, 5.6, 3.2, 2.8), // diagonal artifact
  ];

  it("produces a fully orthogonal layout", () => {
    const runs = buildOrthogonalLayout(messy);
    expect(runs.length).toBeGreaterThan(0);
    expect(isOrthogonal(runs)).toBe(true);
  });

  it("removes the diagonals rather than squaring them into fake walls", () => {
    const runs = buildOrthogonalLayout(messy);
    // The diagonals were the only geometry extending past x=8.1
    expect(Math.max(...runs.map((r) => Math.max(r.sx, r.ex)))).toBeLessThan(8.2);
  });

  it("collapses the duplicate stroke instead of extruding two slabs", () => {
    const runs = buildOrthogonalLayout(messy);
    const northWalls = runs.filter((r) => runAxis(r) === "x" && r.sz < 0.5);
    expect(northWalls).toHaveLength(1);
  });
});

describe("closeCollinearGaps", () => {
  it("joins collinear walls separated by a short extraction dropout", () => {
    const merged = closeCollinearGaps([run(0, 0, 4, 0), run(4.45, 0, 10, 0)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].sx).toBeCloseTo(0, 9);
    expect(merged[0].ex).toBeCloseTo(10, 9);
  });

  it("preserves a doorway-sized gap instead of walling it shut", () => {
    const merged = closeCollinearGaps([run(0, 0, 4, 0), run(5, 0, 10, 0)]);
    expect(merged).toHaveLength(2);
  });

  it("refuses to bridge a car porch mouth", () => {
    const porchWidth = 2.6;
    expect(porchWidth).toBeGreaterThan(MAX_BRIDGE_GAP_M);
    const merged = closeCollinearGaps([
      run(0, 0, 4, 0),
      run(4 + porchWidth, 0, 10, 0),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("never invents a wall on an empty edge", () => {
    // Only a north wall exists; nothing should appear on the other three edges
    const merged = closeCollinearGaps([run(0, 0, 10, 0)]);
    expect(merged).toHaveLength(1);
    expect(runAxis(merged[0])).toBe("x");
  });

  it("keeps walls on different lines separate", () => {
    const merged = closeCollinearGaps([run(0, 0, 4, 0), run(5, 3, 10, 3)]);
    expect(merged).toHaveLength(2);
  });

  it("carries the thicker masonry through a bridge", () => {
    const merged = closeCollinearGaps([
      run(0, 0, 4, 0, 0.2),
      run(4.45, 0, 10, 0, 0.35),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].depth).toBeCloseTo(0.35, 9);
  });
});

describe("L-shaped footprint with a car porch cutout", () => {
  // Outer shell 10 x 8 with a 3 x 3 porch cut out of the bottom-right corner.
  // The porch is open on its front (south) and right (east) sides.
  const lShaped: WallRun[] = [
    run(0, 0, 10, 0), // north
    run(0, 0, 0, 8), // west
    run(0, 8, 7, 8), // south, stops at the porch
    run(10, 0, 10, 5), // east, stops at the porch
    run(7, 5, 10, 5), // porch head (interior face)
    run(7, 5, 7, 8), // porch side (interior face)
    run(0, 4, 7, 4), // interior partition
  ];

  it("does not seal the porch mouth on either open side", () => {
    const runs = buildOrthogonalLayout(lShaped);
    const bounds = boundsFromRuns(runs);

    const south = edgeSpecs(bounds).find((e) => e.id === "south")!;
    const east = edgeSpecs(bounds).find((e) => e.id === "east")!;

    // South edge: only the 0..7 wall, the 7..10 porch mouth stays open
    expect(edgeCoverageRatio(south, runs)).toBeCloseTo(0.7, 2);
    // East edge: only the 0..5 wall, the 5..8 porch mouth stays open
    expect(edgeCoverageRatio(east, runs)).toBeCloseTo(0.625, 2);
  });

  it("keeps the footprint concave rather than squaring it to a box", () => {
    const runs = buildOrthogonalLayout(lShaped);
    const bounds = boundsFromRuns(runs);
    const south = edgeSpecs(bounds).find((e) => e.id === "south")!;
    const covered = coveredSpansAlongEdge(south, runs);
    // A rectangular override would produce one span covering the whole edge
    expect(covered).toHaveLength(1);
    expect(covered[0][1]).toBeLessThan(bounds.maxX - 1);
  });

  it("treats the porch faces as exterior walls", () => {
    const runs = buildOrthogonalLayout(lShaped);
    const exterior = exteriorRunIndices(runs);
    const porchHead = runs.findIndex(
      (r) => runAxis(r) === "x" && Math.abs(r.sz - 5) < 0.1
    );
    expect(porchHead).toBeGreaterThanOrEqual(0);
    expect(exterior.has(porchHead)).toBe(true);
  });

  it("classifies the interior partition as not exterior", () => {
    const runs = buildOrthogonalLayout(lShaped);
    const bounds = boundsFromRuns(runs);
    const partition = runs.find(
      (r) => runAxis(r) === "x" && Math.abs(r.sz - 4) < 0.1
    )!;
    expect(partition).toBeDefined();
    expect(isExteriorRun(partition, runs, bounds)).toBe(false);
  });

  it("does not eat real exterior walls of an already-open L", () => {
    const runs = buildOrthogonalLayout(lShaped);
    // South mouth must still stop at x=7, not be trimmed back further
    const south = runs.filter((r) => runAxis(r) === "x" && Math.abs(r.sz - 8) < 0.15);
    const southHi = Math.max(...south.map((r) => Math.max(r.sx, r.ex)));
    expect(southHi).toBeGreaterThan(6.5);
  });

  it("classifies all four shell walls as exterior", () => {
    const runs = buildOrthogonalLayout(lShaped);
    const bounds = boundsFromRuns(runs);
    const north = runs.find(
      (r) => runAxis(r) === "x" && Math.abs(r.sz - 0) < 0.1
    )!;
    const west = runs.find(
      (r) => runAxis(r) === "z" && Math.abs(r.sx - 0) < 0.1
    )!;
    expect(isExteriorRun(north, runs, bounds)).toBe(true);
    expect(isExteriorRun(west, runs, bounds)).toBe(true);
  });
});

describe("sealed rectangle with a car porch behind it", () => {
  // Same L as above but the porch mouths have been walled shut by a
  // dimension line, plus the inner L is still present. Porch is 3 x 5.5
  // (aspect 1.83) so it is not confused with a square bedroom.
  const sealed: WallRun[] = [
    run(0, 0, 10, 0),
    run(0, 0, 0, 8),
    run(0, 8, 10, 8), // fake south seal
    run(10, 0, 10, 8), // fake east seal
    run(7, 2.5, 10, 2.5), // porch head
    run(7, 2.5, 7, 8), // porch side
    run(0, 4, 7, 4),
    run(3.5, 4, 3.5, 8), // bedroom / sitting partition so the SW room isn't empty
  ];

  it("finds the SE cutout and not a square room", () => {
    const cut = findCornerCutout(sealed);
    expect(cut).not.toBeNull();
    expect(cut!.corner).toBe("se");
    expect(cut!.minX).toBeCloseTo(7, 1);
    expect(cut!.maxX).toBeCloseTo(10, 1);
  });

  it("opens both porch mouths so the footprint is L-shaped again", () => {
    const runs = buildOrthogonalLayout(sealed);
    const bounds = boundsFromRuns(runs);
    const south = edgeSpecs(bounds).find((e) => e.id === "south")!;
    const east = edgeSpecs(bounds).find((e) => e.id === "east")!;
    expect(edgeCoverageRatio(south, runs)).toBeLessThan(0.85);
    expect(edgeCoverageRatio(east, runs)).toBeLessThan(0.85);
    const southCovered = coveredSpansAlongEdge(south, runs);
    expect(Math.max(...southCovered.map((s) => s[1]))).toBeLessThan(bounds.maxX - 1);
  });

  it("trimRunsAgainstCutout leaves the inner L standing", () => {
    const cut = findCornerCutout(sealed)!;
    const trimmed = trimRunsAgainstCutout(sealed, cut);
    const head = trimmed.find(
      (r) => runAxis(r) === "x" && Math.abs(r.sz - 2.5) < 0.1
    );
    const side = trimmed.find(
      (r) => runAxis(r) === "z" && Math.abs(r.sx - 7) < 0.1
    );
    expect(head).toBeDefined();
    expect(side).toBeDefined();
  });
});

describe("anchorOpeningToRun", () => {
  const walls = [run(0, 0, 8, 0), run(0, 0, 0, 6), run(0, 6, 8, 6)];

  it("pulls a door detected inside the room onto the nearest wall", () => {
    const anchor = anchorOpeningToRun(4, 0.9, 0.58, walls)!;
    expect(anchor).not.toBeNull();
    expect(anchor.runIndex).toBe(0);
    expect(anchor.z).toBeCloseTo(0, 9);
    expect(anchor.x).toBeCloseTo(4, 9);
    expect(anchor.distance).toBeCloseTo(0.9, 9);
  });

  it("orients the outward normal toward the side the symbol was drawn on", () => {
    const inside = anchorOpeningToRun(4, 0.9, 0.58, walls)!;
    const outside = anchorOpeningToRun(4, -0.9, 0.58, walls)!;
    expect(inside.outwardZ).toBeCloseTo(1, 9);
    expect(outside.outwardZ).toBeCloseTo(-1, 9);
    expect(inside.outwardX).toBeCloseTo(0, 9);
  });

  it("slides the opening inward so both jambs stay on the wall", () => {
    const half = 0.58;
    const anchor = anchorOpeningToRun(-1, 0, half, walls)!;
    expect(anchor.t).toBeGreaterThanOrEqual(half);
    expect(anchor.t + half).toBeLessThanOrEqual(runLength(walls[anchor.runIndex]));
  });

  it("ignores runs too short to host the opening", () => {
    const stub = [run(0, 0, 0.6, 0)];
    expect(anchorOpeningToRun(0.3, 0.1, 0.58, stub)).toBeNull();
  });

  it("reports a large distance for an unhostable opening so callers can drop it", () => {
    const anchor = anchorOpeningToRun(4, 3, 0.58, walls)!;
    expect(anchor.distance).toBeGreaterThan(2.2);
  });
});

describe("span helpers", () => {
  it("unions overlapping intervals", () => {
    expect(mergeSpans([[0, 2], [1.5, 3], [5, 6]])).toEqual([[0, 3], [5, 6]]);
  });

  it("joins intervals separated by less than the tolerance", () => {
    expect(mergeSpans([[0, 2], [2.1, 4]], 0.2)).toEqual([[0, 4]]);
  });

  it("returns the complement, skipping slivers", () => {
    expect(gapSpans(0, 10, [[2, 4], [4.01, 6]], 0.25)).toEqual([[0, 2], [6, 10]]);
  });

  it("does not mutate the caller's spans", () => {
    const spans: Array<[number, number]> = [[0, 2], [1, 5]];
    mergeSpans(spans);
    expect(spans).toEqual([[0, 2], [1, 5]]);
  });
});

describe("boundsFromRuns", () => {
  it("measures the masonry footprint", () => {
    const bounds = boundsFromRuns([run(-2, -1, 5, -1), run(5, -1, 5, 4)]);
    expect(bounds).toEqual({ minX: -2, maxX: 5, minZ: -1, maxZ: 4 });
  });
});

describe("full pipeline", () => {
  it("turns a messy extraction into an orthogonal layout without inventing a box", () => {
    const messy: WallRun[] = [
      run(0, 0, 7.7, 0.06),
      run(0.05, 0.1, 0.05, 5.8),
      run(0.2, 5.95, 7.9, 6.02),
      run(7.85, 0.3, 7.95, 5.7),
      run(3.1, 0.2, 3.05, 3.4),
      run(5.5, 1.8, 9.8, 5.2), // diagonal artifact
    ];

    const runs = buildOrthogonalLayout(messy);
    expect(isOrthogonal(runs)).toBe(true);
    expect(Math.max(...runs.map((r) => Math.max(r.sx, r.ex)))).toBeLessThan(8.2);
    const partition = runs.find(
      (r) => runAxis(r) === "z" && Math.abs(r.sx - 3.1) < 0.4
    );
    expect(partition).toBeDefined();
  });

  it("leaves no bridgeable hole between collinear runs", () => {
    const messy: WallRun[] = [
      run(0, 0, 3, 0),
      run(4, 0.03, 7.7, 0),
      run(0.05, 0.1, 0.05, 5.8),
      run(0.2, 5.95, 7.9, 6.02),
      run(7.85, 0.3, 7.95, 5.7),
    ];
    const runs = buildOrthogonalLayout(messy);

    // Group by line and assert every remaining gap exceeds the bridge tolerance
    const byLine = new Map<string, Array<[number, number]>>();
    for (const r of runs) {
      const axis = runAxis(r);
      const line = axis === "x" ? r.sz : r.sx;
      const key = `${axis}:${line.toFixed(2)}`;
      const lo = axis === "x" ? Math.min(r.sx, r.ex) : Math.min(r.sz, r.ez);
      const hi = axis === "x" ? Math.max(r.sx, r.ex) : Math.max(r.sz, r.ez);
      const list = byLine.get(key);
      if (list) list.push([lo, hi]);
      else byLine.set(key, [[lo, hi]]);
    }
    for (const spans of byLine.values()) {
      spans.sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < spans.length; i++) {
        expect(spans[i][0] - spans[i - 1][1]).toBeGreaterThan(MAX_BRIDGE_GAP_M);
      }
    }
  });
});

describe("mergeDoubleWallRuns", () => {
  it("merges parallel inner/outer face lines into one centreline", () => {
    const scale = 0.04;
    const gap = 20 * scale;
    const merged = mergeDoubleWallRuns(
      [run(0, 0, 8, 0), run(0, gap, 8, gap)],
      5 * scale,
      25 * scale
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].sz).toBeCloseTo(gap / 2, 9);
    expect(merged[0].sx).toBeCloseTo(0, 9);
    expect(merged[0].ex).toBeCloseTo(8, 9);
  });

  it("leaves room partitions several metres apart untouched", () => {
    const merged = mergeDoubleWallRuns([run(0, 0, 8, 0), run(0, 3.5, 8, 3.5)], 0.1, 0.9);
    expect(merged).toHaveLength(2);
  });
});

describe("collectWallJunctions", () => {
  it("finds an L-corner where two walls meet", () => {
    const runs = [run(0, 0, 5, 0), run(5, 0, 5, 4)];
    const junctions = collectWallJunctions(runs);
    expect(junctions.length).toBeGreaterThanOrEqual(1);
    const corner = junctions.find(
      (j) => Math.hypot(j.x - 5, j.z - 0) < 0.2
    );
    expect(corner).toBeDefined();
  });

  it("finds a T-junction where an endpoint lands on another wall", () => {
    const runs = [run(0, 2, 8, 2), run(4, 0, 4, 2)];
    const junctions = collectWallJunctions(runs);
    expect(junctions.some((j) => Math.hypot(j.x - 4, j.z - 2) < 0.2)).toBe(true);
  });
});
