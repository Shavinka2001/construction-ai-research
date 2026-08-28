import { apiRequest } from "@/lib/api";
import {
  AUTH_STORAGE_KEY,
  clearStoredSession,
  isTokenExpired,
} from "@/lib/session-guard";

export type UserRole =
  | "CLIENT"
  | "SURVEYOR"
  | "ARCHITECT"
  | "QUANTITY_SURVEYOR"
  | "AUTHORITY"
  | "ADMIN";

export type ProfessionalRole = Exclude<UserRole, "CLIENT" | "ADMIN">;

export type AuthUser = {
  token: string;
  tokenType: string;
  role: UserRole;
  email?: string;
  fullName?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  full_name: string;
  password: string;
  role: UserRole;
  contact_number?: string | null;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  role: UserRole;
};

export type RegisterResponse = {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  contact_number: string | null;
  created_at: string;
};

export function getDisplayName(user: AuthUser): string {
  if (user.fullName?.trim()) return user.fullName.trim();
  if (user.email) {
    const local = user.email.split("@")[0];
    return local
      .replace(/[._-]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return "Client";
}

export function saveAuthSession(user: AuthUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function getAuthSession(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as AuthUser;
    if (!user?.token || isTokenExpired(user.token)) {
      clearStoredSession();
      return null;
    }
    return user;
  } catch {
    clearStoredSession();
    return null;
  }
}

export function clearAuthSession(): void {
  clearStoredSession();
}

export async function loginUser(payload: LoginPayload): Promise<AuthUser> {
  const response = await apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const user: AuthUser = {
    token: response.data!.access_token,
    tokenType: response.data!.token_type,
    role: response.data!.role,
    email: payload.email,
  };

  saveAuthSession(user);
  return user;
}

export async function registerUser(payload: RegisterPayload): Promise<RegisterResponse> {
  const response = await apiRequest<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data!;
}
