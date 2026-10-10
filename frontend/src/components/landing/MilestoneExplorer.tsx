"use client";

import { useId, useState } from "react";
import { CalendarDays, CircleCheck, CircleDot, Percent } from "lucide-react";

import { cn } from "@/lib/utils";

import { MILESTONES } from "@/components/landing/data/milestones";
import type { Milestone } from "@/components/landing/types";

/** Renders an ISO date, or says plainly that there is not one yet. */
function formatDate(iso: string | null): string {
  if (!iso) return "To be announced";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "To be announced";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatMarks(marks: number | null): string {
  return marks === null ? "To be confirmed" : `${marks}%`;
}

const STATUS_LABELS: Record<Milestone["status"], string> = {
  completed: "Completed",
  scheduled: "Scheduled",
  upcoming: "Upcoming",
};

/**
 * Milestone browser.
 *
 * The project web guidelines ask for a drop-down so the reader can choose an
 * assessment, so the select is the primary control. The full schedule is also
 * rendered as a table underneath: the drop-down is good for reading one item,
 * a table is better for comparing dates and weights, and it keeps the whole
 * schedule available without any interaction.
 */
export function MilestoneExplorer() {
  const selectId = useId();
  const [selectedId, setSelectedId] = useState(MILESTONES[0]?.id ?? "");

  const selected =
    MILESTONES.find((milestone) => milestone.id === selectedId) ?? MILESTONES[0];

  const totalMarks = MILESTONES.reduce(
    (sum, milestone) => sum + (milestone.marks ?? 0),
    0
  );

  return (
    <div>
      {/* Chooser. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="sm:max-w-sm sm:flex-1">
          <label
            htmlFor={selectId}
            className="lp-label text-slate-400"
          >
            Choose an assessment
          </label>
          <select
            id={selectId}
            value={selected?.id}
            onChange={(event) => setSelectedId(event.target.value)}
            className="lp-focus mt-2.5 block min-h-touch w-full appearance-none border border-slate-300 bg-white bg-[length:0.7rem] bg-[right_1rem_center] bg-no-repeat px-4 py-3 pr-10 text-body font-semibold text-ink ring-offset-white"
            style={{
              // Inline so the chevron needs no extra asset or icon font.
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none' stroke='%230F172A' stroke-width='1.6'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5'/%3E%3C/svg%3E\")",
            }}
          >
            {MILESTONES.map((milestone) => (
              <option key={milestone.id} value={milestone.id}>
                {milestone.name}
              </option>
            ))}
          </select>
        </div>

        <p className="font-mono text-micro text-slate-400">
          {MILESTONES.length} assessments
          {totalMarks > 0 ? ` · ${totalMarks}% allocated` : ""}
        </p>
      </div>

      {/* Detail for the chosen assessment. */}
      {selected ? (
        <article
          // Re-mounting on change replays the reveal, which makes the switch
          // legible without an explicit transition.
          key={selected.id}
          className="mt-8 animate-fade-up border-t-2 border-gold bg-slate-50 p-6 sm:p-8"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="font-display text-xl font-bold tracking-heading text-ink sm:text-2xl">
              {selected.name}
            </h2>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 lp-label",
                selected.status === "completed"
                  ? "text-emerald-brand-dark"
                  : "text-slate-500"
              )}
            >
              {selected.status === "completed" ? (
                <CircleCheck aria-hidden className="h-3.5 w-3.5" />
              ) : (
                <CircleDot aria-hidden className="h-3.5 w-3.5" />
              )}
              {STATUS_LABELS[selected.status]}
            </span>
          </div>

          <dl className="mt-6 grid gap-5 border-y border-slate-200 py-5 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <CalendarDays
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
              />
              <div>
                <dt className="lp-label text-slate-400">
                  Date
                </dt>
                <dd className="mt-1 text-body font-semibold text-ink">
                  {formatDate(selected.date)}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Percent
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
              />
              <div>
                <dt className="lp-label text-slate-400">
                  Marks allocated
                </dt>
                <dd className="mt-1 text-body font-semibold text-ink">
                  {formatMarks(selected.marks)}
                </dd>
              </div>
            </div>
          </dl>

          <p className="mt-6 max-w-2xl text-body leading-[1.75] text-slate-600">
            {selected.description}
          </p>

          <div className="mt-6">
            <h3 className="lp-label text-slate-400">
              Deliverables
            </h3>
            <ul className="mt-3 space-y-1.5">
              {selected.deliverables.map((item) => (
                <li
                  key={item}
                  className="flex gap-2.5 text-body-sm text-slate-600"
                >
                  <span
                    aria-hidden
                    className="mt-[0.5rem] h-1 w-1 shrink-0 rounded-full bg-gold"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </article>
      ) : null}

      {/* Full schedule. */}
      <div className="mt-14">
        <h2 className="lp-label text-slate-400">
          Full schedule
        </h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left">
            <caption className="sr-only">
              Every assessment in the project, with its date, the marks
              allocated and its current status.
            </caption>
            <thead>
              <tr className="border-y border-slate-200">
                {["Assessment", "Date", "Marks", "Status"].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="py-3 pr-6 font-mono text-label-sm font-medium uppercase tracking-label text-slate-400 last:pr-0"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MILESTONES.map((milestone) => (
                <tr
                  key={milestone.id}
                  className={cn(
                    "border-b border-slate-200 transition-colors",
                    milestone.id === selected?.id && "bg-gold/[0.07]"
                  )}
                >
                  <th scope="row" className="py-3.5 pr-6 align-top">
                    <button
                      type="button"
                      onClick={() => setSelectedId(milestone.id)}
                      className="lp-focus text-left text-body-sm font-semibold text-ink underline decoration-slate-300 decoration-1 underline-offset-4 transition-colors hover:decoration-gold ring-offset-white"
                    >
                      {milestone.name}
                    </button>
                  </th>
                  <td className="py-3.5 pr-6 align-top font-mono text-caption text-slate-600">
                    {formatDate(milestone.date)}
                  </td>
                  <td className="py-3.5 pr-6 align-top font-mono text-caption tabular-nums text-slate-600">
                    {formatMarks(milestone.marks)}
                  </td>
                  <td
                    className={cn(
                      "py-3.5 align-top font-mono text-micro uppercase tracking-label",
                      milestone.status === "completed"
                        ? "text-emerald-brand-dark"
                        : "text-slate-400"
                    )}
                  >
                    {STATUS_LABELS[milestone.status]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
