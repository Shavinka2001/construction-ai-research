import type { Metadata } from "next";
import { ArrowUpRight, Download } from "lucide-react";

import { cn } from "@/lib/utils";

import { PageHeader } from "@/components/landing/primitives/PageHeader";
import { Container, Section } from "@/components/landing/primitives/Section";
import { Reveal } from "@/components/landing/primitives/Reveal";
import {
  DOCUMENT_KIND_LABELS,
  PROJECT_DOCUMENTS,
} from "@/components/landing/data/documents";
import type { ProjectDocument } from "@/components/landing/types";

export const metadata: Metadata = {
  title: "Documents",
  description:
    "Documents produced for the ConstructAI research project — charter, proposal, checklists, final submissions, papers and the research poster.",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Documents grouped by kind, in the order the guidelines list them. */
const GROUP_ORDER: readonly ProjectDocument["kind"][] = [
  "charter",
  "proposal",
  "checklist",
  "final",
  "other",
];

export default function DocumentsPage() {
  const groups = GROUP_ORDER.map((kind) => ({
    kind,
    documents: PROJECT_DOCUMENTS.filter((doc) => doc.kind === kind),
  })).filter((group) => group.documents.length > 0);

  const published = PROJECT_DOCUMENTS.filter((doc) => doc.href !== null).length;

  return (
    <>
      <PageHeader
        eyebrow="Documents"
        title="Everything written down."
        lede="Documents already produced can be read in the browser or downloaded as PDF. Those still in progress are listed as pending rather than hidden, so the record stays complete."
      />

      <Section id="documents" className="py-section lg:py-section-lg">
        <Container>
          <p className="font-mono text-micro text-slate-500">
            {published} of {PROJECT_DOCUMENTS.length} available
          </p>

          <div className="mt-10 space-y-12">
            {groups.map((group) => (
              <Reveal key={group.kind}>
                <section aria-labelledby={`group-${group.kind}`}>
                  <h2
                    id={`group-${group.kind}`}
                    className="border-b border-slate-200 pb-3 lp-label text-slate-500"
                  >
                    {DOCUMENT_KIND_LABELS[group.kind]}
                  </h2>

                  <ul>
                    {group.documents.map((doc) => {
                      const isPending = doc.href === null;

                      return (
                        <li
                          key={doc.id}
                          className="flex min-h-touch flex-col gap-3 border-b border-slate-200 py-4 sm:flex-row sm:items-center sm:gap-4"
                        >
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block text-body font-semibold leading-snug",
                                isPending ? "text-slate-500" : "text-ink"
                              )}
                            >
                              {doc.title}
                            </span>
                            <span className="mt-1 block font-mono text-label text-slate-500">
                              {doc.author}
                              {doc.submittedOn
                                ? ` · ${formatDate(doc.submittedOn)}`
                                : ""}
                            </span>
                          </span>

                          {isPending ? (
                            <span className="shrink-0 lp-label text-slate-500">
                              Pending
                            </span>
                          ) : (
                            <span className="flex shrink-0 items-center gap-5">
                              {/* Opens the PDF in a new tab for reading. */}
                              <a
                                href={doc.href ?? "#"}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="lp-focus group inline-flex min-h-touch items-center gap-1.5 lp-label text-gold-ink ring-offset-white"
                              >
                                View
                                <ArrowUpRight
                                  aria-hidden
                                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                                />
                              </a>

                              {/* Saves the file rather than displaying it. */}
                              <a
                                href={doc.href ?? "#"}
                                download
                                className="lp-focus group inline-flex min-h-touch items-center gap-1.5 lp-label text-slate-500 transition-colors hover:text-ink ring-offset-white"
                              >
                                Download
                                <Download
                                  aria-hidden
                                  className="h-3.5 w-3.5 transition-transform group-hover:translate-y-0.5"
                                />
                              </a>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
