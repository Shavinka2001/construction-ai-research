"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuthorityReviewQueue } from "@/components/dashboard/authority/AuthorityReviewQueue";
import { AiAssessmentPanel } from "@/components/dashboard/authority/AiAssessmentPanel";
import { StepDocumentVerification } from "@/components/compliance-workflow/StepDocumentVerification";
import { StepGeospatialIdentification } from "@/components/compliance-workflow/StepGeospatialIdentification";

export function PendingApplicationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Pending Applications
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Review active compliance sessions with live geospatial mapping and
            ML-assisted document verification.
          </p>
        </div>
        <Link
          href="/dashboard/regulatory-checker"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-charcoal px-4 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-charcoal-light"
        >
          Open Regulatory Checker
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <AuthorityReviewQueue />
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury sm:p-6">
            <StepGeospatialIdentification />
          </div>
        </div>
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury sm:p-6">
            <StepDocumentVerification compact hideAssessment />
          </div>
          <AiAssessmentPanel useWorkflow />
        </div>
      </div>
    </div>
  );
}
