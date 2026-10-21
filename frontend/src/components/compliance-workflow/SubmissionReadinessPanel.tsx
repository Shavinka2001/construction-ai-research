"use client";

/**
 * Component 3 — submission readiness.
 *
 * The checklist is the primary object, not the score. A reader's question is
 * "what do I still need?", so the action that answers it lives on the row
 * rather than in a summary somewhere else.
 *
 * The risk band sits apart, visually and semantically, because a deterministic
 * finding ("your street line certificate is missing") and a probabilistic
 * estimate ("this looks likely to need rework") carry different certainty and
 * a user acts on them differently.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  FileWarning,
  Loader2,
  Paperclip,
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
  /** Documents the surrounding workflow already knows about. */
  documents?: SubmittedDocument[];
  /** Condition flags; an absent key means "unknown", not "does not apply". */
  context: Record<string, boolean>;
  autoAssess?: boolean;
};

/** Requirement id -> the file the user attached against it. */
type Attachments = Record<string, string>;

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

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.txt";

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
      <svg viewBox="0 0 64 64" className="h-20 w-20 -rotate-90" aria-hidden>
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
  attachedName,
  onAttach,
  onDetach,
  busy,
}: {
  requirement: RequirementOutcome;
  result: AssessmentResult;
  attachedName: string | null;
  onAttach: (requirementId: string, fileName: string) => void;
  onDetach: (requirementId: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const finding = findingFor(result, requirement.requirement_id);
  const tone = REQUIREMENT_STATE_TONES[requirement.state];
  const hasDetail = finding != null || requirement.condition != null;
  const inputId = `attach-${requirement.requirement_id}`;

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

          {attachedName && (
            <p className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
              <Paperclip className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{attachedName}</span>
              <button
                type="button"
                onClick={() => onDetach(requirement.requirement_id)}
                aria-label={`Remove ${attachedName}`}
                className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            {hasDetail && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:text-blue-900"
              >
                {open ? "Hide detail" : "Why this?"}
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    open && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>
            )}
            <label
              htmlFor={inputId}
              className={cn(
                "cursor-pointer text-[11px] font-semibold text-slate-600 underline-offset-2 hover:text-blue-700 hover:underline",
                busy && "pointer-events-none opacity-50"
              )}
            >
              {attachedName ? "Replace" : "Upload"}
              <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept={ACCEPTED}
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onAttach(requirement.requirement_id, file.name);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

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

              {/* Where to get it, or the fact that nobody publishes how. The
                  second case is shown plainly rather than left blank: an
                  applicant who knows the procedure is unpublished knows to
                  ring the authority, which is more use than silence. */}
              {requirement.acquisition && (
                <div className="border-t border-slate-200 pt-2">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    How to get it
                  </p>
                  {requirement.acquisition.publication_status === "published" ? (
                    <>
                      <p>{requirement.acquisition.how_to_obtain}</p>
                      {requirement.acquisition.obtain_url && (
                        <a
                          href={requirement.acquisition.obtain_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                        >
                          Apply here
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="text-amber-700">
                      <span className="font-semibold">Not published.</span>{" "}
                      {requirement.acquisition.authority} does not publish how to
                      obtain this — contact them directly.
                      {requirement.acquisition.note
                        ? ` ${requirement.acquisition.note}`
                        : ""}
                    </p>
                  )}
                </div>
              )}
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[11px] text-slate-400">
                <span className="font-mono">{requirement.requirement_id}</span>
                {finding?.source_section && (
                  <span>· {finding.source_section}</span>
                )}
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
        <FileWarning
          className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
          aria-hidden
        />
        <div className="text-xs text-slate-500">
          <p className="font-semibold text-slate-700">Risk model unavailable</p>
          <p className="mt-0.5">
            The checklist above is unaffected — it does not depend on the model.
            {result.ml_unavailable_reason
              ? ` (${result.ml_unavailable_reason})`
              : ""}
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
  const [attachments, setAttachments] = useState<Attachments>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Requirement id -> official document name, so an attachment can be sent
  // under the name the rule engine matches on.
  const nameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of result?.requirements ?? []) {
      map[r.requirement_id] = r.document_name;
    }
    return map;
  }, [result]);

  const payloadDocuments = useMemo<SubmittedDocument[]>(() => {
    const attached = Object.keys(attachments)
      .map((id) => nameById[id])
      .filter((name): name is string => Boolean(name))
      // No OCR module yet, so an attachment is accepted but unverified.
      // Extraction is not authentication, and the engine says so.
      .map<SubmittedDocument>((name) => ({ type: name, status: "unverified" }));
    return [...(documents ?? []), ...attached];
  }, [documents, attachments, nameById]);

  const run = useCallback(
    async (docs: SubmittedDocument[]) => {
      setLoading(true);
      setError(null);
      try {
        setResult(
          await assessApplication({
            project_id: projectId,
            application_type: applicationType,
            documents: docs,
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
    },
    [applicationType, projectId, context]
  );

  // First assessment: with no documents, every applicable requirement comes
  // back outstanding, which is the correct starting checklist.
  useEffect(() => {
    if (autoAssess) void run(documents ?? []);
  }, [autoAssess, run, documents]);

  const handleAttach = useCallback(
    (requirementId: string, fileName: string) => {
      const next = { ...attachments, [requirementId]: fileName };
      setAttachments(next);
      const names = Object.keys(next)
        .map((id) => nameById[id])
        .filter((n): n is string => Boolean(n))
        .map<SubmittedDocument>((name) => ({ type: name, status: "unverified" }));
      void run([...(documents ?? []), ...names]);
    },
    [attachments, nameById, documents, run]
  );

  const handleDetach = useCallback(
    (requirementId: string) => {
      const next = { ...attachments };
      delete next[requirementId];
      setAttachments(next);
      const names = Object.keys(next)
        .map((id) => nameById[id])
        .filter((n): n is string => Boolean(n))
        .map<SubmittedDocument>((name) => ({ type: name, status: "unverified" }));
      void run([...(documents ?? []), ...names]);
    },
    [attachments, nameById, documents, run]
  );

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
                {result.summary.document_mismatch_count} inconsistent ·{" "}
                {result.summary.manual_review_count} to confirm
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void run(payloadDocuments)}
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
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
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
                attachedName={attachments[requirement.requirement_id] ?? null}
                onAttach={handleAttach}
                onDetach={handleDetach}
                busy={loading}
              />
            ))}
          </ul>
        </div>
      )}

      {result && result.application_procedure.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
            How to lodge this application
          </summary>
          <ol className="mt-3 space-y-1.5">
            {result.application_procedure.map((s) => (
              <li key={s.step_order} className="flex gap-2.5 text-xs text-slate-600">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                  {s.step_order}
                </span>
                <span className="leading-snug">{s.step}</span>
              </li>
            ))}
          </ol>
          {result.application_procedure[0]?.source_url && (
            <a
              href={result.application_procedure[0].source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline"
            >
              Official source
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </details>
      )}

      {result && (
        <div className="space-y-2 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
          {/* Stated on screen rather than buried in the report: the applicant
              is told why some of this checklist has no instructions attached. */}
          {result.acquisition_coverage.authorities > 0 && (
            <p className="not-italic">
              <span className="font-semibold text-slate-500">
                {result.acquisition_coverage.publish_a_procedure} of{" "}
                {result.acquisition_coverage.authorities} issuing authorities
              </span>{" "}
              publish how to obtain their document. Where none is published this
              checklist names the authority to contact instead of guessing.
            </p>
          )}
          <p className="italic">
            Attachments are assessed for completeness only — they are not stored
            or authenticated yet, so each is reported as unverified. This
            assessment is not a government approval.
          </p>
        </div>
      )}
    </section>
  );
}
