import {
  User,
  Compass,
  PenTool,
  Calculator,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/lib/auth";

export type RoleOption = {
  value: UserRole;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const ROLE_OPTIONS: RoleOption[] = [
  {
    value: "CLIENT",
    label: "Client / Land Owner",
    description:
      "Submit site plans, track feasibility scores, and make informed go/no-go decisions for your property.",
    icon: User,
  },
  {
    value: "SURVEYOR",
    label: "Land Surveyor",
    description:
      "Upload survey data, validate terrain measurements, and contribute geospatial intelligence to projects.",
    icon: Compass,
  },
  {
    value: "ARCHITECT",
    label: "Architect",
    description:
      "Design and review blueprints, coordinate specifications, and align creative vision with compliance.",
    icon: PenTool,
  },
  {
    value: "QUANTITY_SURVEYOR",
    label: "Quantity Surveyor",
    description:
      "Manage BOQs, cost estimates, and dynamic budget forecasting across the project lifecycle.",
    icon: Calculator,
  },
  {
    value: "AUTHORITY",
    label: "Municipal Authority Officer",
    description:
      "Review compliance submissions, verify regulatory adherence, and process municipal approvals.",
    icon: Landmark,
  },
];

export const AUTH_STATS = [
  { value: "99%", label: "AI Dimensional Accuracy" },
  { value: "Instant", label: "Local Authority Checks" },
  { value: "Dynamic", label: "CPM Schedules" },
] as const;

export const ROLE_DASHBOARD_LABELS: Record<UserRole, string> = {
  CLIENT: "Property Owner",
  SURVEYOR: "Land Surveyor",
  ARCHITECT: "Architect",
  QUANTITY_SURVEYOR: "Quantity Surveyor",
  AUTHORITY: "Municipal Authority",
  ADMIN: "Administrator",
};

export const PROFESSIONAL_ROLE_OPTIONS = ROLE_OPTIONS.filter(
  (role) =>
    role.value !== "CLIENT" &&
    role.value !== "ADMIN"
) as Array<RoleOption & { value: import("@/lib/auth").ProfessionalRole }>;

export const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  CLIENT: "bg-slate-100 text-slate-700 border border-slate-200",
  SURVEYOR: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  ARCHITECT: "bg-violet-50 text-violet-700 border border-violet-200",
  QUANTITY_SURVEYOR: "bg-amber-50 text-amber-800 border border-amber-200",
  AUTHORITY: "bg-rose-50 text-rose-700 border border-rose-200",
  ADMIN: "bg-[#D4AF37]/10 text-[#B8942E] border border-[#D4AF37]/30",
};

export function getRoleLabel(role: UserRole): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}
