"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Layers, MapPinned } from "lucide-react";
import { useComplianceWorkflow } from "@/contexts/ComplianceWorkflowContext";
import SiteLocationMap, { type SitePin } from "./SiteLocationMap";

const RISK_STYLES = {
  Low: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
  Moderate: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100" },
  High: { bg: "bg-red-50", text: "text-red-700", border: "border-red-100" },
} as const;

export function StepGeospatialIdentification() {
  const { pin, zone, setPin } = useComplianceWorkflow();
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = useCallback(
    async (selected: SitePin) => {
      setConfirming(true);
      try {
        setPin(selected);
      } finally {
        await new Promise((r) => setTimeout(r, 400));
        setConfirming(false);
      }
    },
    [setPin],
  );

  const riskStyle = zone ? RISK_STYLES[zone.riskBand] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
          Step 1 · Geospatial Site Identification
        </p>
        <h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-900">
          <MapPinned className="h-5 w-5 text-slate-700" />
          Select your land location
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Drop a pin on the satellite map to capture precise coordinates. Confirm
          your selection to detect the regulatory zone and unlock the approval
          roadmap.
        </p>
      </div>

      <SiteLocationMap
        confirmedPin={pin}
        onConfirm={handleConfirm}
        confirming={confirming}
      />

      {zone && pin && riskStyle && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Detected Zone
                </p>
                <h3 className="text-lg font-bold text-slate-900">{zone.label}</h3>
                <p className="mt-1 max-w-xl text-sm text-slate-600">
                  {zone.description}
                </p>
              </div>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}`}
            >
              {zone.riskBand} risk
            </span>
          </div>

          <div className="mt-4 flex items-start gap-2 border-t border-slate-100 pt-4 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p>{zone.advisory}</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
