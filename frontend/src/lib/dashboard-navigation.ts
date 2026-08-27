import {
  LayoutDashboard,
  Map,
  ShieldCheck,
  Wallet,
  Users,
  DollarSign,
  Scale,
  Globe,
  Activity,
  FileText,
  Layers,
  Calculator,
  Calendar,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/lib/auth";

export type DashboardNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const ADMIN_NAV: DashboardNavItem[] = [
  { label: "User Management", href: "/dashboard", icon: Users },
  { label: "Global Rates", href: "/dashboard/global-rates", icon: DollarSign },
  { label: "Zoning Laws", href: "/dashboard/zoning-laws", icon: Scale },
];

const CLIENT_NAV: DashboardNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Site Feasibility", href: "/dashboard/site-feasibility", icon: Map },
  {
    label: "Regulatory Checker",
    href: "/dashboard/regulatory-checker",
    icon: ShieldCheck,
  },
  {
    label: "Cost & Estimation",
    href: "/dashboard/cost-estimation",
    icon: Wallet,
  },
];

const SURVEYOR_NAV: DashboardNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "GIS Mapping", href: "/dashboard/gis-mapping", icon: Globe },
  { label: "Topography", href: "/dashboard/topography", icon: Activity },
];

const ARCHITECT_NAV: DashboardNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Blueprint Parser",
    href: "/dashboard/blueprint-parser",
    icon: FileText,
  },
  {
    label: "Clash Detection",
    href: "/dashboard/clash-detection",
    icon: Layers,
  },
];

const QUANTITY_SURVEYOR_NAV: DashboardNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Material Take-off",
    href: "/dashboard/material-takeoff",
    icon: Calculator,
  },
  {
    label: "Project Schedule",
    href: "/dashboard/project-schedule",
    icon: Calendar,
  },
];

const AUTHORITY_NAV: DashboardNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Regulatory Checker",
    href: "/dashboard/regulatory-checker",
    icon: ShieldCheck,
  },
];

const ROLE_NAV_MAP: Record<UserRole, DashboardNavItem[]> = {
  ADMIN: ADMIN_NAV,
  CLIENT: CLIENT_NAV,
  SURVEYOR: SURVEYOR_NAV,
  ARCHITECT: ARCHITECT_NAV,
  QUANTITY_SURVEYOR: QUANTITY_SURVEYOR_NAV,
  AUTHORITY: AUTHORITY_NAV,
};

export function getDashboardNavItems(role: UserRole): DashboardNavItem[] {
  return ROLE_NAV_MAP[role] ?? CLIENT_NAV;
}

export function isDashboardNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
