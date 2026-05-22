import { apiFetch } from "./client";
import type { CredentialIn, CredentialOut } from "./types";
import { isMockEnabled } from "../mock/config";
import { mockStore } from "../mock/store";

export async function listCredentials(): Promise<CredentialOut[]> {
  if (isMockEnabled()) return mockStore.getCredentials();
  return apiFetch<CredentialOut[]>("/api/exchange-credentials");
}

export async function createCredential(body: CredentialIn): Promise<CredentialOut> {
  if (isMockEnabled()) return mockStore.addCredential({ exchange: body.exchange, label: body.label });
  return apiFetch<CredentialOut>("/api/exchange-credentials", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteCredential(id: string): Promise<void> {
  if (isMockEnabled()) return mockStore.removeCredential(id);
  await apiFetch<void>(`/api/exchange-credentials/${id}`, { method: "DELETE" });
}
