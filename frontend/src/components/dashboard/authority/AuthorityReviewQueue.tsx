"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ClipboardList, MapPin } from "lucide-react";
import { useComplianceWorkflow } from "@/contexts/ComplianceWorkflowContext";
import { ComplianceStatusBadge } from "@/components/dashboard/authority/ComplianceStatusBadge";

export function AuthorityReviewQueue() {
  const { pin, zone, document } = useComplianceWorkflow();
  const hasSession = pin != null || document.fileName != null;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Review Queue
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">
          Active Compliance Session
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Live workflow state from the regulatory checker
        </p>
      </div>

      <div className="flex flex-1 flex-col p-5">
        {!hasSession ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <ClipboardList className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-800">
              No active review session
            </p>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-500">
              Start by selecting a site location on the map or open the full
              4-step regulatory workflow.
            </p>
            <Link
              href="/dashboard/regulatory-checker"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-charcoal px-4 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-charcoal-light"
            >
              Open Regulatory Checker
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="rounded-xl border border-gold/20 bg-gold/[0.04] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Current submission
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {zone?.label ?? "Site under review"}
                  </p>
                  {pin && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5" />
                      {pin.lat.toFixed(5)}°, {pin.lon.toFixed(5)}°
                    </p>
                  )}
                </div>
                {document.prediction ? (
                  <ComplianceStatusBadge
                    label={document.prediction.label}
                    size="sm"
                  />
                ) : zone ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Zone mapped
                  </span>
                ) : null}
              </div>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Location
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-800">
                  {pin ? "Confirmed" : "Pending"}
                </dd>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Document
                </dt>
                <dd className="mt-0.5 truncate text-sm font-medium text-slate-800">
                  {document.fileName ?? "Not uploaded"}
                </dd>
              </div>
            </dl>

            <Link
              href="/dashboard/regulatory-checker"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Continue in full workflow
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
