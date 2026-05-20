import { apiFetch } from "./client";
import type { CandleOut } from "./types";

export async function fetchCandles(
  exchange: string,
  symbol: string,
  timeframe: string,
  limit = 100,
): Promise<CandleOut[]> {
  return apiFetch<CandleOut[]>(
    `/api/candles/${exchange}/${symbol}/${timeframe}?limit=${limit}`,
  );
}
