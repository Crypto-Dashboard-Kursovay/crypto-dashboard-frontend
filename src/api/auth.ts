import { apiFetch, clearTokens, setTokens } from "./client";
import type { TokenPair, UserOut } from "./types";

// === Email + 6-значный код ===

export async function requestEmailCode(
  email: string,
  captchaToken: string,
): Promise<void> {
  await apiFetch<{ status: string }>("/api/auth/email/request", {
    method: "POST",
    body: JSON.stringify({ email, captcha_token: captchaToken }),
    skipAuthRetry: true,
  });
}

export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<TokenPair> {
  const pair = await apiFetch<TokenPair>("/api/auth/email/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
    skipAuthRetry: true,
  });
  setTokens(pair.access_token, pair.refresh_token);
  return pair;
}

// === Telegram Login Widget ===

export interface TelegramAuthPayload {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export async function getTelegramWidgetConfig(): Promise<{
  bot_id: number;
  bot_username: string;
}> {
  return apiFetch<{ bot_id: number; bot_username: string }>(
    "/api/auth/telegram/widget-config",
    { skipAuthRetry: true },
  );
}

export async function loginWithTelegramPayload(
  payload: TelegramAuthPayload,
): Promise<TokenPair> {
  const pair = await apiFetch<TokenPair>("/api/auth/telegram/verify", {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuthRetry: true,
  });
  setTokens(pair.access_token, pair.refresh_token);
  return pair;
}

// === Общие ===

export async function me(): Promise<UserOut> {
  return apiFetch<UserOut>("/api/auth/me");
}

export function logout(): void {
  clearTokens();
}

// Помощник для страницы /auth/callback (OAuth redirect).
export function consumeCallbackTokens(access: string, refresh: string): void {
  setTokens(access, refresh);
}

// Куда редиректить пользователя для OAuth-логина (Google/Yandex/GitHub).
// Бэк делает 302 на сторону провайдера и затем 302 на /auth/callback.
export function getOAuthStartUrl(
  provider: "google" | "yandex" | "github",
): string {
  return `/api/auth/${provider}/start`;
}
