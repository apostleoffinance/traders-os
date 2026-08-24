const TOKEN_KEY = "traderos.access";
const REFRESH_KEY = "traderos.refresh";
const USER_KEY = "traderos.user";
const ACCOUNT_KEY = "traderos.account";

export function apiBase(): string {
  if (typeof window !== "undefined") return "";
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(REFRESH_KEY);
}

export function setSession(access: string, refresh: string, userJson?: string): void {
  sessionStorage.setItem(TOKEN_KEY, access);
  sessionStorage.setItem(REFRESH_KEY, refresh);
  if (userJson) sessionStorage.setItem(USER_KEY, userJson);
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function getStoredUser(): unknown | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user: unknown): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getActiveAccountId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCOUNT_KEY);
}

export function setActiveAccountId(id: string): void {
  localStorage.setItem(ACCOUNT_KEY, id);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(
      typeof body === "object" && body && "message" in body
        ? String((body as { message: string }).message)
        : typeof body === "object" && body && "detail" in body
          ? String((body as { detail: unknown }).detail)
          : `HTTP ${status}`,
    );
    this.status = status;
    this.body = body;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, { message: "Cannot reach the API. Confirm the backend is running on port 8000." });
  }
  if (res.status === 401 && getRefreshToken() && !path.includes("/auth/refresh")) {
    let refreshed: Response;
    try {
      refreshed = await fetch(`${apiBase()}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: getRefreshToken() }),
      });
    } catch {
      throw new ApiError(0, { message: "Cannot reach the API. Confirm the backend is running on port 8000." });
    }
    if (refreshed.ok) {
      const data = (await refreshed.json()) as { access_token: string; refresh_token: string; user: unknown };
      setSession(data.access_token, data.refresh_token, JSON.stringify(data.user));
      headers.set("Authorization", `Bearer ${data.access_token}`);
      try {
        const retry = await fetch(`${apiBase()}${path}`, { ...init, headers });
        return parse<T>(retry);
      } catch {
        throw new ApiError(0, { message: "Cannot reach the API. Confirm the backend is running on port 8000." });
      }
    }
    clearSession();
    if (typeof window !== "undefined") window.location.href = "/login";
  }
  return parse<T>(res);
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text.trim() || `HTTP ${res.status}` };
    }
  }
  if (!res.ok) {
    throw new ApiError(res.status, body ?? { message: `HTTP ${res.status}` });
  }
  return body as T;
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  let refreshed: Response;
  try {
    refreshed = await fetch(`${apiBase()}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
  } catch {
    return null;
  }
  if (!refreshed.ok) {
    clearSession();
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }
  const data = (await refreshed.json()) as { access_token: string; refresh_token: string; user: unknown };
  setSession(data.access_token, data.refresh_token, JSON.stringify(data.user));
  return data.access_token;
}

export async function fetchMediaBlob(url: string): Promise<string> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${apiBase()}${url}`, { headers });
  } catch {
    throw new Error("Cannot reach the API. Confirm the backend is running on port 8000.");
  }

  if (res.status === 401 && getRefreshToken()) {
    const next = await refreshAccessToken();
    if (next) {
      headers.Authorization = `Bearer ${next}`;
      try {
        res = await fetch(`${apiBase()}${url}`, { headers });
      } catch {
        throw new Error("Cannot reach the API. Confirm the backend is running on port 8000.");
      }
    }
  }

  if (!res.ok) {
    if (res.status === 404) {
      let detail = "Image file is missing. Re-upload from Edit trade.";
      try {
        const body = (await res.json()) as { detail?: string };
        if (typeof body?.detail === "string" && body.detail.trim()) detail = body.detail;
      } catch {
        /* ignore */
      }
      const err = new Error(detail) as Error & { code?: string };
      err.code = "media_missing";
      throw err;
    }
    throw new Error("Unable to load image");
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
