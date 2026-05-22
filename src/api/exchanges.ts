import { apiFetch } from "./client";
import type { ExchangeMeta } from "./types";
import { isMockEnabled } from "../mock/config";
import { mockStore } from "../mock/store";

export async function listSupportedExchanges(): Promise<ExchangeMeta[]> {
  if (isMockEnabled()) return mockStore.getSupportedExchanges();
  return apiFetch<ExchangeMeta[]>("/api/exchanges/supported", { skipAuthRetry: true });
}

export async function listExchangeSymbols(name: string): Promise<string[]> {
  if (isMockEnabled()) return mockStore.getExchangeSymbols();
  return apiFetch<string[]>(`/api/exchanges/${encodeURIComponent(name)}/symbols`);
}
