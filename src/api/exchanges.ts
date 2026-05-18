import { apiFetch } from "./client";
import type { ExchangeMeta } from "./types";

export async function listSupportedExchanges(): Promise<ExchangeMeta[]> {
  return apiFetch<ExchangeMeta[]>("/api/exchanges/supported", { skipAuthRetry: true });
}

export async function listExchangeSymbols(name: string): Promise<string[]> {
  return apiFetch<string[]>(`/api/exchanges/${encodeURIComponent(name)}/symbols`);
}
