/**
 * Session-expiry handling, kept dependency-free so every API layer can import
 * it without creating an import cycle with `@/lib/auth` / `@/lib/api`.
 */

export const AUTH_STORAGE_KEY = "construction_ai_auth";

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    /* private mode / storage disabled */
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    return JSON.parse(atob(b64 + pad)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** True only when the JWT carries an `exp` claim that is already in the past. */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return false; // can't tell — let the server decide
  return Date.now() >= payload.exp * 1000 - 5_000; // 5s clock-skew margin
}

let redirecting = false;

/**
 * Called when an authenticated request comes back 401: drop the dead token and
 * send the user to the login screen instead of leaving a half-broken page that
 * keeps firing failed requests.
 */
export function handleUnauthorized(): void {
  if (typeof window === "undefined" || redirecting) return;
  let hadSession = false;
  try {
    hadSession = !!localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    /* storage disabled */
  }
  clearStoredSession();
  if (!hadSession) return; // anonymous request — nothing to recover from
  const path = window.location.pathname;
  if (path === "/login" || path === "/register") return;
  redirecting = true;
  window.location.assign("/login?session=expired");
}
