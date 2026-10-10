import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";

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
    "Documents produced for the Construction AI research project — charter, proposal, checklists and final submissions.",
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
        lede="Documents already submitted carry a link. Those still in progress are listed as pending rather than hidden, so the record stays complete."
      />

      <Section id="documents" className="py-16 sm:py-20">
        <Container>
          <p className="font-mono text-[0.75rem] text-slate-400">
            {published} of {PROJECT_DOCUMENTS.length} available
          </p>

          <div className="mt-10 space-y-12">
            {groups.map((group) => (
              <Reveal key={group.kind}>
                <section aria-labelledby={`group-${group.kind}`}>
                  <h2
                    id={`group-${group.kind}`}
                    className="border-b border-slate-200 pb-3 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-slate-400"
                  >
                    {DOCUMENT_KIND_LABELS[group.kind]}
                  </h2>

                  <ul>
                    {group.documents.map((doc) => {
                      const isPending = doc.href === null;

                      const content = (
                        <>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block text-[0.9375rem] font-semibold leading-snug",
                                isPending ? "text-slate-400" : "text-ink"
                              )}
                            >
                              {doc.title}
                            </span>
                            <span className="mt-1 block font-mono text-[0.6875rem] text-slate-400">
                              {doc.author}
                              {doc.submittedOn
                                ? ` · ${formatDate(doc.submittedOn)}`
                                : ""}
                            </span>
                          </span>

                          {isPending ? (
                            <span className="shrink-0 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-slate-400">
                              Pending
                            </span>
                          ) : (
                            <span className="flex shrink-0 items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-gold-dark">
                              View
                              <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </>
                      );

                      return (
                        <li key={doc.id}>
                          {isPending ? (
                            <div className="flex min-h-touch items-center gap-4 border-b border-slate-200 py-4">
                              {content}
                            </div>
                          ) : (
                            <a
                              href={doc.href ?? "#"}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="lp-focus group flex min-h-touch items-center gap-4 border-b border-slate-200 py-4 transition-colors hover:bg-slate-50 ring-offset-white"
                            >
                              {content}
                            </a>
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
