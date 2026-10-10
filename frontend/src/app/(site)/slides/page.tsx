import type { Metadata } from "next";
import { ArrowUpRight, Presentation as PresentationIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { PageHeader } from "@/components/landing/primitives/PageHeader";
import { Container, Section } from "@/components/landing/primitives/Section";
import { Reveal } from "@/components/landing/primitives/Reveal";
import { PRESENTATIONS } from "@/components/landing/data/documents";

export const metadata: Metadata = {
  title: "Presentations",
  description:
    "Slide decks from each presentation given during the Construction AI research project.",
};

function formatDate(iso: string | null): string {
  if (!iso) return "Not yet scheduled";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Not yet scheduled";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function SlidesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Presentations"
        title="Slides from each stage."
        lede="The deck presented at every assessment, from the proposal through to the final defence. Decks not yet given are listed so the sequence is clear."
      />

      <Section id="slides" className="py-section lg:py-section-lg">
        <Container>
          <ol className="border-t border-slate-200">
            {PRESENTATIONS.map((deck, index) => {
              const isPending = deck.href === null;

              return (
                <Reveal as="li" key={deck.id}>
                  <article
                    className={cn(
                      "grid gap-4 border-b border-slate-200 py-8 sm:grid-cols-12 sm:gap-8 sm:py-10",
                      isPending && "opacity-70"
                    )}
                  >
                    <div className="flex items-baseline gap-3 sm:col-span-4">
                      <span className="font-mono text-label tabular-nums text-gold">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h2 className="font-display text-lg font-bold tracking-snug text-ink">
                          {deck.title}
                        </h2>
                        <p className="mt-1.5 font-mono text-label text-slate-400">
                          {formatDate(deck.date)}
                        </p>
                      </div>
                    </div>

                    <p className="text-body-sm leading-[1.7] text-slate-600 sm:col-span-5">
                      {deck.summary}
                    </p>

                    <div className="sm:col-span-3 sm:text-right">
                      {isPending ? (
                        <span className="inline-flex items-center gap-2 lp-label text-slate-400">
                          <PresentationIcon aria-hidden className="h-4 w-4" />
                          Not yet presented
                        </span>
                      ) : (
                        <a
                          href={deck.href ?? "#"}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="lp-focus group inline-flex min-h-touch items-center gap-2 border-b border-ink/20 text-body-sm font-semibold text-ink transition-colors hover:border-gold ring-offset-white"
                        >
                          Open slides
                          <ArrowUpRight
                            aria-hidden
                            className="h-4 w-4 text-gold transition-transform group-hover:translate-x-0.5"
                          />
                        </a>
                      )}
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </ol>
        </Container>
      </Section>
    </>
  );
}
