"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { FloatingInput } from "@/components/auth/FloatingInput";
import { PROFESSIONAL_ROLE_OPTIONS } from "@/lib/roles";
import type { ProfessionalRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

export type CreateProfessionalFormData = {
  full_name: string;
  email: string;
  contact_number: string;
  password: string;
  role: ProfessionalRole | "";
};

type CreateProfessionalModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProfessionalFormData) => Promise<void>;
  loading?: boolean;
  error?: string | null;
};

const initialForm: CreateProfessionalFormData = {
  full_name: "",
  email: "",
  contact_number: "",
  password: "",
  role: "",
};

export function CreateProfessionalModal({
  open,
  onClose,
  onSubmit,
  loading = false,
  error,
}: CreateProfessionalModalProps) {
  const [form, setForm] = useState<CreateProfessionalFormData>(initialForm);

  useEffect(() => {
    if (!open) setForm(initialForm);
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-professional-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#1E1E24]/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-luxury-lg">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Admin Action
            </p>
            <h2
              id="create-professional-title"
              className="mt-1 text-lg font-bold text-slate-900"
            >
              Create Professional Account
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-gold hover:text-gold"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <FloatingInput
            id="prof-full-name"
            label="Full name"
            value={form.full_name}
            onChange={(v) => setForm((f) => ({ ...f, full_name: v }))}
            placeholder="Professional full name"
            required
          />

          <FloatingInput
            id="prof-email"
            label="Email address"
            type="email"
            value={form.email}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            placeholder="professional@example.com"
            required
          />

          <FloatingInput
            id="prof-contact"
            label="Contact number"
            type="tel"
            value={form.contact_number}
            onChange={(v) => setForm((f) => ({ ...f, contact_number: v }))}
            placeholder="+94 77 123 4567"
          />

          <FloatingInput
            id="prof-password"
            label="Temporary password"
            type="password"
            value={form.password}
            onChange={(v) => setForm((f) => ({ ...f, password: v }))}
            placeholder="Minimum 8 characters"
            required
          />

          <div>
            <label
              htmlFor="prof-role"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Assigned role
            </label>
            <select
              id="prof-role"
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  role: e.target.value as ProfessionalRole | "",
                }))
              }
              required
              className={cn(
                "w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none transition-all duration-200",
                "hover:border-slate-300 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/10"
              )}
            >
              <option value="" disabled>
                Select a professional role
              </option>
              {PROFESSIONAL_ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-[44px] rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 border-transparent bg-brand-primary px-5 text-sm font-semibold text-white transition-all duration-300 hover:border-gold hover:shadow-[0_0_0_1px_#D4AF37,0_4px_20px_-4px_rgba(212,175,55,0.35)] disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
