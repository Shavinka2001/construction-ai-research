"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CreateProjectFormData } from "@/components/dashboard/architect/CreateProjectModal";
import type { GcrRecommendation, ArchitecturalAudit, Blueprint3DPayload } from "@/lib/clash-detection";
import {
  runClashDetection,
  buildGcrRecommendations,
  DEFAULT_DETECTIONS,
  DEFAULT_CLASHES,
  DEFAULT_ARCHITECTURAL_AUDIT,
  type DetectionBox,
  type ClashItem,
} from "@/lib/clash-detection";
import {
  createProject,
  fetchProjects,
  type Project,
} from "@/lib/projects";

const ACTIVE_PROJECT_KEY = "construction_ai_active_project_id";

type ToastState = {
  open: boolean;
  message: string;
  tone: "success" | "error";
};

type ArchitectWorkspaceContextValue = {
  token: string;
  projectsList: Project[];
  activeProject: Project | null;
  projectsLoading: boolean;
  setActiveProject: (project: Project | null) => void;
  isCreateModalOpen: boolean;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  creatingProject: boolean;
  createError: string | null;
  handleCreateProject: (data: CreateProjectFormData) => Promise<void>;

  archFile: File | null;
  structFile: File | null;
  setArchFile: (file: File | null) => void;
  setStructFile: (file: File | null) => void;
  archPreviewUrl: string | null;
  analyzing: boolean;
  analysisError: string | null;
  hasLiveResult: boolean;
  detections: DetectionBox[];
  clashes: ClashItem[];
  recommendations: GcrRecommendation[];
  architecturalAudit: ArchitecturalAudit;
  /** Live analysis payload for the 3D viewport (null before upload). */
  blueprint3d: Blueprint3DPayload | null;
  model: string;
  elementsDetected: number;
  wallLengthFt: number;
  imageWidth: number;
  imageHeight: number;
  runAnalysis: () => Promise<void>;

  applyingId: string | null;
  highlightedDetectionId: string | null;
  resolutionSuccess: boolean;
  applyResolution: (recommendation: GcrRecommendation) => void;

  toast: ToastState;
  showToast: (message: string, tone?: "success" | "error") => void;
  dismissToast: () => void;
};

const ArchitectWorkspaceContext =
  createContext<ArchitectWorkspaceContextValue | null>(null);

