/**
 * End-to-end check that a real backend response reaches the 3D build.
 *
 * The scale is resolved by the backend audit but consumed by the viewport, and
 * those two travel through different fields of the response. This test pins
 * that path: a captured `/architect/clash-detection` payload must come out of
 * the mapper with a measured `plan_scale` on the 3D payload, not just on the
 * audit — the viewport builds from the former.
 */

import { describe, expect, it } from "vitest";

import { mapClashPayload } from "@/lib/clash-detection";
import { resolvePlanScale } from "@/lib/plan-scale";

/** Trimmed real response: 804 px footprint declared as a 12 m span. */
const MEASURED_PAYLOAD = {
  architectural_audit: {
    scale: {
      meters_per_pixel: 0.014925,
      pixels_per_meter: 67.0,
      source: "USER_SPAN",
      confidence: 1.0,
      detail: "Operator-stated footprint span of 12.00 m across 804 px",
      samples: 1,
      is_measured: true,
      metrics_trustworthy: true,
    },
    wall_classifications: { load_bearing_count: 2, partition_count: 0, items: [] },
    cross_ventilation: { status: "WARNING" },
    solar_gain: { status: "OK" },
  },
  walls: [
    { x1: 120, y1: 160, x2: 920, y2: 160, thickness: 14 },
    { x1: 920, y1: 160, x2: 920, y2: 760, thickness: 14 },
    { x1: 920, y1: 760, x2: 120, y2: 760, thickness: 14 },
    { x1: 120, y1: 760, x2: 120, y2: 160, thickness: 14 },
  ],
  detections: [],
  clashes: [],
  recommendations: [],
  meta: {
    image_width: 1024,
    image_height: 1024,
    house_bounds: { min_x: 120, min_y: 160, max_x: 920, max_y: 760 },
  },
};

function withAssumedScale() {
  return {
    ...MEASURED_PAYLOAD,
    architectural_audit: {
      ...MEASURED_PAYLOAD.architectural_audit,
      scale: {
        meters_per_pixel: 0.022388,
        pixels_per_meter: 44.67,
        source: "ASSUMED_DEFAULT",
        confidence: 0.0,
        detail: "No scale evidence on the drawing",
        samples: 0,
        is_measured: false,
        metrics_trustworthy: false,
      },
    },
  };
}

describe("scale reaches the 3D payload", () => {
  it("carries a measured scale onto blueprint3d, not only the audit", () => {
    const result = mapClashPayload(MEASURED_PAYLOAD);

    expect(result.architecturalAudit?.scale?.source).toBe("USER_SPAN");
    // The viewport builds from blueprint3d — the scale has to be here too.
    expect(result.blueprint3d.plan_scale).not.toBeNull();
    expect(result.blueprint3d.plan_scale!.metersPerPixel).toBeCloseTo(0.014925, 6);
    expect(result.blueprint3d.plan_scale!.isMeasured).toBe(true);
  });

  it("builds the model at the measured scale, not the assumed one", () => {
    const result = mapClashPayload(MEASURED_PAYLOAD);
    const footprintSpanPx = 800; // 920 - 120

    const used = resolvePlanScale(result.blueprint3d.plan_scale, footprintSpanPx);

    expect(used.isMeasured).toBe(true);
    // 800 px at the measured scale is the true 11.94 m, not the assumed 18 m.
    expect(footprintSpanPx * used.metersPerPixel).toBeCloseTo(11.94, 1);
  });

  it("falls back and flags itself when the backend only assumed a span", () => {
    const result = mapClashPayload(withAssumedScale());

    // An assumed backend scale is not propagated as if it were measured.
    const used = resolvePlanScale(result.blueprint3d.plan_scale, 800);
    expect(used.isMeasured).toBe(false);
    expect(used.metricsTrustworthy).toBe(false);
    expect(800 * used.metersPerPixel).toBeCloseTo(18, 1);
  });

  it("survives a response with no scale block at all", () => {
    const legacy = {
      ...MEASURED_PAYLOAD,
      architectural_audit: {
        wall_classifications: { items: [] },
        cross_ventilation: { status: "WARNING" },
        solar_gain: { status: "OK" },
      },
    };

    const result = mapClashPayload(legacy);

    expect(result.blueprint3d.plan_scale).toBeNull();
    expect(resolvePlanScale(result.blueprint3d.plan_scale, 800).source).toBe(
      "ASSUMED_DEFAULT"
    );
  });
});
