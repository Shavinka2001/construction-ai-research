"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";
import type { AuthUser, UserRole } from "@/lib/auth";
import {
  createProfessionalAccount,
  fetchAdminStats,
  fetchAdminUsers,
  toRegisterPayload,
  updateUserStatus,
  type AdminStats,
  type AdminUser,
  type UserDirectoryPage,
  type UserStatus,
} from "@/lib/admin";
import { ApiRequestError } from "@/lib/api";
import {
  CreateProfessionalModal,
  type CreateProfessionalFormData,
} from "@/components/dashboard/admin/CreateProfessionalModal";
import { UserDirectoryTable } from "@/components/dashboard/admin/UserDirectoryTable";
import { cn } from "@/lib/utils";

type AdminDashboardProps = {
  user: AuthUser;
};

const PAGE_SIZE = 10;

const ROLE_FILTERS: Array<{ value: UserRole | ""; label: string }> = [
  { value: "", label: "All roles" },
  { value: "CLIENT", label: "Clients" },
  { value: "SURVEYOR", label: "Surveyors" },
  { value: "ARCHITECT", label: "Architects" },
  { value: "QUANTITY_SURVEYOR", label: "Quantity Surveyors" },
  { value: "AUTHORITY", label: "Authority Officers" },
  { value: "ADMIN", label: "Administrators" },
];

