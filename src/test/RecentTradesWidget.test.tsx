import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RecentTradesWidget } from "../app/components/dashboard/RecentTradesWidget";
import * as tradesApi from "../api/trades";
import type { TradeOut } from "../api/trades";
import { ApiHttpError } from "../api/client";

vi.mock("../api/trades");

const mockListTrades = vi.mocked(tradesApi.listTrades);

function makeTrade(overrides: Partial<TradeOut> = {}): TradeOut {
  return {
    id: "t1", bot_id: "b1", symbol: "BTC/USDT", side: "buy",
    size: "0.01", price: "95000.00", fee: "0.95",
    strategy: "macd_cross", created_at: "2026-01-15T10:30:00.000Z",
    ...overrides,
  };
}

describe("RecentTradesWidget", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner initially", () => {
    mockListTrades.mockReturnValue(new Promise(() => {}));
    render(<RecentTradesWidget />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders trades when data loads", async () => {
    mockListTrades.mockResolvedValue([
      makeTrade({ id: "t1", side: "buy" }),
      makeTrade({ id: "t2", side: "sell", symbol: "ETH/USDT", price: "3100.00", size: "2.0" }),
    ]);
    render(<RecentTradesWidget />);
    await waitFor(() => {
      expect(screen.getByText("BTC/USDT")).toBeInTheDocument();
    });
    expect(screen.getByText("ETH/USDT")).toBeInTheDocument();
    expect(screen.getByText("Buy")).toBeInTheDocument();
    expect(screen.getByText("Sell")).toBeInTheDocument();
    expect(screen.getByText("95000.00")).toBeInTheDocument();
    expect(screen.getByText("3100.00")).toBeInTheDocument();
    expect(screen.getByText("0.01")).toBeInTheDocument();
    expect(screen.getByText("2.0")).toBeInTheDocument();
  });

  it("shows empty state when no trades", async () => {
    mockListTrades.mockResolvedValue([]);
    render(<RecentTradesWidget />);
    await waitFor(() => {
      expect(screen.getByText("Нет сделок")).toBeInTheDocument();
    });
  });

  it("shows error message on fetch failure", async () => {
    mockListTrades.mockRejectedValue(new ApiHttpError(500, "Internal error"));
    render(<RecentTradesWidget />);
    await waitFor(() => {
      expect(screen.getByText("Internal error")).toBeInTheDocument();
    });
  });

  it("shows generic error message", async () => {
    mockListTrades.mockRejectedValue(new Error("boom"));
    render(<RecentTradesWidget />);
    await waitFor(() => {
      expect(screen.getByText("Не удалось загрузить сделки")).toBeInTheDocument();
    });
  });

  it("passes limit=10 to listTrades", async () => {
    mockListTrades.mockResolvedValue([]);
    render(<RecentTradesWidget />);
    await waitFor(() => {
      expect(mockListTrades).toHaveBeenCalledWith({ limit: 10 });
    });
  });

  it("has correct column headers", async () => {
    mockListTrades.mockResolvedValue([]);
    render(<RecentTradesWidget />);
    await waitFor(() => {
      expect(screen.getByText("Время")).toBeInTheDocument();
      expect(screen.getByText("Пара")).toBeInTheDocument();
      expect(screen.getByText("Сторона")).toBeInTheDocument();
      expect(screen.getByText("Цена")).toBeInTheDocument();
      expect(screen.getByText("Объём")).toBeInTheDocument();
    });
  });

  it("has auto-refresh chip", async () => {
    mockListTrades.mockResolvedValue([]);
    render(<RecentTradesWidget />);
    await waitFor(() => {
      expect(screen.getByText("Автообновление")).toBeInTheDocument();
    });
  });
});
