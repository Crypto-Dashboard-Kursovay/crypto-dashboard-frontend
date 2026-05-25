// Личный кабинет: API ключи + 2FA. Все вызовы идут на реальный бэк
// (`/api/cabinet/*`). testConnection стучится на /api/external/test и ожидает
// фиксированный ответ "This is a test API connection implementation".

import { API_ORIGIN, ApiHttpError, apiFetch } from "./client";
import type {
  ApiKeyCreateOut,
  ApiKeyOut,
  TestConnectionOut,
  TwoFaSetupOut,
} from "./types";

export async function listApiKeys(): Promise<ApiKeyOut[]> {
  return apiFetch<ApiKeyOut[]>("/api/cabinet/api-keys");
}

export async function generateApiKey(label?: string): Promise<ApiKeyCreateOut> {
  return apiFetch<ApiKeyCreateOut>("/api/cabinet/api-keys", {
    method: "POST",
    body: JSON.stringify({ label: label ?? null }),
  });
}

export async function deleteApiKey(id: string): Promise<void> {
  await apiFetch<void>(`/api/cabinet/api-keys/${id}`, { method: "DELETE" });
}

export async function getTwoFa(): Promise<boolean> {
  const res = await apiFetch<{ enabled: boolean }>("/api/cabinet/2fa");
  return res.enabled;
}

export async function setupTwoFa(): Promise<TwoFaSetupOut> {
  return apiFetch<TwoFaSetupOut>("/api/cabinet/2fa/setup", { method: "POST" });
}

export async function verifyTwoFa(code: string): Promise<void> {
  await apiFetch<void>("/api/cabinet/2fa/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function disableTwoFa(): Promise<void> {
  await apiFetch<void>("/api/cabinet/2fa", { method: "DELETE" });
}

// Тестовый вызов внешнего эндпоинта. Не используем apiFetch — он принудительно
// проставляет наш JWT в Authorization; здесь нужен именно API-ключ клиента.
export async function testConnection(
  apiKey: string,
  clientId: string,
): Promise<TestConnectionOut> {
  const res = await fetch(`${API_ORIGIN}/api/external/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Client-Id": clientId,
    },
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new ApiHttpError(
      res.status,
      typeof detail?.detail === "string" ? detail.detail : "Тест не удался",
      detail,
    );
  }
  return (await res.json()) as TestConnectionOut;
}
