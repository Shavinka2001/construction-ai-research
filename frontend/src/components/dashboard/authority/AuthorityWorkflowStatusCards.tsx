"use client";

import { motion } from "framer-motion";
import { MapPin, ShieldCheck, Brain } from "lucide-react";
import { useComplianceWorkflow } from "@/contexts/ComplianceWorkflowContext";
import { cn } from "@/lib/utils";

function StatusCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  index,
  active,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "gold" | "emerald" | "slate";
  index: number;
  active: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      whileHover={{ y: -2 }}
      className={cn(
        "rounded-2xl border bg-white p-5 shadow-luxury sm:p-6",
        accent === "gold" && active && "border-gold/40 shadow-[0_0_24px_-8px_rgba(212,175,55,0.35)]",
        accent === "emerald" && active && "border-emerald-200/80",
        accent === "slate" && "border-slate-100",
        !active && "border-slate-100 opacity-90"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p
            className={cn(
              "mt-2 text-lg font-bold leading-tight",
              active ? "text-brand-primary" : "text-slate-400"
            )}
          >
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-400">{hint}</p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            accent === "gold" && active && "bg-gold/10 text-gold",
            accent === "emerald" && active && "bg-emerald-50 text-emerald-600",
            accent === "slate" && "bg-slate-100 text-slate-400"
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </motion.div>
  );
}

export function AuthorityWorkflowStatusCards() {
  const { pin, zone, document } = useComplianceWorkflow();

  const locationValue = pin
    ? `${pin.lat.toFixed(4)}°, ${pin.lon.toFixed(4)}°`
    : "Not set";
  const zoneValue = zone?.label ?? "Awaiting pin";
  const mlValue =
    document.inferenceState === "complete" && document.prediction
      ? document.prediction.label
      : document.inferenceState === "inferring"
        ? "Analyzing…"
        : "Awaiting upload";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatusCard
        index={0}
        label="Site Location"
        value={locationValue}
        hint={pin ? "Coordinates confirmed on map" : "Drop a pin in Step 1"}
        icon={MapPin}
        accent="gold"
        active={pin != null}
      />
      <StatusCard
        index={1}
        label="Regulatory Zone"
        value={zoneValue}
        hint={
          zone
            ? `${zone.riskBand} risk · ${zone.zoneType}`
            : "Confirm location to classify"
        }
        icon={ShieldCheck}
        accent="emerald"
        active={zone != null}
      />
      <StatusCard
        index={2}
        label="ML Assessment"
        value={mlValue}
        hint={
          document.inferenceState === "complete" && document.confidenceScore != null
            ? `${document.confidenceScore}% model confidence`
            : "Upload a document in Step 3"
        }
        icon={Brain}
        accent="slate"
        active={document.inferenceState === "complete"}
      />
    </div>
  );
}
