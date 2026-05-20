import { apiFetch } from "./client";
import type { PositionOut } from "./types";

export async function listPositions(credentialId: string): Promise<PositionOut[]> {
  return apiFetch<PositionOut[]>(`/api/positions?credential_id=${credentialId}`);
}
