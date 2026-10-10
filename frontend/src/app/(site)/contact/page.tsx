import type { Metadata } from "next";

import { PageHeader } from "@/components/landing/primitives/PageHeader";
import { Container, Section } from "@/components/landing/primitives/Section";
import { EnquiryForm } from "@/components/landing/EnquiryForm";
import {
  DEPARTMENT_ADDRESS,
  GENERAL_CONTACTS,
} from "@/components/landing/data/contact";
import { SUPERVISORS, TEAM } from "@/components/landing/data/team";

export const metadata: Metadata = {
  title: "Contact us",
  description:
    "General contact details for the Construction AI research group, and a message template for enquiries.",
};

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact us"
        title="Get in touch."
        lede="General enquiries about the research, requests for documents, or questions about the platform."
      />

      <Section id="contact" className="py-16 sm:py-20">
        <Container>
          <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
            {/* Directory. */}
            <div className="lg:col-span-5">
              <h2 className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-slate-400">
                General contacts
              </h2>

              <dl className="mt-5 border-t border-slate-200">
                {GENERAL_CONTACTS.map((channel) => (
                  <div
                    key={channel.label}
                    className="flex flex-col gap-1 border-b border-slate-200 py-4 sm:flex-row sm:items-baseline sm:gap-6"
                  >
                    <dt className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-slate-400 sm:w-32 sm:shrink-0">
                      {channel.label}
                    </dt>
                    <dd>
                      <a
                        href={channel.href}
                        className="lp-focus font-mono text-[0.875rem] text-ink underline decoration-slate-300 decoration-1 underline-offset-4 transition-colors hover:decoration-gold ring-offset-white"
                      >
                        {channel.value}
                      </a>
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Per-member addresses. */}
              <h2 className="mt-12 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-slate-400">
                Researchers
              </h2>

              <dl className="mt-5 border-t border-slate-200">
                {TEAM.filter((member) => member.email).map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col gap-1 border-b border-slate-200 py-4 sm:flex-row sm:items-baseline sm:gap-6"
                  >
                    <dt className="text-[0.875rem] font-semibold text-ink sm:w-32 sm:shrink-0">
                      {member.name}
                    </dt>
                    <dd className="min-w-0">
                      <a
                        href={`mailto:${member.email}`}
                        className="lp-focus break-all font-mono text-[0.8125rem] text-slate-600 underline decoration-slate-300 decoration-1 underline-offset-4 transition-colors hover:text-ink hover:decoration-gold ring-offset-white"
                      >
                        {member.email}
                      </a>
                      <span className="mt-0.5 block font-mono text-[0.625rem] uppercase tracking-[0.12em] text-slate-400">
                        {member.componentLabel}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Postal address. */}
              <h2 className="mt-12 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-slate-400">
                Department
              </h2>
              <address className="mt-4 not-italic text-[0.875rem] leading-[1.8] text-slate-600">
                {DEPARTMENT_ADDRESS.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>

              <p className="mt-6 text-[0.8125rem] leading-relaxed text-slate-500">
                For matters concerning assessment or supervision, please contact{" "}
                {SUPERVISORS[0]?.name ?? "the supervisor"} directly.
              </p>
            </div>

            {/* Message template. */}
            <div className="lg:col-span-7">
              <h2 className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-slate-400">
                Message template
              </h2>
              <p className="mt-3 max-w-xl text-[0.9375rem] leading-[1.7] text-slate-600">
                Fill this in and it will open in your own mail application,
                already addressed and formatted.
              </p>

              <div className="mt-8">
                <EnquiryForm />
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
