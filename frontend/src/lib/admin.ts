import { apiRequestAuth } from "@/lib/api";
import type { ProfessionalRole, UserRole } from "@/lib/auth";

/** Account lifecycle state, mirroring the backend `UserStatus`. */
export type UserStatus = "ACTIVE" | "SUSPENDED";

export type AdminUser = {
  id: number;
  full_name: string;
  email: string;
  contact_number: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  last_login_at: string | null;
};

/** Body of `POST /admin/users` — the role is restricted server-side too. */
export type CreateProfessionalRequest = {
  email: string;
  full_name: string;
  password: string;
  role: ProfessionalRole;
  contact_number?: string | null;
};

export type AdminStats = {
  totalUsers: number;
  registeredClients: number;
  verifiedProfessionals: number;
};

export function computeAdminStats(users: AdminUser[]): AdminStats {
  const registeredClients = users.filter((u) => u.role === "CLIENT").length;
  const verifiedProfessionals = users.filter(
    (u) => u.role !== "CLIENT" && u.role !== "ADMIN"
  ).length;

  return {
    totalUsers: users.length,
    registeredClients,
    verifiedProfessionals,
  };
}

export async function fetchAdminUsers(token: string): Promise<AdminUser[]> {
  const response = await apiRequestAuth<AdminUser[]>("/admin/users", token, {
    method: "GET",
  });
  return response.data ?? [];
}

/**
 * Create a vetted practitioner account.
 *
 * Goes through the admin-only endpoint with the administrator's token. This
 * used to post to the public `/auth/register` with a role in the body, which
 * meant the "admin creates a professional" flow was not actually gated by
 * anything — the same request worked unauthenticated, and `role: "ADMIN"`
 * worked too.
 */
export async function createProfessionalAccount(
  payload: CreateProfessionalRequest,
  token: string
): Promise<AdminUser> {
  const response = await apiRequestAuth<AdminUser>("/admin/users", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data!;
}

/** Suspend or reinstate an account without deleting its history. */
export async function updateUserStatus(
  userId: number,
  status: UserStatus,
  token: string
): Promise<AdminUser> {
  const response = await apiRequestAuth<AdminUser>(
    `/admin/users/${userId}/status`,
    token,
    { method: "PATCH", body: JSON.stringify({ status }) }
  );
  return response.data!;
}

export type CreateProfessionalPayload = {
  full_name: string;
  email: string;
  contact_number: string;
  password: string;
  role: ProfessionalRole;
};

export function toRegisterPayload(
  data: CreateProfessionalPayload
): CreateProfessionalRequest {
  return {
    email: data.email.trim(),
    full_name: data.full_name.trim(),
    password: data.password,
    role: data.role,
    contact_number: data.contact_number.trim() || null,
  };
}
