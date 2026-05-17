// Тонкая обёртка над fetch:
// - подставляет VITE_API_URL базу,
// - прикрепляет Authorization: Bearer <access>,
// - на 401 пытается refresh и повторяет запрос,
// - бросает ApiHttpError с понятным сообщением из {detail: "..."}.

const RAW_BASE = (import.meta.env.VITE_API_URL ?? "/api/").replace(/\/+$/, "");

// VITE_API_URL может быть как "/api/" так и "http://host:8000/api/" — нормализуем.
// Бэк роутеры монтируются на префиксах "/auth" и "/api/...", поэтому ApiClient.fetch
// принимает путь начиная со слэша, например "/auth/login" или "/api/bots".
export const API_ORIGIN = RAW_BASE.replace(/\/api$/, "");

const ACCESS_KEY = "crypto.access_token";
const REFRESH_KEY = "crypto.refresh_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export class ApiHttpError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

interface FetchOptions extends RequestInit {
  // Если true, при 401 НЕ пытаемся refresh — это сам refresh-запрос.
  skipAuthRetry?: boolean;
}

async function readError(response: Response): Promise<{ message: string; body: unknown }> {
  let body: unknown = null;
  try {
    body = await response.clone().json();
  } catch {
    try {
      body = await response.text();
    } catch {
      body = null;
    }
  }
  let message: string;
  if (body && typeof body === "object" && "detail" in (body as Record<string, unknown>)) {
    const detail = (body as { detail: unknown }).detail;
    message = typeof detail === "string" ? detail : JSON.stringify(detail);
  } else if (typeof body === "string" && body.length > 0) {
    message = body;
  } else {
    message = `HTTP ${response.status} ${response.statusText}`;
  }
  return { message, body };
}

async function tryRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_ORIGIN}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { access_token: string; refresh_token: string };
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { skipAuthRetry, headers, ...rest } = options;
  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  };
  const access = getAccessToken();
  if (access) finalHeaders["Authorization"] = `Bearer ${access}`;

  const url = `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
  let response = await fetch(url, { ...rest, headers: finalHeaders });

  if (response.status === 401 && !skipAuthRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newAccess = getAccessToken();
      if (newAccess) finalHeaders["Authorization"] = `Bearer ${newAccess}`;
      response = await fetch(url, { ...rest, headers: finalHeaders });
    } else {
      clearTokens();
      // Хард-редирект — простейший способ выкинуть на /login из любого места.
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
  }

  if (!response.ok) {
    const { message, body } = await readError(response);
    throw new ApiHttpError(response.status, message, body);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
