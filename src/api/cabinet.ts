// Личный кабинет: API ключи пользователя для будущей программной интеграции
// с нашим бэком + флаг 2FA.
//
// Сейчас бэк-эндпоинтов нет (будут на следующем этапе). В mock-режиме данные
// живут в `crypto.mock.session.v1` через MockStore. В реальном режиме функции
// будут обращаться к /api/cabinet/* — TODO: реализовать на бэке.
//
// testConnection НИКОГДА не идёт в сеть — это симуляция будущего ответа сервера
// для предъявленных API-ключа и Client ID.

import { apiFetch } from "./client";
import type { ApiKeyOut, TestConnectionOut } from "./types";
import { isMockEnabled } from "../mock/config";
import { mockStore } from "../mock/store";

export async function listApiKeys(): Promise<ApiKeyOut[]> {
  if (isMockEnabled()) return mockStore.listApiKeys();
  return apiFetch<ApiKeyOut[]>("/api/cabinet/api-keys");
}

export async function generateApiKey(label?: string): Promise<ApiKeyOut> {
  if (isMockEnabled()) return mockStore.generateApiKey(label);
  return apiFetch<ApiKeyOut>("/api/cabinet/api-keys", {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

export async function deleteApiKey(id: string): Promise<void> {
  if (isMockEnabled()) {
    mockStore.deleteApiKey(id);
    return;
  }
  await apiFetch<void>(`/api/cabinet/api-keys/${id}`, { method: "DELETE" });
}

export async function getTwoFa(): Promise<boolean> {
  if (isMockEnabled()) return mockStore.getTwoFa();
  const res = await apiFetch<{ enabled: boolean }>("/api/cabinet/2fa");
  return res.enabled;
}

export async function setTwoFa(enabled: boolean): Promise<void> {
  if (isMockEnabled()) {
    mockStore.setTwoFa(enabled);
    return;
  }
  await apiFetch<void>("/api/cabinet/2fa", {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

// Симуляция ответа будущего бэк-эндпоинта /api/external/test, в который
// клиент будет ходить со связкой API-ключ + Client ID. Возвращает фиксированную
// английскую строку — это контракт временной реализации.
export async function testConnection(
  _apiKey: string,
  _clientId: string,
): Promise<TestConnectionOut> {
  await new Promise((r) => setTimeout(r, 350));
  return { message: "This is a test API connection implementation" };
}
