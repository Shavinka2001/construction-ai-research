"use client";

/**
 * Component 3 — submission readiness.
 *
 * The checklist is the primary object, not the score. A reader's question is
 * "what do I still need?", and every row carries the action that answers it.
 *
 * The risk band sits in its own band, visually separated and labelled as a
 * prototype, because a deterministic finding ("your street line certificate is
 * missing") and a probabilistic estimate ("this looks likely to need rework")
 * carry different levels of certainty and a user acts on them differently.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  FileWarning,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import {
  ASSESSMENT_STATUS_LABELS,
  REQUIREMENT_STATE_LABELS,
  REQUIREMENT_STATE_TONES,
  RISK_LABELS,
  actionableRequirements,
  assessApplication,
  findingFor,
  readyCount,
  type ApplicationType,
  type AssessmentResult,
  type RequirementOutcome,
  type RequirementState,
  type StateTone,
  type SubmittedDocument,
} from "@/lib/submission-readiness";
import { ApiRequestError } from "@/lib/api";
import { cn } from "@/lib/utils";

type SubmissionReadinessPanelProps = {
  applicationType?: ApplicationType;
  projectId?: number | null;
  documents: SubmittedDocument[];
  /** Condition flags; an absent key means "unknown", not "does not apply". */
  context: Record<string, boolean>;
  /** Assess on mount and whenever the inputs change. */
  autoAssess?: boolean;
};

const TONE_STYLES: Record<StateTone, { dot: string; pill: string }> = {
  success: {
    dot: "bg-emerald-500 text-white",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  warning: {
    dot: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
    pill: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  danger: {
    dot: "bg-red-100 text-red-600 ring-1 ring-red-200",
    pill: "bg-red-50 text-red-700 ring-red-200",
  },
  neutral: {
    dot: "bg-slate-100 text-slate-400 ring-1 ring-slate-200",
    pill: "bg-slate-50 text-slate-500 ring-slate-200",
  },
};

function StateIcon({ state }: { state: RequirementState }) {
  const tone = REQUIREMENT_STATE_TONES[state];
  const Icon =
    state === "satisfied"
      ? Check
      : state === "manual_review"
        ? CircleHelp
        : tone === "danger"
          ? X
          : AlertTriangle;
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        TONE_STYLES[tone].dot
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
    </span>
  );
}

function ReadinessRing({ ready, total }: { ready: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((ready / total) * 100);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 64 64" className="h-20 w-20 -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-slate-200"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          className={cn(
            "transition-[stroke-dashoffset] duration-500",
            pct === 100 ? "stroke-emerald-500" : "stroke-blue-500"
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums text-slate-900">
          {ready}/{total}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
          ready
        </span>
      </div>
    </div>
  );
}

function RequirementRow({
  requirement,
  result,
}: {
  requirement: RequirementOutcome;
  result: AssessmentResult;
}) {
  const [open, setOpen] = useState(false);
  const finding = findingFor(result, requirement.requirement_id);
  const tone = REQUIREMENT_STATE_TONES[requirement.state];
  const hasDetail = finding != null || requirement.condition != null;

  return (
    <li className="border-b border-slate-100 last:border-b-0">
      <div className="flex items-start gap-3 py-3">
        <StateIcon state={requirement.state} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-sm font-medium text-slate-800">
              {requirement.document_name}
            </p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
                TONE_STYLES[tone].pill
              )}
            >
              {REQUIREMENT_STATE_LABELS[requirement.state]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{requirement.authority}</p>

          {hasDetail && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:text-blue-900"
            >
              {open ? "Hide detail" : "Why this?"}
              <ChevronDown
                className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
                aria-hidden
              />
            </button>
          )}

          {open && (
            <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              {finding && <p>{finding.issue}</p>}
              {finding && (
                <p className="font-medium text-slate-800">
                  {finding.corrective_action}
                </p>
              )}
              {requirement.condition && (
                <p className="text-slate-500">
                  <span className="font-semibold">Applies when:</span>{" "}
                  {requirement.condition}
                </p>
              )}
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[11px] text-slate-400">
                <span className="font-mono">{requirement.requirement_id}</span>
                {finding?.source_section && <span>· {finding.source_section}</span>}
                {finding?.source_url && (
                  <a
                    href={finding.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                  >
                    Official source
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function RiskBand({ result }: { result: AssessmentResult }) {
  if (!result.ml_available || !result.ml_prediction) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <div className="text-xs text-slate-500">
          <p className="font-semibold text-slate-700">Risk model unavailable</p>
          <p className="mt-0.5">
            The checklist above is unaffected — it does not depend on the model.
            {result.ml_unavailable_reason ? ` (${result.ml_unavailable_reason})` : ""}
          </p>
        </div>
      </div>
    );
  }

  const { risk_level } = result.ml_prediction;
  const style =
    risk_level === "high"
      ? "border-red-200 bg-red-50/60"
      : risk_level === "medium"
        ? "border-amber-200 bg-amber-50/60"
        : "border-emerald-200 bg-emerald-50/60";
  const text =
    risk_level === "high"
      ? "text-red-700"
      : risk_level === "medium"
        ? "text-amber-700"
        : "text-emerald-700";

  return (
    <div className={cn("rounded-xl border px-4 py-3", style)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Prototype rework risk
        </span>
        <span className={cn("text-sm font-bold", text)}>
          {RISK_LABELS[risk_level]}
        </span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
          prototype
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">
        {result.ml_prediction.disclaimer}
      </p>
    </div>
  );
}

export function SubmissionReadinessPanel({
  applicationType = "building_permit",
  projectId = null,
  documents,
  context,
  autoAssess = true,
}: SubmissionReadinessPanelProps) {
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(
        await assessApplication({
          project_id: projectId,
          application_type: applicationType,
          documents,
          context,
        })
      );
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Could not reach the assessment service."
      );
    } finally {
      setLoading(false);
    }
  }, [applicationType, projectId, documents, context]);

  useEffect(() => {
    if (autoAssess) void run();
  }, [autoAssess, run]);

  const rows = useMemo(
    () => (result ? actionableRequirements(result) : []),
    [result]
  );
  const counts = result ? readyCount(result) : { ready: 0, total: 0 };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <ReadinessRing ready={counts.ready} total={counts.total} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
              Pre-Submission Compliance Assessment
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {result
                ? ASSESSMENT_STATUS_LABELS[result.assessment_status]
                : "Submission readiness"}
            </h2>
            {result && (
              <p className="mt-1 text-sm text-slate-500">
                {result.summary.missing_document_count} missing ·{" "}
                {result.summary.document_mismatch_count} inconsistency
                {result.summary.document_mismatch_count === 1 ? "" : "ies"} ·{" "}
                {result.summary.manual_review_count} to confirm
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-400 hover:text-blue-700 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden />
          )}
          Reassess
        </button>
      </header>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && <RiskBand result={result} />}

      {result && rows.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Required documents
          </p>
          <ul className="mt-1">
            {rows.map((requirement) => (
              <RequirementRow
                key={requirement.requirement_id}
                requirement={requirement}
                result={result}
              />
            ))}
          </ul>
        </div>
      )}

      {result && (
        <p className="border-t border-slate-100 pt-3 text-[11px] italic text-slate-400">
          This assessment is not a government approval. Requirements are read
          from official sources and may change; confirm with the relevant
          authority before submitting.
        </p>
      )}
    </section>
  );
}
