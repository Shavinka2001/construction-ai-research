"use client";

import { useId, useState } from "react";
import { Mail } from "lucide-react";

import { ENQUIRY_ADDRESS } from "@/components/landing/data/contact";

const SUBJECTS = [
  "General enquiry",
  "Research collaboration",
  "Technical question about the platform",
  "Access to documents or slides",
  "Other",
] as const;

/**
 * General e-mail template.
 *
 * The guidelines ask the Contact page to carry one. It composes a `mailto:`
 * rather than posting anywhere, which means no backend, no stored personal
 * data, and it keeps working if the site is ever exported as static files.
 * The composed message is shown before sending so nobody is surprised by what
 * their mail client opens with.
 */
export function EnquiryForm() {
  const nameId = useId();
  const emailId = useId();
  const subjectId = useId();
  const messageId = useId();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [message, setMessage] = useState("");

  const body = [
    `Name: ${name || "—"}`,
    `Reply to: ${email || "—"}`,
    "",
    message || "—",
    "",
    "— Sent from the Construction AI project website",
  ].join("\n");

  const mailto = `mailto:${ENQUIRY_ADDRESS}?subject=${encodeURIComponent(
    `[Construction AI] ${subject}`
  )}&body=${encodeURIComponent(body)}`;

  const fieldClass =
    "lp-focus mt-2 block min-h-touch w-full border border-slate-300 bg-white px-4 py-3 text-body text-ink placeholder:text-slate-400 ring-offset-white";

  const labelClass =
    "lp-label text-slate-400";

  return (
    <form
      // Nothing is submitted: the action is the composed mailto link below.
      onSubmit={(event) => event.preventDefault()}
      className="max-w-xl"
    >
      <div className="space-y-5">
        <div>
          <label htmlFor={nameId} className={labelClass}>
            Your name
          </label>
          <input
            id={nameId}
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Jane Perera"
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor={emailId} className={labelClass}>
            Your e-mail
          </label>
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor={subjectId} className={labelClass}>
            Subject
          </label>
          <select
            id={subjectId}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className={`${fieldClass} appearance-none bg-[length:0.7rem] bg-[right_1rem_center] bg-no-repeat pr-10`}
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none' stroke='%230F172A' stroke-width='1.6'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5'/%3E%3C/svg%3E\")",
            }}
          >
            {SUBJECTS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={messageId} className={labelClass}>
            Message
          </label>
          <textarea
            id={messageId}
            rows={6}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="How can we help?"
            className={`${fieldClass} resize-y leading-relaxed`}
          />
        </div>
      </div>

      <a
        href={mailto}
        className="lp-focus mt-7 inline-flex min-h-touch items-center justify-center gap-2 bg-gold px-6 text-body font-bold text-ink transition-colors hover:bg-gold-light ring-offset-white"
      >
        <Mail aria-hidden className="h-4 w-4" />
        Open in your mail app
      </a>

      <p className="mt-4 text-micro leading-relaxed text-slate-500">
        This opens your own e-mail application with the message below ready to
        send to <span className="font-mono text-slate-600">{ENQUIRY_ADDRESS}</span>.
        Nothing is submitted to or stored by this website.
      </p>

      {/* Preview of exactly what will be handed to the mail client. */}
      <details className="mt-6 border-t border-slate-200 pt-4">
        <summary className="lp-focus cursor-pointer lp-label text-slate-400 ring-offset-white">
          Preview the message
        </summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words bg-slate-50 p-4 font-mono text-micro leading-relaxed text-slate-600">
          {`To: ${ENQUIRY_ADDRESS}\nSubject: [Construction AI] ${subject}\n\n${body}`}
        </pre>
      </details>
    </form>
  );
}
