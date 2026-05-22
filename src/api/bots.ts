import { apiFetch } from "./client";
import type { BotCreateIn, BotOut, BotParamsIn } from "./types";
import { isMockEnabled } from "../mock/config";
import { mockStore } from "../mock/store";

export async function listBots(): Promise<BotOut[]> {
  if (isMockEnabled()) return mockStore.getBots();
  return apiFetch<BotOut[]>("/api/bots");
}

export async function getBot(id: string): Promise<BotOut> {
  if (isMockEnabled()) return mockStore.getBot(id);
  return apiFetch<BotOut>(`/api/bots/${id}`);
}

export async function createBot(body: BotCreateIn): Promise<BotOut> {
  if (isMockEnabled()) return mockStore.createBot(body);
  return apiFetch<BotOut>("/api/bots", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function startBot(id: string): Promise<BotOut> {
  if (isMockEnabled()) return mockStore.startBot(id);
  return apiFetch<BotOut>(`/api/bots/${id}/start`, { method: "POST" });
}

export async function stopBot(id: string, closePositions = false): Promise<BotOut> {
  if (isMockEnabled()) return mockStore.stopBot(id);
  return apiFetch<BotOut>(`/api/bots/${id}/stop`, {
    method: "POST",
    body: JSON.stringify({ close_positions: closePositions }),
  });
}

export async function updateBotParams(id: string, params: Record<string, unknown>): Promise<BotOut> {
  if (isMockEnabled()) return mockStore.updateBotParams(id, params);
  return apiFetch<BotOut>(`/api/bots/${id}/params`, {
    method: "PATCH",
    body: JSON.stringify({ params } satisfies BotParamsIn),
  });
}

export async function deleteBot(id: string): Promise<void> {
  if (isMockEnabled()) return mockStore.deleteBot(id);
  await apiFetch<void>(`/api/bots/${id}`, { method: "DELETE" });
}
