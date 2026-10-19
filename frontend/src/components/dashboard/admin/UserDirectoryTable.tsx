"use client";

import { AlertCircle, Loader2, Users } from "lucide-react";
import type { AdminUser, UserStatus } from "@/lib/admin";
import type { UserRole } from "@/lib/auth";
import { ROLE_BADGE_STYLES, ROLE_DASHBOARD_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";

type UserDirectoryTableProps = {
  users: AdminUser[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Suspend or reinstate a row. Omit to render the table read-only. */
  onStatusChange?: (user: AdminUser, next: UserStatus) => void;
  /** Row currently awaiting its status request, so only it shows a spinner. */
  pendingUserId?: number | null;
  /** The signed-in administrator, who may not suspend their own account. */
  currentUserEmail?: string;
  /** Shown instead of the generic empty state when filters excluded everyone. */
  filtered?: boolean;
};

function RoleBadge({ role }: { role: UserRole }) {
  const label =
    ROLE_DASHBOARD_LABELS[role] ?? role.replace(/_/g, " ").toLowerCase();

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

/**
 * The account's real status.
 *
 * This used to take no arguments and render a pulsing green "Active" for every
 * row, so a suspended account was indistinguishable from a working one — the
 * table asserted something it had never checked.
 */
function StatusBadge({ status }: { status: UserStatus }) {
  if (status === "SUSPENDED") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        Suspended
      </span>
    );
  }

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

function formatLastLogin(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return date.toLocaleDateString();
}

export function UserDirectoryTable({
  users,
  loading,
  error,
  onRetry,
  onStatusChange,
  pendingUserId,
  currentUserEmail,
  filtered,
}: UserDirectoryTableProps) {
  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-slate-100 bg-white">
        <Loader2
          className="h-8 w-8 animate-spin text-gold"
          aria-label="Loading users"
        />
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
            className="min-h-[44px] rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-gold hover:text-gold"
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
        <p className="text-sm font-medium text-slate-700">
          {filtered ? "No users match these filters" : "No users yet"}
        </p>
        <p className="text-xs text-slate-500">
          {filtered
            ? "Try a different search term, role or status."
            : "Create a professional account to populate the directory."}
        </p>
      </div>
    );
  }

  const showActions = Boolean(onStatusChange);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <caption className="sr-only">
            Registered platform accounts with role, status and last sign-in
          </caption>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              {[
                "Full Name",
                "Email",
                "Contact Number",
                "Assigned Role",
                "Status",
                "Last Sign-In",
              ].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  {heading}
                </th>
              ))}
              {showActions && (
                <th scope="col" className="px-5 py-3.5 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => {
              const isSelf = Boolean(
                currentUserEmail &&
                  user.email.toLowerCase() === currentUserEmail.toLowerCase()
              );
              const isPending = pendingUserId === user.id;
              const nextStatus: UserStatus =
                user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

              return (
                <tr
                  key={user.id}
                  className={cn(
                    "transition-colors hover:bg-slate-50/60",
                    user.status === "SUSPENDED" && "bg-amber-50/40"
                  )}
                >
                  <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">
                    {user.full_name}
                    {isSelf && (
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        (you)
                      </span>
                    )}
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
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                    {formatLastLogin(user.last_login_at)}
                  </td>
                  {showActions && (
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <button
                        type="button"
                        // Suspending your own account would lock you out with
                        // nobody able to undo it, so the server refuses it too.
                        disabled={isSelf || isPending}
                        onClick={() => onStatusChange?.(user, nextStatus)}
                        title={
                          isSelf
                            ? "You cannot suspend your own account"
                            : undefined
                        }
                        className={cn(
                          "inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                          isSelf || isPending
                            ? "cursor-not-allowed border-slate-200 text-slate-300"
                            : user.status === "ACTIVE"
                              ? "border-amber-200 text-amber-800 hover:bg-amber-50"
                              : "border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                        )}
                      >
                        {isPending && (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        )}
                        {user.status === "ACTIVE" ? "Suspend" : "Reinstate"}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
