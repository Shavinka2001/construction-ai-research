import type { ContactChannel } from "@/components/landing/types";

/*
 * ===========================================================================
 *  Contact details.
 *
 *  The group has no single shared mailbox, so general enquiries are addressed
 *  to all four researchers at once and the per-member addresses are listed
 *  separately on the Contact page from `data/team.ts`.
 *
 *  >>> No telephone number is published yet. Add one here when the group
 *      agrees which number to give out. <<<
 * ===========================================================================
 */

export const GENERAL_CONTACTS: readonly ContactChannel[] = [
  {
    label: "Project enquiries",
    value: "All four researchers",
    href:
      "mailto:kavithashwinranaweera@gmail.com,345kavindushavinka@gmail.com,vinusha1212@gmail.com,shamindiemalsha@gmail.com",
  },
  {
    label: "Supervisor",
    value: "ravi.s@sliit.lk",
    href: "mailto:ravi.s@sliit.lk",
  },
  {
    label: "Co-supervisor",
    value: "suriyaa.k@sliit.lk",
    href: "mailto:suriyaa.k@sliit.lk",
  },
] satisfies readonly ContactChannel[];

/**
 * Where the general enquiry form sends its message.
 *
 * All four researchers, comma-separated — a `mailto:` target accepts more
 * than one recipient, so the whole group receives the enquiry.
 */
export const ENQUIRY_ADDRESS =
  "kavithashwinranaweera@gmail.com,345kavindushavinka@gmail.com,vinusha1212@gmail.com,shamindiemalsha@gmail.com";

export const DEPARTMENT_ADDRESS = [
  "Department of Information Technology",
  "Faculty of Computing",
  "Sri Lanka Institute of Information Technology",
  "Matara Campus",
  "Sri Lanka",
] as const;
