import { apiFetch } from "./client";
import type { CredentialIn, CredentialOut } from "./types";

export async function listCredentials(): Promise<CredentialOut[]> {
  return apiFetch<CredentialOut[]>("/api/exchange-credentials");
}

export async function createCredential(body: CredentialIn): Promise<CredentialOut> {
  return apiFetch<CredentialOut>("/api/exchange-credentials", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteCredential(id: string): Promise<void> {
  await apiFetch<void>(`/api/exchange-credentials/${id}`, { method: "DELETE" });
}
