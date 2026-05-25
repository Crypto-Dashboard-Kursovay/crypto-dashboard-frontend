import { apiFetch } from "./client";

export interface TradeOut {
  id: string;
  bot_id: string | null;
  symbol: string;
  side: string;
  size: string;
  price: string;
  fee: string;
  strategy: string;
  created_at: string;
}

export interface ListTradesParams {
  bot_id?: string;
  limit?: number;
  /** ISO-8601 timestamp lower bound (inclusive). */
  from?: string;
  /** ISO-8601 timestamp upper bound (inclusive). */
  to?: string;
}

export async function listTrades(params: ListTradesParams = {}): Promise<TradeOut[]> {
  const qs = new URLSearchParams();
  if (params.bot_id) qs.set("bot_id", params.bot_id);
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  const tail = qs.toString();
  return apiFetch<TradeOut[]>(`/api/trades${tail ? `?${tail}` : ""}`);
}
