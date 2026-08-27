import { apiRequest, apiRequestAuth } from "@/lib/api";
import type { ProfessionalRole, RegisterPayload, UserRole } from "@/lib/auth";

export type AdminUser = {
  id: number;
  full_name: string;
  email: string;
  contact_number: string | null;
  role: UserRole;
  created_at: string;
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

export async function createProfessionalAccount(
  payload: RegisterPayload
): Promise<void> {
  await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
): RegisterPayload {
  return {
    email: data.email.trim(),
    full_name: data.full_name.trim(),
    password: data.password,
    role: data.role,
    contact_number: data.contact_number.trim() || null,
  };
}
