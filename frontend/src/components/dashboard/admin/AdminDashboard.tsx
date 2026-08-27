"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Users, UserCheck, Briefcase } from "lucide-react";
import type { AuthUser } from "@/lib/auth";
import {
  computeAdminStats,
  createProfessionalAccount,
  fetchAdminUsers,
  toRegisterPayload,
  type AdminUser,
} from "@/lib/admin";
import { ApiRequestError } from "@/lib/api";
import {
  CreateProfessionalModal,
  type CreateProfessionalFormData,
} from "@/components/dashboard/admin/CreateProfessionalModal";
import { UserDirectoryTable } from "@/components/dashboard/admin/UserDirectoryTable";

type AdminDashboardProps = {
  user: AuthUser;
};

const MOCK_STATS = {
  totalUsers: 148,
  registeredClients: 112,
  verifiedProfessionals: 36,
};

export function AdminDashboard({ user }: AdminDashboardProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const data = await fetchAdminUsers(user.token);
      setUsers(data);
    } catch {
      setUsersError(
        "Unable to load users. The admin API may not be available yet — showing overview placeholders."
      );
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [user.token]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const stats =
    users.length > 0 ? computeAdminStats(users) : MOCK_STATS;

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
        })
      );
      setModalOpen(false);
      await loadUsers();
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

  const statCards = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      sub: "active users",
      icon: Users,
    },
    {
      label: "Registered Clients",
      value: stats.registeredClients,
      sub: "land owners",
      icon: UserCheck,
    },
    {
      label: "Verified Professionals",
      value: stats.verifiedProfessionals,
      sub: "architects & surveyors",
      icon: Briefcase,
    },
  ];

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
            Create professional accounts and monitor platform users.
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
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {card.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{card.sub}</p>
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
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">User Directory</h2>
            <p className="text-sm text-slate-500">
              All registered platform accounts
            </p>
          </div>
        </div>
        <UserDirectoryTable
          users={users}
          loading={usersLoading}
          error={usersError}
          onRetry={loadUsers}
        />
      </section>

      <CreateProfessionalModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreateProfessional}
        loading={submitLoading}
        error={submitError}
      />
    </div>
  );
}
