/* eslint-disable @next/next/no-img-element */
import { Mail } from "lucide-react";

import { Container, Section } from "@/components/landing/primitives/Section";
import { Reveal } from "@/components/landing/primitives/Reveal";
import {
  INSTITUTION,
  SUPERVISORS,
  TEAM,
} from "@/components/landing/data/team";

/** First letter of the first two words — used when no photograph is supplied. */
function monogram(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Research group roster.
 *
 * Each entry gives the researcher, their identification photograph where one
 * is supplied, the component they own, what they built, their contact address
 * and any achievements — the set the project web guidelines ask for on the
 * About us page.
 *
 * A plain <img> is used rather than next/image so the page still works under a
 * static export without an image optimiser configured.
 */
export function TeamSection() {
  return (
    <>
      <Section id="team" className="py-section lg:py-section-lg">
        <Container>
          <h2
            id="team-heading"
            className="lp-label text-slate-400"
          >
            Group members
          </h2>

          <ul className="mt-6 border-t border-slate-200">
            {TEAM.map((member, index) => (
              <Reveal as="li" key={member.id}>
                <article className="grid gap-5 border-b border-slate-200 py-8 sm:grid-cols-12 sm:gap-8 sm:py-10">
                  {/* Identity. */}
                  <div className="sm:col-span-4">
                    <div className="flex items-start gap-4">
                      {member.photo ? (
                        <img
                          src={member.photo}
                          alt=""
                          width={56}
                          height={56}
                          loading="lazy"
                          decoding="async"
                          className="h-14 w-14 shrink-0 object-cover grayscale"
                        />
                      ) : (
                        <span
                          aria-hidden
                          className="grid h-14 w-14 shrink-0 place-items-center border border-slate-200 bg-slate-50 font-display text-sm font-bold text-slate-400"
                        >
                          {monogram(member.name)}
                        </span>
                      )}

                      <div className="min-w-0">
                        <p className="flex items-baseline gap-2.5">
                          <span className="font-mono text-label tabular-nums text-gold">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="font-display text-base font-bold tracking-snug text-ink">
                            {member.name}
                          </span>
                        </p>

                        {member.studentId ? (
                          <p className="mt-1 font-mono text-label text-slate-400">
                            {member.studentId}
                          </p>
                        ) : null}

                        {member.email ? (
                          <a
                            href={`mailto:${member.email}`}
                            className="lp-focus mt-2 inline-flex min-h-touch items-center gap-1.5 font-mono text-label text-slate-500 underline decoration-slate-300 decoration-1 underline-offset-4 transition-colors hover:text-ink hover:decoration-gold ring-offset-white"
                          >
                            <Mail aria-hidden className="h-3.5 w-3.5" />
                            {member.email}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Component. */}
                  <div className="sm:col-span-3">
                    <p className="lp-label text-slate-400">
                      {member.componentLabel}
                    </p>
                    <p className="mt-2 text-body-sm font-semibold leading-snug text-ink">
                      {member.componentTitle}
                    </p>
                    {member.branch ? (
                      <p className="mt-2.5 font-mono text-label text-slate-400">
                        branch/{member.branch}
                      </p>
                    ) : null}
                  </div>

                  {/* Contribution and achievements. */}
                  <div className="sm:col-span-5">
                    <p className="text-caption leading-[1.7] text-slate-600">
                      {member.focusAreas.join(". ")}.
                    </p>

                    {member.achievements && member.achievements.length > 0 ? (
                      <ul className="mt-3 space-y-1">
                        {member.achievements.map((achievement) => (
                          <li
                            key={achievement}
                            className="flex gap-2 text-caption text-slate-500"
                          >
                            <span
                              aria-hidden
                              className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-gold"
                            />
                            {achievement}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </article>
              </Reveal>
            ))}
          </ul>
        </Container>
      </Section>

      {/* Supervision and affiliation. */}
      <Section
        id="supervision"
        tone="ink"
        ariaLabel="Supervision and affiliation"
        className="py-section lg:py-section-lg"
      >
        <Container>
          <div className="grid gap-10 sm:grid-cols-12 sm:gap-8">
            <div className="sm:col-span-4">
              <h2 className="lp-label text-gold">
                Supervision
              </h2>
              <ul className="mt-5 space-y-4">
                {SUPERVISORS.map((supervisor) => (
                  <li key={supervisor.id}>
                    <p className="text-body font-semibold text-white">
                      {supervisor.name}
                    </p>
                    <p className="mt-0.5 text-micro text-slate-500">
                      {supervisor.title} · {supervisor.role}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="sm:col-span-8">
              <h2 className="lp-label text-gold">
                Affiliation
              </h2>

              <dl className="mt-5 divide-y divide-white/5 border-y border-white/5">
                {[
                  ["University", INSTITUTION.university],
                  ["Faculty", INSTITUTION.faculty],
                  ["Department", INSTITUTION.department],
                  ["Programme", INSTITUTION.degree],
                  ["Academic year", INSTITUTION.academicYear],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:gap-6"
                  >
                    <dt className="lp-label text-slate-500 sm:w-36 sm:shrink-0">
                      {label}
                    </dt>
                    <dd className="text-body-sm text-slate-300">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
