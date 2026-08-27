import {
  LayoutDashboard,
  MapPinned,
  ShieldCheck,
  Calculator,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  shortLabel?: string;
  description?: string;
};

export const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    shortLabel: "Home",
    description: "Portal overview",
  },
  {
    label: "Site Feasibility",
    href: "/site-feasibility",
    icon: MapPinned,
    shortLabel: "Site",
    description: "Terrain & zoning analysis",
  },
  {
    label: "Regulatory Checker",
    href: "/regulatory-checker",
    icon: ShieldCheck,
    shortLabel: "Regulatory",
    description: "Permits & compliance",
  },
  {
    label: "Cost & Estimation",
    href: "/cost-estimation",
    icon: Calculator,
    shortLabel: "Cost",
    description: "Budget forecasting",
  },
];

export const brand = {
  name: "Construction AI",
  tagline: "Intelligent Pre-Construction",
};
