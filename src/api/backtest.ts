import { apiFetch } from "./client";

export interface BacktestRunIn {
  strategy_class: string;
  exchange: string;
  symbol: string;
  timeframe: string;
  params: Record<string, unknown>;
  date_from: string;        // ISO-8601
  date_to: string;
  initial_balance: Record<string, string>;
}

export interface BacktestTrade {
  timestamp: string;
  side: "buy" | "sell";
  price: string;
  size: string;
  fee: string;
  pnl: string | null;
}

export interface EquityPoint {
  timestamp: string;
  equity: string;
}

export interface BacktestResult {
  initial_balance: Record<string, string>;
  final_balance: Record<string, string>;
  total_return_pct: string;
  max_drawdown_pct: string;
  sharpe_ratio: string | null;
  trades_count: number;
  win_rate: string;
  profit_factor: string | null;
  trades: BacktestTrade[];
  equity_curve: EquityPoint[];
}

export interface BacktestJobOut {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  exchange: string;
  strategy_class: string;
  symbol: string;
  timeframe: string;
  params: Record<string, unknown>;
  date_from: string;
  date_to: string;
  initial_balance: Record<string, string>;
  result: BacktestResult | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface BacktestJobSummary {
  id: string;
  status: BacktestJobOut["status"];
  exchange: string;
  strategy_class: string;
  symbol: string;
  timeframe: string;
  created_at: string;
  completed_at: string | null;
  total_return_pct: string | null;
  trades_count: number | null;
}

export const runBacktest = (body: BacktestRunIn): Promise<BacktestJobOut> =>
  apiFetch<BacktestJobOut>("/api/backtest/run", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const getBacktest = (id: string): Promise<BacktestJobOut> =>
  apiFetch<BacktestJobOut>(`/api/backtest/${id}`);

export const listBacktests = (limit = 20): Promise<BacktestJobSummary[]> =>
  apiFetch<BacktestJobSummary[]>(`/api/backtest?limit=${limit}`);

export const deleteBacktest = (id: string): Promise<void> =>
  apiFetch<void>(`/api/backtest/${id}`, { method: "DELETE" });
