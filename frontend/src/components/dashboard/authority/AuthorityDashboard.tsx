"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { AuthUser } from "@/lib/auth";
import { getDisplayName } from "@/lib/auth";
import { ROLE_DASHBOARD_LABELS } from "@/lib/roles";
import { AuthorityWorkflowStatusCards } from "@/components/dashboard/authority/AuthorityWorkflowStatusCards";
import { AuthorityReviewQueue } from "@/components/dashboard/authority/AuthorityReviewQueue";
import { AiAssessmentPanel } from "@/components/dashboard/authority/AiAssessmentPanel";
import { StepGeospatialIdentification } from "@/components/compliance-workflow/StepGeospatialIdentification";
import { StepDocumentVerification } from "@/components/compliance-workflow/StepDocumentVerification";

type AuthorityDashboardProps = {
  user: AuthUser;
};

export function AuthorityDashboard({ user }: AuthorityDashboardProps) {
  const displayName = getDisplayName(user);

  return (
    <div className="space-y-6 sm:space-y-8">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-luxury sm:p-8"
      >
        <div
          className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold/5 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                {ROLE_DASHBOARD_LABELS.AUTHORITY}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Regulatory Approval Hub
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500 sm:text-base">
              Welcome, {displayName}. Identify sites on the map, run ML document
              verification, and track compliance sessions in real time.
            </p>
          </div>
          <Link
            href="/dashboard/regulatory-checker"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-charcoal px-4 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-charcoal-light"
          >
            Full 4-step workflow
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.header>

      <AuthorityWorkflowStatusCards />

      <div className="grid gap-6 lg:grid-cols-5 lg:gap-8">
        <div className="space-y-6 lg:col-span-3">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury sm:p-6">
            <StepGeospatialIdentification />
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <AuthorityReviewQueue />

          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury sm:p-6">
            <StepDocumentVerification compact hideAssessment />
          </div>

          <AiAssessmentPanel useWorkflow />
        </div>
      </div>
    </div>
  );
}
