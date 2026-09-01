"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { BuildingApplication } from "@/lib/authority-data";
import { ComplianceStatusBadge } from "@/components/dashboard/authority/ComplianceStatusBadge";

export type { BuildingApplication };

type PendingApplicationsTableProps = {
  applications: BuildingApplication[];
  selectedId?: string;
  onSelect?: (application: BuildingApplication) => void;
  onApprove?: (id: string) => void;
  onRequestRevision?: (id: string) => void;
  showActions?: boolean;
  compact?: boolean;
};

const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: index * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  }),
};

export function PendingApplicationsTable({
  applications,
  selectedId,
  onSelect,
  onApprove,
  onRequestRevision,
  showActions = true,
  compact = false,
}: PendingApplicationsTableProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Building Applications
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">
          Pending Applications
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {applications.length} submission{applications.length !== 1 ? "s" : ""}{" "}
          awaiting review
        </p>
      </div>

      <div className="flex-1 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Project
              </th>
              {!compact && (
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Applicant
                </th>
              )}
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Submitted
              </th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Status
              </th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Score
              </th>
              {showActions && (
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {applications.map((application, index) => {
              const isSelected = application.id === selectedId;
              const interactive = Boolean(onSelect);

              return (
                <motion.tr
                  key={application.id}
                  custom={index}
                  initial="hidden"
                  animate="visible"
                  variants={rowVariants}
                  onClick={() => onSelect?.(application)}
                  className={cn(
                    "border-b border-slate-50 transition-colors",
                    interactive && "cursor-pointer",
                    isSelected ? "bg-gold/[0.07]" : "hover:bg-slate-50/80"
                  )}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold"
                          aria-hidden
                        />
                      )}
                      <div>
                        <span className="font-medium text-slate-900">
                          {application.projectName}
                        </span>
                        {!compact && (
                          <p className="mt-0.5 text-xs text-slate-400">
                            {application.location}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  {!compact && (
                    <td className="px-4 py-3.5 text-slate-600">
                      {application.applicant}
                    </td>
                  )}
                  <td className="px-4 py-3.5 tabular-nums text-slate-600">
                    {application.submittedDate}
                  </td>
                  <td className="px-4 py-3.5">
                    <ComplianceStatusBadge label={application.status} />
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-bold tabular-nums text-charcoal">
                      {application.complianceScore}%
                    </span>
                  </td>
                  {showActions && (
                    <td className="px-5 py-3.5">
                      <div
                        className="flex flex-wrap items-center justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => onApprove?.(application.id)}
                          className="rounded-lg bg-charcoal px-3 py-1.5 text-[11px] font-semibold text-gold transition-colors hover:bg-charcoal-light"
                        >
                          Approve
                        </motion.button>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => onRequestRevision?.(application.id)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-100"
                        >
                          Request Revision
                        </motion.button>
                      </div>
                    </td>
                  )}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
