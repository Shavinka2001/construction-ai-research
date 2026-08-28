"use client";

import { useState } from "react";
import { Check, X, HelpCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditElement, SurveyAuditResult } from "@/lib/land-validation";

function StatusIcon({ status }: { status: AuditElement["status"] }) {
  if (status === "PRESENT")
    return <Check className="h-4 w-4 text-emerald-600" aria-label="present" />;
  if (status === "MISSING")
    return <X className="h-4 w-4 text-red-600" aria-label="missing" />;
  return <HelpCircle className="h-4 w-4 text-amber-500" aria-label="unverified" />;
}

export function SurveyMistakesCard({
  audit,
}: {
  audit: SurveyAuditResult | null;
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (!audit) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Survey Mistake &amp; Regulatory Audit
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Upload and digitize a survey plan in <strong>Parcel Search</strong> to
          run the Sri Lankan Survey Department / UDA checklist.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Survey Mistake &amp; Regulatory Audit
          </p>
          <p className="mt-1 text-sm text-slate-600">{audit.summary}</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
          {audit.compliance_score}/100
        </span>
      </div>

      {!audit.ocr_available && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          OCR engine not available — text-based checks show as “unverified”.
          Install Tesseract and set <code>TESSERACT_CMD</code> for a full audit.
        </p>
      )}

      <ul className="mt-3 divide-y divide-slate-100">
        {audit.elements.map((el) => {
          const isOpen = open === el.key;
          const hasAdvisory = el.advisory.length > 0;
          return (
            <li key={el.key} className="py-2.5">
              <button
                type="button"
                onClick={() => hasAdvisory && setOpen(isOpen ? null : el.key)}
                className={cn(
                  "flex w-full items-center gap-2.5 text-left",
                  hasAdvisory && "cursor-pointer"
                )}
                aria-expanded={isOpen}
              >
                <StatusIcon status={el.status} />
                <span className="flex-1 text-sm text-slate-700">{el.label}</span>
                {el.evidence && (
                  <span className="hidden max-w-[30%] truncate text-[11px] text-slate-400 sm:inline">
                    “{el.evidence}”
                  </span>
                )}
                {hasAdvisory && (
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                      isOpen && "rotate-180"
                    )}
                    aria-hidden
                  />
                )}
              </button>
              {isOpen && hasAdvisory && (
                <ol className="mt-2 ml-6 list-decimal space-y-1 text-[12px] text-slate-500">
                  {el.advisory.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
