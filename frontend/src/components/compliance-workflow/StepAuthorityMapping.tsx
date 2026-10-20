"use client";

import { motion } from "framer-motion";
import { Route } from "lucide-react";
import { useWorkflowAuthority } from "@/contexts/ComplianceWorkflowContext";
import { AuthorityLocator } from "@/components/compliance-workflow/AuthorityLocator";

const stepEnterVariants = {
  hidden: { opacity: 0, x: 48, y: 12 },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { type: "spring", stiffness: 280, damping: 30, delay: 0.06 },
  },
};

export function StepAuthorityMapping() {
  const { activeRoadmapStep: activeStep } = useWorkflowAuthority();

  return (
    <motion.div
      variants={stepEnterVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
          Step 4 · Authority Mapping &amp; Routing
        </p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">
          Authority Locator
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {activeStep
            ? `Routing to ${activeStep.authority} for Phase ${activeStep.phase}. Change the active step in Step 2 to switch authorities.`
            : "Select a roadmap phase in Step 2 to locate the responsible authority office."}
        </p>
      </div>

      {activeStep && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-2.5 text-xs text-blue-800"
        >
          <Route className="h-4 w-4 shrink-0 text-blue-600" />
          <span>
            Active gate:{" "}
            <strong className="font-semibold">{activeStep.title}</strong>
          </span>
        </motion.div>
      )}

      <AuthorityLocator />
    </motion.div>
  );
}
