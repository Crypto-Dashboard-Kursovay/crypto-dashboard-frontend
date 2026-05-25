import { apiFetch } from "./client";
import type { BotCreateIn, BotOut, BotParamsIn } from "./types";

export async function listBots(): Promise<BotOut[]> {
  return apiFetch<BotOut[]>("/api/bots");
}

export async function getBot(id: string): Promise<BotOut> {
  return apiFetch<BotOut>(`/api/bots/${id}`);
}

export async function createBot(body: BotCreateIn): Promise<BotOut> {
  return apiFetch<BotOut>("/api/bots", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function startBot(id: string): Promise<BotOut> {
  return apiFetch<BotOut>(`/api/bots/${id}/start`, { method: "POST" });
}

export async function stopBot(id: string, closePositions = false): Promise<BotOut> {
  return apiFetch<BotOut>(`/api/bots/${id}/stop`, {
    method: "POST",
    body: JSON.stringify({ close_positions: closePositions }),
  });
}

export async function updateBotParams(id: string, params: Record<string, unknown>): Promise<BotOut> {
  return apiFetch<BotOut>(`/api/bots/${id}/params`, {
    method: "PATCH",
    body: JSON.stringify({ params } satisfies BotParamsIn),
  });
}

export async function deleteBot(id: string): Promise<void> {
  await apiFetch<void>(`/api/bots/${id}`, { method: "DELETE" });
}
