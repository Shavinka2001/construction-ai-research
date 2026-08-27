"use client";

import { useEffect, useState } from "react";
import { X, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export type CreateProjectFormData = {
  name: string;
  description: string;
  location_gps: string;
};

type CreateProjectModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProjectFormData) => Promise<void>;
  loading?: boolean;
  error?: string | null;
};

const initialForm: CreateProjectFormData = {
  name: "",
  description: "",
  location_gps: "",
};

export function CreateProjectModal({
  open,
  onClose,
  onSubmit,
  loading = false,
  error,
}: CreateProjectModalProps) {
  const [form, setForm] = useState<CreateProjectFormData>(initialForm);

  useEffect(() => {
    if (!open) setForm(initialForm);
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !loading) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose, loading]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#1E1E24]/60 backdrop-blur-sm"
        onClick={() => !loading && onClose()}
        aria-label="Close modal"
      />

      <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-luxury-lg">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Portfolio
            </p>
            <h2
              id="create-project-title"
              className="mt-1 text-lg font-bold text-slate-900"
            >
              Create New Project
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-gold hover:text-gold disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <div>
            <label
              htmlFor="project-name"
              className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
            >
              Project Name
            </label>
            <input
              id="project-name"
              required
              maxLength={255}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Colombo Heights"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-gold focus:ring-4 focus:ring-gold/10"
            />
          </div>

          <div>
            <label
              htmlFor="project-description"
              className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
            >
              Description
            </label>
            <textarea
              id="project-description"
              rows={3}
              maxLength={5000}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Luxury residential apartments"
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-gold focus:ring-4 focus:ring-gold/10"
            />
          </div>

          <div>
            <label
              htmlFor="project-gps"
              className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500"
            >
              <MapPin className="h-3 w-3 text-gold" aria-hidden />
              Location GPS
            </label>
            <input
              id="project-gps"
              value={form.location_gps}
              onChange={(e) =>
                setForm((f) => ({ ...f, location_gps: e.target.value }))
              }
              placeholder="6.9271, 79.8612"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-gold focus:ring-4 focus:ring-gold/10"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !form.name.trim()}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1E1E24] px-4 py-2.5 text-sm font-bold text-white transition-colors",
                "border border-[#D4AF37]/30 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:border-transparent"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save Project"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
