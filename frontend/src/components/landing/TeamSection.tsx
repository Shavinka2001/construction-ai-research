import { GraduationCap, GitBranch } from "lucide-react";

import {
  Container,
  Section,
  SectionHeading,
} from "@/components/landing/primitives/Section";
import { Reveal } from "@/components/landing/primitives/Reveal";
import { Badge } from "@/components/landing/primitives/Badge";
import {
  INSTITUTION,
  SUPERVISORS,
  TEAM,
} from "@/components/landing/data/team";

/** First letter of the first two words — avoids shipping any photography. */
function monogram(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function TeamSection() {
  return (
    <Section id="team" tone="ink">
      <Container>
        <SectionHeading
          id="team"
          tone="ink"
          eyebrow="Research team"
          title={
            <>
              Four researchers,{" "}
              <span className="lp-text-gold-gradient">four components</span>,
              one integrated system.
            </>
          }
          description="Each member owns one research component end to end — model, service and interface — and integrates it against the shared platform contracts."
        />

        <ul className="mt-12 grid gap-5 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((member, index) => (
            <Reveal as="li" key={member.id} delay={index * 80}>
              <article className="lp-glass group flex h-full flex-col rounded-2xl p-5 transition-shadow duration-300 hover:shadow-glow-gold">
                <header className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-gold/25 bg-gradient-to-br from-gold/20 to-transparent font-display text-sm font-bold text-gold"
                  >
                    {monogram(member.name)}
                  </span>

                  <div className="min-w-0">
                    <h3 className="truncate font-display text-[0.9375rem] font-bold tracking-tight text-white">
                      {member.name}
                    </h3>
                    {member.studentId ? (
                      <p className="mt-0.5 font-mono text-[0.6875rem] text-slate-500">
                        {member.studentId}
                      </p>
                    ) : null}
                  </div>
                </header>

                <div className="mt-4">
                  <Badge variant="gold">{member.componentLabel}</Badge>
                  <p className="mt-2 text-[0.8125rem] font-semibold leading-snug text-slate-200">
                    {member.componentTitle}
                  </p>
                </div>

                <ul className="mt-4 flex-1 space-y-1.5 border-t border-white/10 pt-4">
                  {member.focusAreas.map((area) => (
                    <li
                      key={area}
                      className="flex gap-2 text-[0.75rem] leading-snug text-slate-400"
                    >
                      <span
                        aria-hidden
                        className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold/70"
                      />
                      {area}
                    </li>
                  ))}
                </ul>

                {member.branch ? (
                  <p className="mt-4 flex items-center gap-1.5 text-[0.6875rem] font-medium text-slate-500">
                    <GitBranch aria-hidden className="h-3.5 w-3.5" />
                    <code className="font-mono">{member.branch}</code>
                  </p>
                ) : null}
              </article>
            </Reveal>
          ))}
        </ul>

        {/* Supervision + affiliation. */}
        <Reveal delay={200} className="mt-6">
          <div className="lp-glass grid gap-6 rounded-2xl p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-10">
            <div>
              <h3 className="flex items-center gap-2 text-[0.625rem] font-bold uppercase tracking-[0.16em] text-gold">
                <GraduationCap aria-hidden className="h-4 w-4" />
                Academic supervision
              </h3>

              <ul className="mt-4 space-y-3">
                {SUPERVISORS.map((supervisor) => (
                  <li key={supervisor.id} className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 font-display text-xs font-bold text-slate-300"
                    >
                      {monogram(supervisor.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">
                        {supervisor.name}
                      </p>
                      <p className="text-[0.6875rem] text-slate-400">
                        {supervisor.title} &middot;{" "}
                        <span className="text-gold">{supervisor.role}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-white/10 pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <h3 className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-gold">
                Affiliation
              </h3>

              <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {[
                  ["University", INSTITUTION.university],
                  ["Faculty", INSTITUTION.faculty],
                  ["Department", INSTITUTION.department],
                  ["Degree programme", INSTITUTION.degree],
                  ["Academic year", INSTITUTION.academicYear],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      {label}
                    </dt>
                    <dd className="mt-0.5 text-[0.8125rem] font-medium leading-snug text-slate-200">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
