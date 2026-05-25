import { apiFetch } from "./client";
import type { BalanceOut, BalanceSummaryOut } from "./types";

export async function listBalances(credentialId: string): Promise<BalanceOut[]> {
  return apiFetch<BalanceOut[]>(`/api/balances?credential_id=${credentialId}`);
}

export async function fetchBalanceSummary(): Promise<BalanceSummaryOut> {
  return apiFetch<BalanceSummaryOut>("/api/balances/summary");
}
