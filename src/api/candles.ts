import { apiFetch } from "./client";
import type { CandleOut } from "./types";
import { isMockEnabled } from "../mock/config";
import { mockStore } from "../mock/store";

export async function fetchCandles(
  exchange: string,
  symbol: string,
  timeframe: string,
  limit = 100,
): Promise<CandleOut[]> {
  if (isMockEnabled()) return mockStore.getCandles(symbol, timeframe, limit);
  return apiFetch<CandleOut[]>(
    `/api/candles/${exchange}/${symbol}/${timeframe}?limit=${limit}`,
  );
}
