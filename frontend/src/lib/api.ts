const BASE_URL = "http://localhost:3000";

// Module-level token storage (survives re-renders, cleared on logout)
let _accessToken: string | null = null;
let _onUnauthenticated: (() => void) | null = null;

// Refresh dedup — prevents multiple simultaneous refresh calls
let _isRefreshing = false;
let _refreshQueue: Array<(token: string | null) => void> = [];

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken() {
  return _accessToken;
}

export function setUnauthenticatedHandler(handler: () => void) {
  _onUnauthenticated = handler;
}

// ── Error types ──────────────────────────────────────────────────────────────

export interface ApiError {
  statusCode: number;
  message: string | string[];
  timestamp: string;
  path: string;
}

export function extractErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "Erro desconhecido";
  const e = err as Error & { apiError?: ApiError };
  if (e.apiError) {
    const msg = e.apiError.message;
    return Array.isArray(msg) ? msg.join("\n") : String(msg);
  }
  return e.message ?? "Erro desconhecido";
}

// ── Paginated response wrapper ────────────────────────────────────────────────

export interface PagedData<T> {
  data: T[];
  total: number;
  pagina: number;
  limite: number;
}

// ── Token refresh ─────────────────────────────────────────────────────────────

async function doRefresh(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const refreshToken = localStorage.getItem("wpp_refresh_token");
  if (!refreshToken) return null;

  try {
    const resp = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!resp.ok) {
      localStorage.removeItem("wpp_refresh_token");
      return null;
    }

    const raw = await resp.json();
    // Handle both wrapped { success, data: { accessToken } } and unwrapped { accessToken }
    const at: string = raw?.data?.accessToken ?? raw?.accessToken;
    if (!at) return null;
    _accessToken = at;
    return at;
  } catch {
    return null;
  }
}

async function performRefresh(): Promise<string | null> {
  if (_isRefreshing) {
    return new Promise((resolve) => _refreshQueue.push(resolve));
  }
  _isRefreshing = true;
  const token = await doRefresh();
  _isRefreshing = false;
  _refreshQueue.forEach((cb) => cb(token));
  _refreshQueue = [];
  return token;
}

// ── Core request function ─────────────────────────────────────────────────────

export type ApiOpts = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  formData?: FormData;
};

/**
 * Makes an authenticated API request.
 * Automatically retries once after a silent token refresh on 401.
 * Returns the `data` field from the server's { success, data } envelope.
 */
export async function api<T = unknown>(path: string, opts: ApiOpts = {}): Promise<T> {
  if (typeof window === "undefined") return undefined as T;

  const buildHeaders = (token: string | null): Record<string, string> => {
    const h: Record<string, string> = {};
    if (token) h["Authorization"] = `Bearer ${token}`;
    // Don't set Content-Type for FormData — browser must set boundary automatically
    if (!opts.formData) h["Content-Type"] = "application/json";
    return h;
  };

  const buildInit = (token: string | null): RequestInit => ({
    method: opts.method ?? "GET",
    headers: buildHeaders(token),
    body: opts.formData ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });

  let resp = await fetch(`${BASE_URL}${path}`, buildInit(_accessToken));

  // Silent refresh on 401
  if (resp.status === 401) {
    const newToken = await performRefresh();
    if (!newToken) {
      _onUnauthenticated?.();
      throw new Error("Sessão expirada. Faça login novamente.");
    }
    resp = await fetch(`${BASE_URL}${path}`, buildInit(newToken));
  }

  // Handle error responses
  if (!resp.ok) {
    let apiError: ApiError | undefined;
    try {
      apiError = await resp.json();
    } catch {
      throw new Error(`Erro ${resp.status}`);
    }
    const msg = Array.isArray(apiError?.message)
      ? apiError.message.join("\n")
      : String(apiError?.message ?? `Erro ${resp.status}`);
    const err = new Error(msg) as Error & { apiError?: ApiError };
    err.apiError = apiError;
    throw err;
  }

  if (resp.status === 204) return undefined as T;

  const json = await resp.json();
  // Unwrap { success: true, data: ... } envelope if present
  if (json && typeof json === "object" && "success" in json && "data" in json) {
    // Flat paginated envelope: { success, data: [], total, pagina, limite }
    if ("total" in json && "pagina" in json && "limite" in json) {
      return { data: json.data, total: json.total, pagina: json.pagina, limite: json.limite } as T;
    }
    return json.data as T;
  }
  return json as T;
}

// ── Convenience helpers ───────────────────────────────────────────────────────

export const apiGet = <T>(path: string) => api<T>(path);

export const apiPost = <T>(path: string, body: unknown) => api<T>(path, { method: "POST", body });

export const apiPatch = <T>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body });

export const apiPut = <T>(path: string, body: unknown) => api<T>(path, { method: "PUT", body });

export const apiDelete = <T = void>(path: string) => api<T>(path, { method: "DELETE" });

export const apiUpload = <T>(path: string, formData: FormData) =>
  api<T>(path, { method: "POST", formData });
