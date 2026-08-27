"use client";

import { Users, Loader2, AlertCircle } from "lucide-react";
import type { AdminUser } from "@/lib/admin";
import type { UserRole } from "@/lib/auth";
import { ROLE_BADGE_STYLES, ROLE_DASHBOARD_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";

type UserDirectoryTableProps = {
  users: AdminUser[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

function RoleBadge({ role }: { role: UserRole }) {
  const label =
    ROLE_DASHBOARD_LABELS[role] ??
    role.replace(/_/g, " ").toLowerCase();

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        ROLE_BADGE_STYLES[role] ?? ROLE_BADGE_STYLES.CLIENT
      )}
    >
      {label}
    </span>
  );
}

function StatusBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Active
    </span>
  );
}

export function UserDirectoryTable({
  users,
  loading,
  error,
  onRetry,
}: UserDirectoryTableProps) {
  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-slate-100 bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gold" aria-label="Loading users" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-white p-8 text-center">
        <AlertCircle className="h-8 w-8 text-slate-400" />
        <p className="text-sm text-slate-600">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-gold hover:text-gold"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white p-8 text-center">
        <Users className="h-8 w-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-700">No users found</p>
        <p className="text-xs text-slate-500">
          Create a professional account to populate the directory.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Full Name
              </th>
              <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Email
              </th>
              <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Contact Number
              </th>
              <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Assigned Role
              </th>
              <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr
                key={user.id}
                className="transition-colors hover:bg-slate-50/60"
              >
                <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">
                  {user.full_name}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                  {user.email}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                  {user.contact_number || "—"}
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <RoleBadge role={user.role} />
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <StatusBadge />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
