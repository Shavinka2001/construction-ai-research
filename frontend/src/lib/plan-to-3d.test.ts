import { describe, expect, it } from "vitest";
import {
  convertPlanToGeometry,
  planToWorld,
  createPlanTransform,
  splitWallIntoPieces,
  verifyWallAreaConservation,
  wallDirectionFromRotation,
  weldWallEndpoints,
  worldWallsFromPlan,
  type FloorPlan,
} from "./plan-to-3d";

describe("plan-to-3d", () => {
  const squareRoom: FloorPlan = {
    walls: [
      { id: "n", start: { x: 100, y: 100 }, end: { x: 400, y: 100 } },
      { id: "e", start: { x: 400, y: 100 }, end: { x: 400, y: 400 } },
      { id: "s", start: { x: 400, y: 400 }, end: { x: 100, y: 400 } },
      { id: "w", start: { x: 100, y: 400 }, end: { x: 100, y: 100 } },
    ],
    openings: [],
    columns: [],
  };

  it("maps plan Y to world Z", () => {
    const t = createPlanTransform(squareRoom.walls);
    const [, z0] = planToWorld(250, 100, t);
    const [, z1] = planToWorld(250, 400, t);
    expect(z1).toBeGreaterThan(z0);
  });

  it("welds endpoints within 10px", () => {
    const welded = weldWallEndpoints(
      [
        { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
        { start: { x: 108, y: 0 }, end: { x: 108, y: 100 } },
      ],
      10
    );
    expect(welded[0].end.x).toBe(welded[1].start.x);
  });

  it("aligns rotation.y with wall bearing", () => {
    const t = createPlanTransform(squareRoom.walls);
    const north = worldWallsFromPlan(squareRoom.walls, t).find((w) => w.id === "n")!;
    const [dx, dz] = wallDirectionFromRotation(north.rotationY);
    expect(dx).toBeCloseTo(north.dirX, 5);
    expect(dz).toBeCloseTo(north.dirZ, 5);
  });

  it("conserves wall area when splitting openings", () => {
    const openings = [
      { type: "door" as const, offsetU: 0.8, width: 0.9, sill: 0, height: 2.1 },
      { type: "window" as const, offsetU: 2.8, width: 1.2, sill: 1, height: 1.1 },
    ];
    expect(verifyWallAreaConservation(4, 3, openings)).toBe(true);
    expect(splitWallIntoPieces(4, 3, openings).length).toBeGreaterThan(0);
  });

  it("produces floors and collision segments from a plan", () => {
    const plan: FloorPlan = {
      ...squareRoom,
      openings: [
        {
          id: "d1",
          type: "door",
          center: { x: 250, y: 400 },
          widthPx: 45,
          heightM: 2.1,
          sillM: 0,
        },
      ],
    };
    const result = convertPlanToGeometry(plan);
    expect(result.descriptors.some((d) => d.type === "floor")).toBe(true);
    expect(result.collision.some((c) => c.doors.length > 0)).toBe(true);
    expect(result.spawn[1]).toBe(1.62);
  });
});
