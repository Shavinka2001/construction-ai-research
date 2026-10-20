import axios, { AxiosError } from "axios";
import { API_V1, type ApiResponse } from "@/lib/api";
import { handleUnauthorized } from "@/lib/session-guard";

/**
 * What the project is, in the terms the approval requirements are written in.
 * Each settles one or more condition keys for the readiness engine.
 *
 * Every field is optional, and leaving one unset is meaningful: the engine
 * reads it as unknown and reports the requirements that depend on it as manual
 * review, rather than assuming they do not apply.
 */
export type ProjectApprovalAttributes = {
  application_type?: "building_permit" | "coc" | null;
  /** Gates the five-clearance group for non-residential buildings and apartments. */
  building_use?: "residential" | "non_residential" | "apartment" | null;
  tenure_type?: "freehold" | "condominium" | null;
  applicant_type?: "individual" | "organization" | null;
  /** Decides nine of the twelve Certificate of Conformity requirements. */
  development_activity?: "building_construction" | "land_subdivision" | null;
  has_ppc?: boolean | null;
};

export type Project = ProjectApprovalAttributes & {
  id: number;
  name: string;
  description: string | null;
  location_gps: string | null;
  user_id: number;
  created_at: string;
};

export type ProjectCreatePayload = ProjectApprovalAttributes & {
  name: string;
  description?: string | null;
  location_gps?: string | null;
};

export type ProjectUpdatePayload = ProjectApprovalAttributes & {
  name?: string;
  description?: string | null;
  location_gps?: string | null;
};

/** Only the attributes the caller actually set — an omitted key stays unknown. */
function approvalAttributes(
  payload: ProjectApprovalAttributes
): ProjectApprovalAttributes {
  const keys = [
    "application_type",
    "building_use",
    "tenure_type",
    "applicant_type",
    "development_activity",
    "has_ppc",
  ] as const;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out as ProjectApprovalAttributes;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<ApiResponse<unknown>>;
    if (ax.response?.status === 401) handleUnauthorized();
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
        ...approvalAttributes(payload),
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

/** PATCH /api/v1/projects/{id} — update fields of a project the user owns. */
export async function updateProject(
  token: string,
  projectId: number,
  payload: ProjectUpdatePayload
): Promise<Project> {
  try {
    const { data } = await axios.patch<ApiResponse<Project>>(
      `${API_V1}/projects/${projectId}`,
      payload,
      { headers: authHeaders(token) }
    );

    if (!data.success || !data.data) {
      throw new Error(data.message || "Failed to update project");
    }

    return data.data;
  } catch (error) {
    throw new Error(extractErrorMessage(error, "Failed to update project"));
  }
}

/** DELETE /api/v1/projects/{id} — permanently delete a project and its reports. */
export async function deleteProject(
  token: string,
  projectId: number
): Promise<void> {
  try {
    const { data } = await axios.delete<ApiResponse<{ id: number }>>(
      `${API_V1}/projects/${projectId}`,
      { headers: authHeaders(token) }
    );

    if (!data.success) {
      throw new Error(data.message || "Failed to delete project");
    }
  } catch (error) {
    throw new Error(extractErrorMessage(error, "Failed to delete project"));
  }
}
