import { apiFetch } from "./client";
import type { PositionOut } from "./types";
import { isMockEnabled } from "../mock/config";
import { mockStore } from "../mock/store";

export async function listPositions(credentialId: string): Promise<PositionOut[]> {
  if (isMockEnabled()) return mockStore.getPositions(credentialId);
  return apiFetch<PositionOut[]>(`/api/positions?credential_id=${credentialId}`);
}
