"use client";

import { Plus } from "lucide-react";
import { ProjectSelector } from "@/components/dashboard/architect/ProjectSelector";
import { CreateProjectModal } from "@/components/dashboard/architect/CreateProjectModal";
import { DashboardToast } from "@/components/dashboard/DashboardToast";
import { useArchitectWorkspace } from "@/contexts/ArchitectWorkspaceContext";

type ProjectPortfolioBarProps = {
  /** Compact bar for sub-routes (no welcome copy). */
  compact?: boolean;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
};

export function ProjectPortfolioBar({
  compact = false,
  title,
  subtitle,
  eyebrow,
}: ProjectPortfolioBarProps) {
  const {
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
    toast,
    dismissToast,
  } = useArchitectWorkspace();

  return (
    <>
      <div
        className={
          compact
            ? "flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-luxury sm:flex-row sm:items-center sm:justify-between sm:p-5"
            : undefined
        }
      >
        {compact && (title || subtitle) && (
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                {eyebrow}
              </p>
            )}
            {title && (
              <h1 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                {subtitle}
              </p>
            )}
          </div>
        )}

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <ProjectSelector
            projects={projectsList}
            activeProject={activeProject}
            loading={projectsLoading}
            onSelect={setActiveProject}
          />
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 rounded-md border border-[#D4AF37]/30 bg-[#1E1E24] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-slate-800"
          >
            <Plus className="h-4 w-4 text-[#D4AF37]" aria-hidden />
            New Project
          </button>
        </div>
      </div>

      <CreateProjectModal
        open={isCreateModalOpen}
        onClose={closeCreateModal}
        onSubmit={handleCreateProject}
        loading={creatingProject}
        error={createError}
      />

      <DashboardToast
        open={toast.open}
        message={toast.message}
        tone={toast.tone}
        onClose={dismissToast}
      />
    </>
  );
}
