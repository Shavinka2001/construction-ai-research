"use client";

import { cn } from "@/lib/utils";

type FloatingInputProps = {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  autoComplete?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
};

export function FloatingInput({
  id,
  label,
  type = "text",
  value,
  onChange,
  icon,
  trailing,
  autoComplete,
  required,
  error,
  placeholder,
}: FloatingInputProps) {
  return (
    <div className="relative">
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500"
      >
        {label}
      </label>

      <div
        className={cn(
          "relative flex items-center rounded-xl border bg-white transition-all duration-200",
          error
            ? "border-red-300 ring-4 ring-red-500/10"
            : "border-slate-200 hover:border-slate-300 focus-within:border-[#D4AF37] focus-within:ring-4 focus-within:ring-[#D4AF37]/10"
        )}
      >
        {icon && (
          <span className="pointer-events-none pl-4 text-slate-400">{icon}</span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          placeholder={placeholder}
          className={cn(
            "auth-input w-full rounded-xl bg-white py-3.5 text-sm text-slate-800 outline-none placeholder:text-slate-400",
            icon ? "pl-3 pr-4" : "px-4",
            trailing && "pr-12"
          )}
        />
        {trailing && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {trailing}
          </span>
        )}
      </div>

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
