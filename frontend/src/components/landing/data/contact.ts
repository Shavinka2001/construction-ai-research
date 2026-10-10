import type { ContactChannel } from "@/components/landing/types";

/*
 * ===========================================================================
 *  >>> PLACEHOLDER DATA — replace with the group's real contact details. <<<
 * ===========================================================================
 */

export const GENERAL_CONTACTS: readonly ContactChannel[] = [
  {
    label: "Group e-mail",
    value: "group@example.com",
    href: "mailto:group@example.com",
  },
  {
    label: "Group leader",
    value: "+94 00 000 0000",
    href: "tel:+940000000000",
  },
  {
    label: "Supervisor",
    value: "supervisor@example.com",
    href: "mailto:supervisor@example.com",
  },
] satisfies readonly ContactChannel[];

/** Where the general enquiry form sends its message. */
export const ENQUIRY_ADDRESS = "group@example.com";

export const DEPARTMENT_ADDRESS = [
  "Department of Information Technology",
  "Faculty of Computing",
  "University Name",
  "Sri Lanka",
] as const;