const STATUS_FILTERS: Array<{ value: UserStatus | ""; label: string }> = [
  { value: "", label: "Any status" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
];

type PendingStatusChange = { user: AdminUser; next: UserStatus };

export function AdminDashboard({ user }: AdminDashboardProps) {
  const [page, setPage] = useState<UserDirectoryPage | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("");
  const [pageNumber, setPageNumber] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [pendingChange, setPendingChange] = useState<PendingStatusChange | null>(
    null
  );
  const [statusPendingId, setStatusPendingId] = useState<number | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Typing a search term should not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Any change to the filters invalidates the current page number.
  useEffect(() => {
    setPageNumber(1);
  }, [debouncedSearch, roleFilter, statusFilter]);

  const loadDirectory = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      // Totals come from the server, not from the rows on this page — the
      // directory is paged, so counting what is in hand would report the page
      // size as the platform size.
      const [directory, totals] = await Promise.all([
        fetchAdminUsers(user.token, {
          q: debouncedSearch,
          role: roleFilter,
          status: statusFilter,
          page: pageNumber,
          size: PAGE_SIZE,
        }),
        fetchAdminStats(user.token),
      ]);
      setPage(directory);
      setStats(totals);
    } catch (err) {
      // No placeholder numbers: showing an invented total next to a failed
      // request is worse than showing nothing, because it reads as real.
      setPage(null);
      setStats(null);
      setUsersError(
        err instanceof ApiRequestError
          ? err.message
          : "Could not reach the admin API. Check that the backend is running."
      );
    } finally {
      setUsersLoading(false);
    }
  }, [user.token, debouncedSearch, roleFilter, statusFilter, pageNumber]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  const handleCreateProfessional = async (data: CreateProfessionalFormData) => {
    setSubmitError(null);

    if (!data.role) {
      setSubmitError("Please select a professional role.");
      return;
    }
    if (data.password.length < 8) {
      setSubmitError("Password must be at least 8 characters.");
      return;
    }

    setSubmitLoading(true);
    try {
      await createProfessionalAccount(
        toRegisterPayload({
          full_name: data.full_name,
          email: data.email,
          contact_number: data.contact_number,
          password: data.password,
          role: data.role,
        }),
        user.token
      );
      setModalOpen(false);
      await loadDirectory();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        const details = err.errors.map((e) => e.message).join(". ");
        setSubmitError(details || err.message);
      } else {
        setSubmitError("Failed to create account. Please try again.");
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!pendingChange) return;
    const { user: target, next } = pendingChange;

    setStatusError(null);
    setStatusPendingId(target.id);
    setPendingChange(null);
    try {
      await updateUserStatus(target.id, next, user.token);
      await loadDirectory();
    } catch (err) {
      setStatusError(
        err instanceof ApiRequestError
          ? err.errors.map((e) => e.message).join(". ") || err.message
          : `Could not ${next === "SUSPENDED" ? "suspend" : "reinstate"} the account.`
      );
    } finally {
      setStatusPendingId(null);
    }
  };

  const statCards = useMemo(
    () => [
      {
        label: "Total Users",
        value: stats?.totalUsers,
        sub:
          stats && stats.suspendedUsers > 0
            ? `${stats.activeUsers} active · ${stats.suspendedUsers} suspended`
            : "all active",
        icon: Users,
      },
      {
        label: "Registered Clients",
        value: stats?.clients,
        sub: "land owners",
        icon: UserCheck,
      },
      {
        label: "Verified Professionals",
        value: stats?.professionals,
        sub: "surveyors, architects, QSs, officers",
        icon: Briefcase,
      },
    ],
    [stats]
  );

  const hasFilters = Boolean(debouncedSearch || roleFilter || statusFilter);
  const totalPages = page?.totalPages ?? 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Admin Control Center
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            User Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create professional accounts, and suspend or reinstate access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSubmitError(null);
            setModalOpen(true);
          }}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 self-start rounded-xl border-2 border-transparent bg-brand-primary px-5 text-sm font-semibold text-white transition-all duration-300 hover:border-gold hover:shadow-[0_0_0_1px_#D4AF37,0_4px_20px_-4px_rgba(212,175,55,0.35)]"
        >
          <Plus className="h-4 w-4 text-gold" aria-hidden />
          Create Professional Account
        </button>
      </div>

      {/* Overview cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury transition-shadow hover:shadow-luxury-lg sm:p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {card.label}
                  </p>
                  {card.value === undefined ? (
                    <p
                      className="mt-2 text-3xl font-bold text-slate-300"
                      aria-label="Unavailable"
                    >
                      —
                    </p>
                  ) : (
                    <p className="mt-2 text-3xl font-bold text-slate-900">
                      {card.value}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    {card.value === undefined ? "unavailable" : card.sub}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10">
                  <Icon className="h-5 w-5 text-gold" aria-hidden />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* User directory */}
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">User Directory</h2>
            <p className="text-sm text-slate-500">
              {page
                ? `${page.total} account${page.total === 1 ? "" : "s"}${
                    hasFilters ? " matching your filters" : ""
                  }`
                : "All registered platform accounts"}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email"
                aria-label="Search users by name or email"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold sm:w-56"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | "")}
              aria-label="Filter by role"
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            >
              {ROLE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as UserStatus | "")}
              aria-label="Filter by account status"
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {statusError && (
          <p
            role="alert"
            className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {statusError}
          </p>
        )}

        <UserDirectoryTable
          users={page?.items ?? []}
          loading={usersLoading}
          error={usersError}
          onRetry={loadDirectory}
          onStatusChange={(target, next) =>
            setPendingChange({ user: target, next })
          }
          pendingUserId={statusPendingId}
          currentUserEmail={user.email}
          filtered={hasFilters}
        />

        {totalPages > 1 && (
          <nav
            aria-label="Directory pages"
            className="mt-4 flex items-center justify-between"
          >
            <button
              type="button"
              onClick={() => setPageNumber((n) => Math.max(1, n - 1))}
              disabled={pageNumber <= 1 || usersLoading}
              className={cn(
                "inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors",
                pageNumber <= 1 || usersLoading
                  ? "cursor-not-allowed border-slate-200 text-slate-300"
                  : "border-slate-200 text-slate-700 hover:border-gold hover:text-gold"
              )}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Previous
            </button>
            <p className="text-sm text-slate-500" aria-live="polite">
              Page {page?.page ?? pageNumber} of {totalPages}
            </p>
            <button
              type="button"
              onClick={() => setPageNumber((n) => Math.min(totalPages, n + 1))}
              disabled={pageNumber >= totalPages || usersLoading}
              className={cn(
                "inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors",
                pageNumber >= totalPages || usersLoading
                  ? "cursor-not-allowed border-slate-200 text-slate-300"
                  : "border-slate-200 text-slate-700 hover:border-gold hover:text-gold"
              )}
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </nav>
        )}
      </section>

      <CreateProfessionalModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreateProfessional}
        loading={submitLoading}
        error={submitError}
      />

      {/* Status change confirmation — suspension cuts off someone's access, so
          it is not a single-click action. */}
      {pendingChange && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-dialog-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3
              id="status-dialog-title"
              className="text-lg font-bold text-slate-900"
            >
              {pendingChange.next === "SUSPENDED"
                ? "Suspend this account?"
                : "Reinstate this account?"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {pendingChange.next === "SUSPENDED" ? (
                <>
                  <span className="font-semibold">
                    {pendingChange.user.full_name}
                  </span>{" "}
                  will be signed out of new sessions and cannot sign in again
                  until reinstated. Their projects, reports and uploaded
                  blueprints are kept.
                </>
              ) : (
                <>
                  <span className="font-semibold">
                    {pendingChange.user.full_name}
                  </span>{" "}
                  will be able to sign in again immediately.
                </>
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingChange(null)}
                className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStatusChange}
                className={cn(
                  "min-h-[44px] rounded-xl px-4 text-sm font-semibold text-white",
                  pendingChange.next === "SUSPENDED"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                {pendingChange.next === "SUSPENDED" ? "Suspend" : "Reinstate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