function idsMatch(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function ArchitectWorkspaceProvider({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [activeProject, setActiveProjectState] = useState<Project | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [archFile, setArchFile] = useState<File | null>(null);
  const [structFile, setStructFile] = useState<File | null>(null);
  const [archPreviewUrl, setArchPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [hasLiveResult, setHasLiveResult] = useState(false);
  const [detections, setDetections] =
    useState<DetectionBox[]>(DEFAULT_DETECTIONS);
  const [clashes, setClashes] = useState<ClashItem[]>(DEFAULT_CLASHES);
  const [recommendations, setRecommendations] = useState<GcrRecommendation[]>(
    () => buildGcrRecommendations(DEFAULT_CLASHES)
  );
  const [architecturalAudit, setArchitecturalAudit] =
    useState<ArchitecturalAudit>(DEFAULT_ARCHITECTURAL_AUDIT);
  const [blueprint3d, setBlueprint3d] = useState<Blueprint3DPayload | null>(null);
  const [model, setModel] = useState("yolov8_architect+opencv_columns");
  const [elementsDetected, setElementsDetected] = useState(
    DEFAULT_DETECTIONS.length
  );
  const [wallLengthFt] = useState(4850);
  const [imageWidth, setImageWidth] = useState(1024);
  const [imageHeight, setImageHeight] = useState(1024);

  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [highlightedDetectionId, setHighlightedDetectionId] = useState<
    string | null
  >(null);
  const [resolutionSuccess, setResolutionSuccess] = useState(false);

  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    tone: "success",
  });

  const showToast = useCallback(
    (message: string, tone: "success" | "error" = "success") => {
      setToast({ open: true, message, tone });
    },
    []
  );

  const dismissToast = useCallback(() => {
    setToast((t) => ({ ...t, open: false }));
  }, []);

  // Object URL for architectural blueprint preview on the canvas
  useEffect(() => {
    if (!archFile) {
      setArchPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(archFile);
    setArchPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [archFile]);

  const setActiveProject = useCallback((project: Project | null) => {
    setActiveProjectState(project);
    if (typeof window === "undefined") return;
    if (project) {
      localStorage.setItem(ACTIVE_PROJECT_KEY, String(project.id));
    } else {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
  }, []);

  const openCreateModal = useCallback(() => {
    setCreateError(null);
    setIsCreateModalOpen(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    if (creatingProject) return;
    setIsCreateModalOpen(false);
    setCreateError(null);
  }, [creatingProject]);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      if (!token) {
        setProjectsLoading(false);
        return;
      }

      setProjectsLoading(true);
      try {
        const list = await fetchProjects(token);
        if (cancelled) return;
        setProjectsList(list);

        const savedId =
          typeof window !== "undefined"
            ? localStorage.getItem(ACTIVE_PROJECT_KEY)
            : null;
        const saved = savedId
          ? list.find((p) => String(p.id) === savedId)
          : undefined;

        if (saved) {
          setActiveProjectState(saved);
        } else if (list.length > 0) {
          setActiveProjectState(list[0]);
          localStorage.setItem(ACTIVE_PROJECT_KEY, String(list[0].id));
        }
      } catch (err) {
        if (!cancelled) {
          setProjectsList([]);
          showToast(
            err instanceof Error
              ? err.message
              : "Could not load your project portfolio",
            "error"
          );
        }
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    }

    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, [token, showToast]);

  const handleCreateProject = useCallback(
    async (data: CreateProjectFormData) => {
      setCreatingProject(true);
      setCreateError(null);
      try {
        const project = await createProject(token, {
          name: data.name.trim(),
          description: data.description.trim() || null,
          location_gps: data.location_gps.trim() || null,
        });

        setProjectsList((prev) => [
          project,
          ...prev.filter((p) => p.id !== project.id),
        ]);
        setActiveProject(project);
        setIsCreateModalOpen(false);
        showToast(
          `“${project.name}” saved — blueprint workspaces are now unlocked.`
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create project";
        setCreateError(message);
        throw err;
      } finally {
        setCreatingProject(false);
      }
    },
    [token, setActiveProject, showToast]
  );

  const runAnalysis = useCallback(async () => {
    if (!activeProject || !archFile || analyzing) return;

    setAnalyzing(true);
    setAnalysisError(null);
    setResolutionSuccess(false);
    setHighlightedDetectionId(null);

    try {
      const result = await runClashDetection(archFile, structFile, token);
      setDetections(result.detections);
      setClashes(result.clashes);
      setRecommendations(result.recommendations);
      setArchitecturalAudit(
        result.architecturalAudit ?? DEFAULT_ARCHITECTURAL_AUDIT
      );
      setBlueprint3d(result.blueprint3d);
      setModel(
        result.model ??
          (result.isAiGenerated
            ? "yolov8_architect+ai_gsl"
            : "yolov8_architect+opencv_columns")
      );
      setElementsDetected(
        result.elementsDetected ?? result.detections.length
      );
      setImageWidth(result.imageWidth ?? result.blueprint3d.image_width ?? 1024);
      setImageHeight(result.imageHeight ?? result.blueprint3d.image_height ?? 1024);
      setHasLiveResult(true);
      const aiCols = result.detections.filter((d) => d.isAiGenerated).length;
      showToast(
        result.isAiGenerated
          ? `AI-GSL complete — ${aiCols} clash-free column(s) planned from architectural geometry.`
          : `Analysis complete — ${result.clashes.length} clash(es) found. Open Clash Detection for GCR.`
      );
    } catch (err) {
      setAnalysisError(
        err instanceof Error
          ? err.message
          : "Clash detection failed. Please try again."
      );
    } finally {
      setAnalyzing(false);
    }
  }, [activeProject, archFile, structFile, analyzing, token, showToast]);

  const applyResolution = useCallback(
    (recommendation: GcrRecommendation) => {
      if (recommendation.applied || applyingId) return;

      setApplyingId(recommendation.id);
      setHighlightedDetectionId(recommendation.targetDetectionId);

      requestAnimationFrame(() => {
        setDetections((prev) =>
          prev.map((box) =>
            idsMatch(box.id, recommendation.targetDetectionId)
              ? {
                  ...box,
                  translateX: (box.translateX ?? 0) + recommendation.deltaX,
                  translateY: (box.translateY ?? 0) + recommendation.deltaY,
                  resolved: true,
                }
              : box
          )
        );
      });

      window.setTimeout(() => {
        setRecommendations((prev) =>
          prev.map((r) =>
            r.id === recommendation.id ? { ...r, applied: true } : r
          )
        );
        if (recommendation.clashId) {
          setClashes((prev) =>
            prev.filter(
              (c) =>
                !idsMatch(c.id, recommendation.clashId!) &&
                c.clashId !== recommendation.clashId
            )
          );
        }
        setResolutionSuccess(true);
        setApplyingId(null);
        showToast("Clash resolved successfully via AI suggestion.");
      }, 750);
    },
    [applyingId, showToast]
  );

  const value = useMemo<ArchitectWorkspaceContextValue>(
    () => ({
      token,
      projectsList,
      activeProject,
      projectsLoading,
      setActiveProject,
      isCreateModalOpen,
      openCreateModal,
      closeCreateModal,
      creatingProject,
      createError,
      handleCreateProject,
      archFile,
      structFile,
      setArchFile,
      setStructFile,
      archPreviewUrl,
      analyzing,
      analysisError,
      hasLiveResult,
      detections,
      clashes,
      recommendations,
      architecturalAudit,
      blueprint3d,
      model,
      elementsDetected,
      wallLengthFt,
      imageWidth,
      imageHeight,
      runAnalysis,
      applyingId,
      highlightedDetectionId,
      resolutionSuccess,
      applyResolution,
      toast,
      showToast,
      dismissToast,
    }),
    [
      token,
      projectsList,
      activeProject,
      projectsLoading,
      setActiveProject,
      isCreateModalOpen,
      openCreateModal,
      closeCreateModal,
      creatingProject,
      createError,
      handleCreateProject,
      archFile,
      structFile,
      archPreviewUrl,
      analyzing,
      analysisError,
      hasLiveResult,
      detections,
      clashes,
      recommendations,
      architecturalAudit,
      blueprint3d,
      model,
      elementsDetected,
      wallLengthFt,
      imageWidth,
      imageHeight,
      runAnalysis,
      applyingId,
      highlightedDetectionId,
      resolutionSuccess,
      applyResolution,
      toast,
      showToast,
      dismissToast,
    ]
  );

  return (
    <ArchitectWorkspaceContext.Provider value={value}>
      {children}
    </ArchitectWorkspaceContext.Provider>
  );
}

export function useArchitectWorkspace() {
  const ctx = useContext(ArchitectWorkspaceContext);
  if (!ctx) {
    throw new Error(
      "useArchitectWorkspace must be used within ArchitectWorkspaceProvider"
    );
  }
  return ctx;
}
