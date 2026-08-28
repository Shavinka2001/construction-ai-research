"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  analyzeSite,
  auditPlan,
  digitizePlan,
  markBoundary,
  runFeasibility,
  type Anchor,
  type BoundaryResult,
  type FeasibilityResult,
  type LedgerReport,
  type SurveyAuditResult,
  type SurveyDigitizeResult,
} from "@/lib/land-validation";
import { lonLatToLocalMetres } from "@/lib/geo";
import type { Project } from "@/lib/projects";

export type FeasibilityTab =
  | "portfolio"
  | "search"
  | "analysis"
  | "zoning"
  | "reports";

type State = {
  activeTab: FeasibilityTab;
  activeProject: Project | null;
  address: string | null;
  anchor: Anchor | null;
  surveyFile: File | null;
  surveyPreviewUrl: string | null;
  perches: number | null;
  /** Property boundary drawn on the satellite map, as WGS84 vertices. Takes
   *  precedence over the survey-plan polygon when running the boundary step. */
  manualLotPolygon: Anchor[] | null;
  digitization: SurveyDigitizeResult | null;
  audit: SurveyAuditResult | null;
  boundary: BoundaryResult | null;
  feasibility: FeasibilityResult | null;
  analyzing: boolean;
  digitizing: boolean;
  error: string | null;
};

type ContextValue = State & {
  ledger: LedgerReport | null;
  setActiveTab: (tab: FeasibilityTab) => void;
  setActiveProject: (project: Project | null) => void;
  setPerches: (perches: number | null) => void;
  setManualLotPolygon: (polygon: Anchor[] | null) => void;
  attachSurvey: (file: File | null) => void;
  digitizeSurvey: () => Promise<void>;
  setAnchor: (anchor: Anchor, address?: string) => Promise<void>;
  refreshAnalysis: () => Promise<void>;
  clearError: () => void;
};

const FeasibilityCtx = createContext<ContextValue | null>(null);

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

export function FeasibilityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({
    activeTab: "portfolio",
    activeProject: null,
    address: null,
    anchor: null,
    surveyFile: null,
    surveyPreviewUrl: null,
    perches: null,
    manualLotPolygon: null,
    digitization: null,
    audit: null,
    boundary: null,
    feasibility: null,
    analyzing: false,
    digitizing: false,
    error: null,
  });

  const patch = useCallback((p: Partial<State>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const setActiveTab = useCallback(
    (activeTab: FeasibilityTab) => patch({ activeTab }),
    [patch]
  );
  const setActiveProject = useCallback(
    (activeProject: Project | null) => patch({ activeProject }),
    [patch]
  );
  const setPerches = useCallback(
    (perches: number | null) => patch({ perches }),
    [patch]
  );
  const setManualLotPolygon = useCallback(
    (manualLotPolygon: Anchor[] | null) =>
      patch({ manualLotPolygon: manualLotPolygon?.length ? manualLotPolygon : null }),
    [patch]
  );
  const clearError = useCallback(() => patch({ error: null }), [patch]);

  const attachSurvey = useCallback(
    (file: File | null) => {
      setState((s) => {
        if (s.surveyPreviewUrl) URL.revokeObjectURL(s.surveyPreviewUrl);
        return {
          ...s,
          surveyFile: file,
          surveyPreviewUrl: file ? URL.createObjectURL(file) : null,
          digitization: null,
          audit: null,
        };
      });
    },
    []
  );

  const digitizeSurvey = useCallback(async () => {
    const file = state.surveyFile;
    if (!file) {
      patch({ error: "Attach a survey plan image first." });
      return;
    }
    patch({ digitizing: true, error: null });
    try {
      const [digitization, audit] = await Promise.all([
        digitizePlan(file, {
          perches: state.perches ?? undefined,
        }),
        auditPlan(file).catch(() => null),
      ]);
      patch({ digitization, audit: audit ?? null, digitizing: false });
    } catch (e) {
      patch({ error: errMessage(e), digitizing: false });
    }
  }, [state.surveyFile, state.perches, patch]);

  const runAnalysisFor = useCallback(
    async (anchor: Anchor, lotPolygon: Anchor[] | null) => {
      patch({ analyzing: true, error: null });
      try {
        let boundary: BoundaryResult | null = null;
        // A boundary drawn on the map wins; otherwise fall back to the survey
        // plan polygon. Both feed the existing markBoundary API as local metres.
        let polygonM: number[][] | null = null;
        if (lotPolygon && lotPolygon.length >= 3) {
          polygonM = lotPolygon.map((p) => lonLatToLocalMetres(p, anchor));
        } else {
          polygonM =
            state.digitization?.boundary_geojson.geometry.coordinates[0]?.slice(
              0,
              -1
            ) ?? null;
        }
        if (polygonM || state.perches) {
          boundary = await markBoundary({
            anchor,
            polygon_m: polygonM,
            calibration_perches: state.perches ?? undefined,
          }).catch(() => null);
        }
        const feasibility = await analyzeSite(anchor.lat, anchor.lon, {
          lotArea: boundary?.lot_area_sqm,
          buildArea: boundary?.build_zone_area_sqm,
        });
        patch({ boundary, feasibility, analyzing: false });
      } catch (e) {
        patch({ error: errMessage(e), analyzing: false });
      }
    },
    [state.digitization, state.perches, patch]
  );

  const setAnchor = useCallback(
    async (anchor: Anchor, address?: string) => {
      patch({ anchor, address: address ?? state.address, activeTab: "analysis" });
      await runAnalysisFor(anchor, state.manualLotPolygon);
    },
    [patch, runAnalysisFor, state.address, state.manualLotPolygon]
  );

  const refreshAnalysis = useCallback(async () => {
    if (state.anchor) await runAnalysisFor(state.anchor, state.manualLotPolygon);
  }, [state.anchor, state.manualLotPolygon, runAnalysisFor]);

  const ledger = useMemo<LedgerReport | null>(() => {
    if (!state.anchor || !state.feasibility) return null;
    return {
      project_id: state.activeProject?.id ?? null,
      address: state.address,
      anchor: state.anchor,
      digitization: state.digitization,
      audit: state.audit,
      boundary: state.boundary,
      feasibility: state.feasibility,
      generated_at: new Date().toISOString(),
    };
  }, [state]);

  const value = useMemo<ContextValue>(
    () => ({
      ...state,
      ledger,
      setActiveTab,
      setActiveProject,
      setPerches,
      setManualLotPolygon,
      attachSurvey,
      digitizeSurvey,
      setAnchor,
      refreshAnalysis,
      clearError,
    }),
    [
      state,
      ledger,
      setActiveTab,
      setActiveProject,
      setPerches,
      setManualLotPolygon,
      attachSurvey,
      digitizeSurvey,
      setAnchor,
      refreshAnalysis,
      clearError,
    ]
  );

  return (
    <FeasibilityCtx.Provider value={value}>{children}</FeasibilityCtx.Provider>
  );
}

export function useFeasibility(): ContextValue {
  const ctx = useContext(FeasibilityCtx);
  if (!ctx) {
    throw new Error("useFeasibility must be used within FeasibilityProvider");
  }
  return ctx;
}

// Re-export for consumers that also need the raw runner
export { runFeasibility };
