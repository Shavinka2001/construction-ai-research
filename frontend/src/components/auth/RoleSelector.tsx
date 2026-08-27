"use client";

import { cn } from "@/lib/utils";
import { ROLE_OPTIONS } from "@/lib/roles";
import type { UserRole } from "@/lib/auth";

type RoleSelectorProps = {
  value: UserRole | "";
  onChange: (role: UserRole) => void;
  error?: string;
};

export function RoleSelector({ value, onChange, error }: RoleSelectorProps) {
  const selected = ROLE_OPTIONS.find((r) => r.value === value);

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Select Your Role
      </p>
      <div className="grid gap-2 sm:grid-cols-1">
        {ROLE_OPTIONS.map((role) => {
          const Icon = role.icon;
          const isSelected = value === role.value;

          return (
            <button
              key={role.value}
              type="button"
              onClick={() => onChange(role.value)}
              className={cn(
                "flex min-h-touch items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-200",
                isSelected
                  ? "border-gold bg-gold/5 shadow-[0_0_0_1px_#D4AF37]"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                  isSelected
                    ? "bg-gold text-brand-primary"
                    : "bg-slate-100 text-slate-500"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-sm font-semibold",
                    isSelected ? "text-slate-900" : "text-slate-700"
                  )}
                >
                  {role.label}
                </span>
                {isSelected && (
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                    {role.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {selected && !error && (
        <p className="mt-3 rounded-lg border border-gold/20 bg-gold/5 px-3 py-2 text-xs leading-relaxed text-slate-600">
          {selected.description}
        </p>
      )}

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
