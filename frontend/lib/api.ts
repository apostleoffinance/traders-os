const TOKEN_KEY = "traderos.access";
const REFRESH_KEY = "traderos.refresh";
const USER_KEY = "traderos.user";
const ACCOUNT_KEY = "traderos.account";
const REFRESH_BUFFER_SEC = 5 * 60;

function authStore(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function migrateSessionStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of [TOKEN_KEY, REFRESH_KEY, USER_KEY]) {
    const legacy = sessionStorage.getItem(key);
    if (legacy && !localStorage.getItem(key)) {
      localStorage.setItem(key, legacy);
    }
    sessionStorage.removeItem(key);
  }
}

function notifySessionChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("traderos-session"));
}

export function apiBase(): string {
  if (typeof window !== "undefined") return "";
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
}

export function getAccessToken(): string | null {
  const store = authStore();
  if (!store) return null;
  migrateSessionStorage();
  return store.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  const store = authStore();
  if (!store) return null;
  migrateSessionStorage();
  return store.getItem(REFRESH_KEY);
}

export function hasSession(): boolean {
  return Boolean(getAccessToken() || getRefreshToken());
}

export function setSession(access: string, refresh: string, userJson?: string): void {
  const store = authStore();
  if (!store) return;
  store.setItem(TOKEN_KEY, access);
  store.setItem(REFRESH_KEY, refresh);
  if (userJson) store.setItem(USER_KEY, userJson);
  notifySessionChange();
}

export function clearSession(): void {
  const store = authStore();
  if (!store) return;
  store.removeItem(TOKEN_KEY);
  store.removeItem(REFRESH_KEY);
  store.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(USER_KEY);
  notifySessionChange();
}

export function getStoredUser(): unknown | null {
  const store = authStore();
  if (!store) return null;
  migrateSessionStorage();
  const raw = store.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user: unknown): void {
  const store = authStore();
  if (!store) return;
  store.setItem(USER_KEY, JSON.stringify(user));
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

export class AuthError extends Error {
  constructor(message = "Session expired. Sign in again.") {
    super(message);
    this.name = "AuthError";
  }
}

export function isAuthFailure(err: unknown): boolean {
  return err instanceof AuthError || (err instanceof ApiError && err.status === 401);
}

function jwtExp(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

function accessTokenFresh(token: string): boolean {
  const exp = jwtExp(token);
  if (!exp) return false;
  return exp - Math.floor(Date.now() / 1000) > REFRESH_BUFFER_SEC;
}

async function refreshAccessToken(): Promise<string> {
  const refresh = getRefreshToken();
  if (!refresh) {
    clearSession();
    throw new AuthError();
  }
  let refreshed: Response;
  try {
    refreshed = await fetch(`${apiBase()}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
  } catch {
    throw new ApiError(0, { message: "Cannot reach the API. Confirm the backend is running on port 8000." });
  }
  if (!refreshed.ok) {
    clearSession();
    throw new AuthError();
  }
  const data = (await refreshed.json()) as { access_token: string; refresh_token: string; user: unknown };
  setSession(data.access_token, data.refresh_token, JSON.stringify(data.user));
  return data.access_token;
}

/** Refresh the access token when missing or close to expiry. Returns false when no session exists. */
export async function ensureFreshAccessToken(): Promise<boolean> {
  if (!hasSession()) return false;
  const access = getAccessToken();
  if (access && accessTokenFresh(access)) return true;
  try {
    await refreshAccessToken();
    return true;
  } catch (err) {
    if (err instanceof AuthError) return false;
    throw err;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (hasSession() && !path.includes("/auth/login") && !path.includes("/auth/register")) {
    await ensureFreshAccessToken();
  }

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
    try {
      const next = await refreshAccessToken();
      headers.set("Authorization", `Bearer ${next}`);
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw err;
    }
    try {
      const retry = await fetch(`${apiBase()}${path}`, { ...init, headers });
      return parse<T>(retry);
    } catch {
      throw new ApiError(0, { message: "Cannot reach the API. Confirm the backend is running on port 8000." });
    }
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

export async function fetchMediaBlob(url: string): Promise<string> {
  if (hasSession()) {
    await ensureFreshAccessToken();
  }

  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = typeof window !== "undefined" ? window.setTimeout(() => controller.abort(), 30_000) : undefined;

  async function load(attemptHeaders: Record<string, string>): Promise<Response> {
    try {
      return await fetch(`${apiBase()}${url}`, { headers: attemptHeaders, signal: controller.signal });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error("Image load timed out. Check your connection and retry.");
      }
      throw new Error("Cannot reach the API. Confirm the backend is running on port 8000.");
    }
  }

  try {
    let res = await load(headers);

    if (res.status === 401 && getRefreshToken()) {
      try {
        const next = await refreshAccessToken();
        headers.Authorization = `Bearer ${next}`;
        res = await load(headers);
      } catch (err) {
        if (err instanceof AuthError) throw err;
        throw err;
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
      if (res.status === 401) throw new AuthError();
      throw new Error("Unable to load image");
    }
    const blob = await res.blob();
    if (!blob.size) {
      const err = new Error("Image file is missing. Re-upload from Edit trade.") as Error & { code?: string };
      err.code = "media_missing";
      throw err;
    }
    return URL.createObjectURL(blob);
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
}
