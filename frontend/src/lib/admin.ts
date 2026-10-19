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

/**
 * Platform-wide account totals.
 *
 * Served by `/admin/stats` rather than counted from a directory response: the
 * directory is paged, so counting the rows in hand would report the size of
 * the current page as the size of the platform.
 */
export type AdminStats = {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  clients: number;
  professionals: number;
  admins: number;
};

export type UserDirectoryQuery = {
  q?: string;
  role?: UserRole | "";
  status?: UserStatus | "";
  page?: number;
  size?: number;
};

export type UserDirectoryPage = {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function fetchAdminStats(token: string): Promise<AdminStats> {
  const response = await apiRequestAuth<{
    total_users: number;
    active_users: number;
    suspended_users: number;
    clients: number;
    professionals: number;
    admins: number;
  }>("/admin/stats", token, { method: "GET" });

  const data = response.data!;
  return {
    totalUsers: data.total_users,
    activeUsers: data.active_users,
    suspendedUsers: data.suspended_users,
    clients: data.clients,
    professionals: data.professionals,
    admins: data.admins,
  };
}

export async function fetchAdminUsers(
  token: string,
  query: UserDirectoryQuery = {}
): Promise<UserDirectoryPage> {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.role) params.set("role", query.role);
  if (query.status) params.set("status", query.status);
  params.set("page", String(query.page ?? 1));
  params.set("size", String(query.size ?? 25));

  const response = await apiRequestAuth<{
    items: AdminUser[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }>(`/admin/users?${params.toString()}`, token, { method: "GET" });

  const data = response.data!;
  return {
    items: data.items ?? [],
    total: data.total,
    page: data.page,
    pageSize: data.page_size,
    totalPages: data.total_pages,
  };
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
