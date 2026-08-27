"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FolderKanban, Check, Loader2 } from "lucide-react";
import type { Project } from "@/lib/projects";
import { cn } from "@/lib/utils";

type ProjectSelectorProps = {
  projects: Project[];
  activeProject: Project | null;
  loading?: boolean;
  onSelect: (project: Project) => void;
};

export function ProjectSelector({
  projects,
  activeProject,
  loading = false,
  onSelect,
}: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div ref={rootRef} className="relative w-full min-w-0 sm:w-[280px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-md border bg-white px-4 py-2 text-left shadow-sm transition-all",
          open
            ? "border-[#D4AF37] ring-4 ring-[#D4AF37]/10"
            : "border-slate-200 hover:border-[#D4AF37]/50"
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D4AF37]/10 text-[#D4AF37]">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FolderKanban className="h-4 w-4" aria-hidden />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Active Project
            </p>
            <p className="truncate text-sm font-semibold text-slate-900">
              {activeProject?.name ?? "Select Project"}
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180 text-[#D4AF37]"
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-luxury-lg"
        >
          <div className="max-h-56 overflow-y-auto py-1">
            {projects.length === 0 ? (
              <p className="px-4 py-3 text-xs text-slate-500">
                No projects yet — click &quot;+ New Project&quot; to create one.
              </p>
            ) : (
              projects.map((project) => {
                const selected = activeProject?.id === project.id;
                return (
                  <button
                    key={project.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onSelect(project);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors",
                      selected
                        ? "bg-[#D4AF37]/10 text-slate-900"
                        : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span className="min-w-0 truncate font-medium">
                      {project.name}
                    </span>
                    {selected && (
                      <Check
                        className="h-4 w-4 shrink-0 text-[#D4AF37]"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
