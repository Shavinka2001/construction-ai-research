"use client";

import { cn } from "@/lib/utils";
import {
  complianceLabelTone,
  type ComplianceLabelTone,
} from "@/lib/compliance-types";

const TONE_STYLES: Record<
  ComplianceLabelTone,
  { badge: string; dot: string }
> = {
  success: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  warning: {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  },
  danger: {
    badge: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
  neutral: {
    badge: "border-slate-200 bg-slate-50 text-slate-600",
    dot: "bg-slate-400",
  },
};

type ComplianceStatusBadgeProps = {
  label: string;
  className?: string;
  size?: "sm" | "md";
};

export function ComplianceStatusBadge({
  label,
  className,
  size = "sm",
}: ComplianceStatusBadgeProps) {
  const tone = complianceLabelTone(label);
  const styles = TONE_STYLES[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-bold",
        size === "sm" && "px-2.5 py-1 text-[11px]",
        size === "md" && "px-3 py-1.5 text-xs",
        styles.badge,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
      {label}
    </span>
  );
}
