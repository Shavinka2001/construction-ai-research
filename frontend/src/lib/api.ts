export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

export const API_V1 = `${API_BASE_URL}/api/v1`;

export type ApiErrorDetail = {
  code: string;
  message: string;
  field?: string | null;
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T | null;
  errors: ApiErrorDetail[] | null;
};

export class ApiRequestError extends Error {
  status: number;
  errors: ApiErrorDetail[];

  constructor(
    message: string,
    status: number,
    errors: ApiErrorDetail[] = []
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.errors = errors;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_V1}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !body.success) {
    throw new ApiRequestError(
      body.message || "Request failed",
      response.status,
      body.errors ?? []
    );
  }

  return body;
}

export async function apiRequestAuth<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  return apiRequest<T>(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}
