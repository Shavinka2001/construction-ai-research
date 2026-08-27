import axios, { AxiosError } from "axios";
import { API_V1, type ApiResponse } from "@/lib/api";

export type Project = {
  id: number;
  name: string;
  description: string | null;
  location_gps: string | null;
  user_id: number;
  created_at: string;
};

export type ProjectCreatePayload = {
  name: string;
  description?: string | null;
  location_gps?: string | null;
};

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<ApiResponse<unknown>>;
    const body = ax.response?.data;
    if (body?.message) return body.message;
    if (body?.errors?.[0]?.message) return body.errors[0].message;
    if (ax.message) return ax.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

/** GET /api/v1/projects — list projects for the authenticated user. */
export async function fetchProjects(token: string): Promise<Project[]> {
  try {
    const { data } = await axios.get<ApiResponse<Project[]>>(
      `${API_V1}/projects`,
      { headers: authHeaders(token) }
    );

    if (!data.success) {
      throw new Error(data.message || "Failed to load projects");
    }

    return data.data ?? [];
  } catch (error) {
    throw new Error(extractErrorMessage(error, "Failed to load projects"));
  }
}

/** POST /api/v1/projects — create a project owned by the authenticated user. */
export async function createProject(
  token: string,
  payload: ProjectCreatePayload
): Promise<Project> {
  try {
    const { data } = await axios.post<ApiResponse<Project>>(
      `${API_V1}/projects`,
      {
        name: payload.name,
        description: payload.description ?? null,
        location_gps: payload.location_gps ?? null,
      },
      { headers: authHeaders(token) }
    );

    if (!data.success || !data.data) {
      throw new Error(data.message || "Failed to create project");
    }

    return data.data;
  } catch (error) {
    throw new Error(extractErrorMessage(error, "Failed to create project"));
  }
}
