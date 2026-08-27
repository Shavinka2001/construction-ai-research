"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ClientDashboard } from "@/components/dashboard/client/ClientDashboard";
import { AdminDashboard } from "@/components/dashboard/admin/AdminDashboard";
import { ArchitectDashboard } from "@/components/dashboard/architect/ArchitectDashboard";
import { SurveyorDashboard } from "@/components/dashboard/surveyor/SurveyorDashboard";
import { QuantitySurveyorDashboard } from "@/components/dashboard/quantity-surveyor/QuantitySurveyorDashboard";
import { AuthorityDashboard } from "@/components/dashboard/authority/AuthorityDashboard";
import { getAuthSession, type AuthUser, type UserRole } from "@/lib/auth";
import { getRoleLabel } from "@/lib/roles";

function DashboardSkeleton() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2
        className="h-8 w-8 animate-spin text-gold"
        aria-label="Loading dashboard"
      />
    </div>
  );
}

function RolePlaceholder({ role }: { role: UserRole }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-luxury">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
        Coming Soon
      </p>
      <h2 className="mt-3 text-2xl font-bold text-slate-900">
        {getRoleLabel(role)} Dashboard
      </h2>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        A tailored workspace for {getRoleLabel(role).toLowerCase()} professionals
        is under development.
      </p>
    </div>
  );
}

function DashboardRouter({ user }: { user: AuthUser }) {
  const role = user.role ?? "CLIENT";

  switch (role) {
    case "CLIENT":
      return <ClientDashboard user={user} />;
    case "ADMIN":
      return <AdminDashboard user={user} />;
    case "ARCHITECT":
      return <ArchitectDashboard user={user} />;
    case "SURVEYOR":
      return <SurveyorDashboard user={user} />;
    case "QUANTITY_SURVEYOR":
      return <QuantitySurveyorDashboard user={user} />;
    case "AUTHORITY":
      return <AuthorityDashboard user={user} />;
    default:
      return <RolePlaceholder role={role} />;
  }
}

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getAuthSession();
    if (session) {
      setUser({ ...session, role: session.role ?? "CLIENT" });
    }
    setLoading(false);
  }, []);

  if (loading || !user) {
    return <DashboardSkeleton />;
  }

  return <DashboardRouter user={user} />;
}
