import type { ContactChannel } from "@/components/landing/types";

/*
 * ===========================================================================
 *  Contact details.
 *
 *  The group has no shared mailbox, so general enquiries go to the group
 *  leader and are passed on from there. The per-member addresses are listed
 *  separately on the Contact page, read from `data/team.ts`.
 * ===========================================================================
 */

export const GENERAL_CONTACTS: readonly ContactChannel[] = [
  {
    label: "Group e-mail",
    value: "345kavindushavinka@gmail.com",
    href: "mailto:345kavindushavinka@gmail.com",
  },
  {
    label: "Telephone",
    value: "+94 71 976 9164",
    href: "tel:+94719769164",
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

/** Where the general enquiry form sends its message. */
export const ENQUIRY_ADDRESS = "345kavindushavinka@gmail.com";

export const DEPARTMENT_ADDRESS = [
  "Department of Information Technology",
  "Faculty of Computing",
  "Sri Lanka Institute of Information Technology",
  "Matara Campus",
  "Sri Lanka",
] as const;
