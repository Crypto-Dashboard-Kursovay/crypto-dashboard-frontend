import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { Backtesting } from "../app/pages/Backtesting";
import * as backtestApi from "../api/backtest";
import * as exchangesApi from "../api/exchanges";
import type { BacktestJobOut, BacktestJobSummary } from "../api/backtest";

vi.mock("../api/backtest");
vi.mock("../api/exchanges");

const ACTIVE_BACKTEST_KEY = "crypto.backtest.activeJobId.v1";
const mockGetBacktest = vi.mocked(backtestApi.getBacktest);
const mockListBacktests = vi.mocked(backtestApi.listBacktests);
const mockRunBacktest = vi.mocked(backtestApi.runBacktest);
const mockListSupportedExchanges = vi.mocked(exchangesApi.listSupportedExchanges);
const mockListExchangeSymbols = vi.mocked(exchangesApi.listExchangeSymbols);

function makeJob(overrides: Partial<BacktestJobOut> = {}): BacktestJobOut {
  return {
    id: "job-1",
    status: "running",
    exchange: "binance",
    strategy_class: "SmaCross",
    symbol: "BTC/USDT",
    timeframe: "1h",
    params: { fast_period: 5, slow_period: 20, order_size: "0.001" },
    date_from: "2024-01-01T00:00:00.000Z",
    date_to: "2024-01-31T23:59:59.000Z",
    initial_balance: { USDT: "10000" },
    result: null,
    error_message: null,
    created_at: "2026-01-01T00:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

function makeSummary(overrides: Partial<BacktestJobSummary> = {}): BacktestJobSummary {
  return {
    id: "job-1",
    status: "running",
    exchange: "binance",
    strategy_class: "SmaCross",
    symbol: "BTC/USDT",
    timeframe: "1h",
    created_at: "2026-01-01T00:00:00.000Z",
    completed_at: null,
    total_return_pct: null,
    trades_count: null,
    ...overrides,
  };
}

function completedJob(): BacktestJobOut {
  return makeJob({
    status: "completed",
    completed_at: "2026-01-01T00:01:00.000Z",
    result: {
      initial_balance: { USDT: "10000" },
      final_balance: { USDT: "10100" },
      total_return_pct: "1.00",
      max_drawdown_pct: "0.25",
      sharpe_ratio: "1.50",
      trades_count: 0,
      win_rate: "0",
      profit_factor: null,
      trades: [],
      equity_curve: [
        { timestamp: "2024-01-01T00:00:00.000Z", equity: "10000" },
        { timestamp: "2024-01-02T00:00:00.000Z", equity: "10100" },
      ],
    },
  });
}

describe("Backtesting", () => {
  beforeEach(() => {
    localStorage.removeItem(ACTIVE_BACKTEST_KEY);
    mockListSupportedExchanges.mockResolvedValue([
      {
        name: "binance",
        display_name: "Binance",
        requires_passphrase: false,
        supports_testnet: true,
      },
    ]);
    mockListExchangeSymbols.mockResolvedValue(["BTC/USDT"]);
    mockListBacktests.mockResolvedValue([]);
    mockGetBacktest.mockResolvedValue(makeJob());
    mockRunBacktest.mockResolvedValue(makeJob());
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem(ACTIVE_BACKTEST_KEY);
  });

  it("restores stored running job and shows the running state", async () => {
    localStorage.setItem(ACTIVE_BACKTEST_KEY, "job-1");
    mockGetBacktest.mockResolvedValue(makeJob({ status: "running" }));

    render(<Backtesting />);

    await screen.findByText("Загружаем исторические свечи…");
    expect(mockGetBacktest).toHaveBeenCalledWith("job-1");
  });

  it("finds latest active job when local storage has no active id", async () => {
    mockListBacktests.mockResolvedValue([makeSummary({ id: "job-2" })]);
    mockGetBacktest.mockResolvedValue(makeJob({ id: "job-2", status: "queued" }));

    render(<Backtesting />);

    await waitFor(() => expect(mockGetBacktest).toHaveBeenCalledWith("job-2"));
    expect(localStorage.getItem(ACTIVE_BACKTEST_KEY)).toBe("job-2");
  });

  it("clears active id after restoring a terminal job but keeps the result visible", async () => {
    localStorage.setItem(ACTIVE_BACKTEST_KEY, "job-1");
    mockGetBacktest.mockResolvedValue(completedJob());

    render(<Backtesting />);

    await screen.findByText("Доходность");
    expect(localStorage.getItem(ACTIVE_BACKTEST_KEY)).toBeNull();
  });
});
