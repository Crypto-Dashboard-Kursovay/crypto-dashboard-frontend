import { apiFetch } from "./client";
import type { BalanceOut, BalanceSummaryOut } from "./types";
import { isMockEnabled } from "../mock/config";
import { mockStore } from "../mock/store";

export async function listBalances(credentialId: string): Promise<BalanceOut[]> {
  if (isMockEnabled()) return mockStore.getBalances(credentialId);
  return apiFetch<BalanceOut[]>(`/api/balances?credential_id=${credentialId}`);
}

export async function fetchBalanceSummary(): Promise<BalanceSummaryOut> {
  if (isMockEnabled()) return mockStore.getBalanceSummary();
  return apiFetch<BalanceSummaryOut>("/api/balances/summary");
}
