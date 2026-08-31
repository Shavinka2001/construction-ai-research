import { describe, expect, it } from "vitest";
import {
  buildGenerativeRenderRequest,
  buildPollinationsImageUrl,
  deriveBlueprintSeed,
  extractBlueprintFeatures,
  FALLBACK_RENDER_URL,
  STYLE_VARIATIONS,
  synthesizeGenerationPrompt,
  CONCEPT_STYLES,
} from "@/lib/concept-studio";

describe("extractBlueprintFeatures", () => {
  it("detects car porch from labels and cutout", () => {
    const features = extractBlueprintFeatures({
      detections: [{ id: "1", label: "Car Porch", confidence: 0.9, top: "0", left: "0", width: "10", height: "10", kind: "other" }],
      blueprint3d: {
        image_width: 1000,
        image_height: 800,
        walls: [{ x1: 0, y1: 0, x2: 100, y2: 0 }],
        architectural_detections: [],
        structural_detections: [],
        house_bounds: {
          min_x: 100,
          min_y: 100,
          max_x: 600,
          max_y: 500,
          center_x: 350,
          center_y: 300,
          width: 500,
          height: 400,
          cutout: { min_x: 500, min_y: 350, max_x: 600, max_y: 500 },
        },
      },
      projectName: "L-Shape Villa",
    });

    expect(features.hasCarPorch).toBe(true);
    expect(features.projectCode).toBe("L-Shape Villa");
    expect(features.sqft).toBeGreaterThan(600);
  });

  it("porch vs garden prompts differ for live AI generation", () => {
    const porch = extractBlueprintFeatures({
      detections: [{ id: "1", label: "Garage", confidence: 1, top: "0", left: "0", width: "1", height: "1", kind: "other" }],
    });
    const garden = extractBlueprintFeatures({ detections: [] });
    const style = CONCEPT_STYLES[0];

    expect(synthesizeGenerationPrompt(style, porch)).toContain("car porch on right side");
    expect(synthesizeGenerationPrompt(style, garden)).toContain("front garden");
  });

  it("synthesizes pollinations prompt with blueprint parameters", () => {
    const features = extractBlueprintFeatures({
      detections: [
        { id: "b1", label: "Bedroom 1", confidence: 1, top: "0", left: "0", width: "1", height: "1", kind: "other" },
        { id: "b2", label: "Bedroom 2", confidence: 1, top: "0", left: "0", width: "1", height: "1", kind: "other" },
      ],
      projectName: "PRJ-TEST",
    });

    const prompt = synthesizeGenerationPrompt(CONCEPT_STYLES[2], features);

    expect(prompt).toContain("Japandi Zen Minimalist");
    expect(prompt).toContain("PRJ-TEST");
    expect(prompt).toContain("front garden");
    expect(prompt).toContain("photorealistic 4k");
  });

  it("derives stable seeds per blueprint fingerprint", () => {
    const features = extractBlueprintFeatures({ projectName: "Alpha" });
    const a = deriveBlueprintSeed(features, "ultra-modern");
    const b = deriveBlueprintSeed(features, "ultra-modern");
    const c = deriveBlueprintSeed(features, "japandi");

    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("builds pollinations flux image URL", () => {
    const url = buildPollinationsImageUrl("luxury modern home", 42_424_242);
    expect(url).toContain("https://image.pollinations.ai/prompt/");
    expect(url).toContain("seed=42424242");
    expect(url).toContain("model=flux");
    expect(url).toContain("nologo=true");
    expect(url).toContain("width=1600");
  });

  it("buildGenerativeRenderRequest bundles prompt and URL", () => {
    const features = extractBlueprintFeatures({ projectName: "Villa" });
    const { prompt, url } = buildGenerativeRenderRequest(CONCEPT_STYLES[0], features, 99);
    expect(prompt).toContain("Villa");
    expect(url).toContain("image.pollinations.ai/prompt/");
    expect(url).toContain("seed=99");
  });

  it("keeps offline fallback URLs for error recovery", () => {
    expect(FALLBACK_RENDER_URL).toBe(STYLE_VARIATIONS.modern[0]);
    expect(FALLBACK_RENDER_URL).toMatch(/^https:\/\/images\.unsplash\.com\//);
  });
});
