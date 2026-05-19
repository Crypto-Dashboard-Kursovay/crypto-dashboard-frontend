import { API_ORIGIN } from "./client";

export interface HealthStatus {
  backend: string;
  postgres: string;
  redis: string;
}

// /healthz возвращает 503 при сбойных проверках, но с валидным JSON body.
// apiFetch выбрасывает ApiHttpError на не-2xx — поэтому читаем напрямую.
export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_ORIGIN}/healthz`);
  const body = (await res.json()) as Partial<HealthStatus>;
  return {
    backend: body.backend ?? "unknown",
    postgres: body.postgres ?? "unknown",
    redis: body.redis ?? "unknown",
  };
}
