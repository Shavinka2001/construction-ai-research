import { describe, expect, it } from "vitest";

import {
  ASSUMED_PLAN_SPAN_M,
  assumedPlanScale,
  boundingRadius,
  framingCameraPosition,
  framingDistance,
  parsePlanScalePayload,
  planScaleLabel,
  resolvePlanScale,
  type PlanScale,
  type WorldBounds,
} from "@/lib/plan-scale";

function measured(metersPerPixel: number): PlanScale {
  return {
    metersPerPixel,
    pixelsPerMeter: 1 / metersPerPixel,
    source: "USER_SPAN",
    confidence: 1,
    detail: "stated span",
    samples: 1,
    isMeasured: true,
    metricsTrustworthy: true,
  };
}

describe("plan scale resolution", () => {
  it("falls back to the assumed span and flags itself", () => {
    const scale = assumedPlanScale(800);

    expect(scale.source).toBe("ASSUMED_DEFAULT");
    expect(scale.isMeasured).toBe(false);
    expect(scale.metricsTrustworthy).toBe(false);
    expect(scale.confidence).toBe(0);
    expect(scale.metersPerPixel).toBeCloseTo(ASSUMED_PLAN_SPAN_M / 800, 6);
  });

  it("prefers a measured backend scale over the local fallback", () => {
    const resolved = resolvePlanScale(measured(0.015), 800);

    expect(resolved.source).toBe("USER_SPAN");
    expect(resolved.metersPerPixel).toBeCloseTo(0.015, 6);
    expect(resolved.isMeasured).toBe(true);
  });

  it("ignores a backend scale that only assumed a span", () => {
    const assumedFromApi: PlanScale = {
      ...measured(0.0224),
      source: "ASSUMED_DEFAULT",
      isMeasured: false,
      metricsTrustworthy: false,
      confidence: 0,
    };

    const resolved = resolvePlanScale(assumedFromApi, 800);

    expect(resolved.source).toBe("ASSUMED_DEFAULT");
    // Recomputed locally from the real span, not taken on trust.
    expect(resolved.metersPerPixel).toBeCloseTo(ASSUMED_PLAN_SPAN_M / 800, 6);
  });

  it("rejects an out-of-range scale rather than building with it", () => {
    // 5 m per pixel would make a doorway wider than the street.
    expect(resolvePlanScale(measured(5), 800).source).toBe("ASSUMED_DEFAULT");
    expect(resolvePlanScale(measured(1e-9), 800).source).toBe("ASSUMED_DEFAULT");
  });

  it("handles a missing scale block", () => {
    expect(resolvePlanScale(null, 800).source).toBe("ASSUMED_DEFAULT");
    expect(resolvePlanScale(undefined, 800).source).toBe("ASSUMED_DEFAULT");
  });
});

describe("parsePlanScalePayload", () => {
  it("parses the backend snake_case block", () => {
    const parsed = parsePlanScalePayload({
      meters_per_pixel: 0.014925,
      pixels_per_meter: 67,
      source: "USER_SPAN",
      confidence: 1,
      detail: "Operator-stated footprint span of 12.00 m across 804 px",
      samples: 1,
      is_measured: true,
      metrics_trustworthy: true,
    });

    expect(parsed).not.toBeNull();
    expect(parsed!.metersPerPixel).toBeCloseTo(0.014925, 6);
    expect(parsed!.pixelsPerMeter).toBeCloseTo(67, 1);
    expect(parsed!.source).toBe("USER_SPAN");
    expect(parsed!.isMeasured).toBe(true);
  });

  it("derives is_measured from the source on an older payload", () => {
    const parsed = parsePlanScalePayload({
      meters_per_pixel: 0.02,
      source: "DIMENSION_OCR",
    });

    expect(parsed!.isMeasured).toBe(true);
    expect(parsed!.metricsTrustworthy).toBe(true);
  });

  it("treats an unknown source as assumed", () => {
    const parsed = parsePlanScalePayload({
      meters_per_pixel: 0.02,
      source: "SOMETHING_NEW",
    });

    expect(parsed!.source).toBe("ASSUMED_DEFAULT");
    expect(parsed!.isMeasured).toBe(false);
  });

  it("returns null for junk instead of a default scale", () => {
    expect(parsePlanScalePayload(null)).toBeNull();
    expect(parsePlanScalePayload({})).toBeNull();
    expect(parsePlanScalePayload({ meters_per_pixel: "abc" })).toBeNull();
    expect(parsePlanScalePayload({ meters_per_pixel: 99 })).toBeNull();
  });

  it("labels an assumed scale as indicative", () => {
    expect(planScaleLabel(assumedPlanScale(800))).toMatch(/assumed/i);
    expect(planScaleLabel(measured(0.015))).toMatch(/px\/m/);
  });
});

describe("camera framing", () => {
  const bounds: WorldBounds = { minX: -6, maxX: 6, minZ: -4.5, maxZ: 4.5 };

  it("encloses the footprint and the wall height", () => {
    // Half-diagonal of 12 x 9 x 2.8 => hypot(6, 4.5, 1.4).
    expect(boundingRadius(bounds, 2.8)).toBeCloseTo(Math.hypot(6, 4.5, 1.4), 6);
  });

  it("never collapses to zero for a degenerate footprint", () => {
    const point: WorldBounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
    expect(boundingRadius(point, 0)).toBeGreaterThan(0);
  });

  it("puts a bigger house further away", () => {
    const small = framingDistance(boundingRadius(bounds, 2.8), 42, 16 / 9);
    const large = framingDistance(
      boundingRadius({ minX: -15, maxX: 15, minZ: -10, maxZ: 10 }, 2.8),
      42,
      16 / 9
    );
    expect(large).toBeGreaterThan(small);
  });

  it("pulls back further on a narrow viewport than a wide one", () => {
    const radius = boundingRadius(bounds, 2.8);
    const wide = framingDistance(radius, 42, 16 / 9);
    const portrait = framingDistance(radius, 42, 9 / 16);

    // A portrait frustum is narrower horizontally, so it binds first.
    expect(portrait).toBeGreaterThan(wide);
  });

  it("fits the bounding sphere inside the vertical field of view", () => {
    const radius = boundingRadius(bounds, 2.8);
    const distance = framingDistance(radius, 42, 16 / 9, 1);

    // At the framing distance the sphere subtends exactly the fov.
    const halfAngle = Math.asin(radius / distance);
    expect((halfAngle * 180) / Math.PI).toBeCloseTo(21, 4);
  });

  it("survives a zero or non-finite aspect ratio", () => {
    const radius = boundingRadius(bounds, 2.8);
    expect(Number.isFinite(framingDistance(radius, 42, 0))).toBe(true);
    expect(Number.isFinite(framingDistance(radius, 42, Number.NaN))).toBe(true);
  });

  it("keeps the raised three-quarter viewing direction", () => {
    const [x, y, z] = framingCameraPosition(bounds, 2.8, 42, 16 / 9);

    // Direction (0, 11, 16): no sideways offset, and the camera sits above and
    // in front of the centre.
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeGreaterThan(0);
    expect(z).toBeGreaterThan(0);
    expect(y / z).toBeCloseTo(11 / 16, 6);
  });

  it("centres on the footprint, not the world origin", () => {
    const offset: WorldBounds = { minX: 10, maxX: 22, minZ: 4, maxZ: 13 };
    const [x, , z] = framingCameraPosition(offset, 2.8, 42, 16 / 9);

    expect(x).toBeCloseTo(16, 6); // centre of 10..22
    const centreZ = 8.5; // centre of 4..13
    expect(z).toBeGreaterThan(centreZ);
  });
});
