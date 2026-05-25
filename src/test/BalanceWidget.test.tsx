import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { BalanceWidget } from "../app/components/dashboard/BalanceWidget";
import { LogsProvider } from "../app/LogsContext";
import * as balancesApi from "../api/balances";
import type { BalanceSummaryOut } from "../api/types";
import { ApiHttpError } from "../api/client";

vi.mock("../api/balances");

const mockFetchBalanceSummary = vi.mocked(balancesApi.fetchBalanceSummary);
const ORIGINAL_WEBSOCKET = global.WebSocket;

function makeSummary(overrides: Partial<BalanceSummaryOut> = {}): BalanceSummaryOut {
  return {
    total_equity: "15234.50",
    free_total: "14800.00",
    used_total: "434.50",
    currencies: [
      { credential_id: "c1", currency: "USDT", free: "12000.00", used: "400.00", total: "12400.00", observed_at: "2026-01-01T00:00:00Z" },
      { credential_id: "c1", currency: "BTC", free: "0.05", used: "0.00", total: "0.05", observed_at: "2026-01-01T00:00:00Z" },
    ],
    open_pnl: "42.15",
    position_count: 2,
    last_observed_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("BalanceWidget", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    localStorage.removeItem("crypto.access_token");
    global.WebSocket = ORIGINAL_WEBSOCKET;
  });

  it("shows loading spinner initially", () => {
    mockFetchBalanceSummary.mockReturnValue(new Promise(() => {}));
    render(<BalanceWidget />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders balance summary data on success", async () => {
    mockFetchBalanceSummary.mockResolvedValue(makeSummary());
    render(<BalanceWidget />);
    await waitFor(() => {
      expect(screen.getByText("15234.50")).toBeInTheDocument();
    });
    expect(screen.getByText("USDT")).toBeInTheDocument();
    expect(screen.getByText(/\+42\.15/)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders negative PnL in red", async () => {
    mockFetchBalanceSummary.mockResolvedValue(makeSummary({ open_pnl: "-10.50" }));
    render(<BalanceWidget />);
    await waitFor(() => {
      expect(screen.getByText(/-10\.50/)).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    mockFetchBalanceSummary.mockRejectedValue(new ApiHttpError(500, "Server error"));
    render(<BalanceWidget />);
    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("handles generic error", async () => {
    mockFetchBalanceSummary.mockRejectedValue(new Error("boom"));
    render(<BalanceWidget />);
    await waitFor(() => {
      expect(screen.getByText("Ошибка загрузки")).toBeInTheDocument();
    });
  });

  it("shows free and used amounts", async () => {
    mockFetchBalanceSummary.mockResolvedValue(makeSummary());
    render(<BalanceWidget />);
    await waitFor(() => {
      expect(screen.getByText(/Свободно:/)).toBeInTheDocument();
      expect(screen.getByText(/В ордерах:/)).toBeInTheDocument();
    });
  });

  it("shows all section labels", async () => {
    mockFetchBalanceSummary.mockResolvedValue(makeSummary());
    render(<BalanceWidget />);
    await waitFor(() => {
      expect(screen.getByText("Баланс и P&L")).toBeInTheDocument();
      expect(screen.getByText("Открытая прибыль/убыток")).toBeInTheDocument();
      expect(screen.getByText("Количество позиций")).toBeInTheDocument();
    });
  });

  it("refreshes balance every 5 seconds", async () => {
    vi.useFakeTimers();
    mockFetchBalanceSummary.mockResolvedValue(makeSummary());
    render(<BalanceWidget />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockFetchBalanceSummary).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    expect(mockFetchBalanceSummary).toHaveBeenCalledTimes(2);
  });

  it("refreshes balance when the window receives focus", async () => {
    mockFetchBalanceSummary.mockResolvedValue(makeSummary());
    render(<BalanceWidget />);
    await waitFor(() => expect(mockFetchBalanceSummary).toHaveBeenCalledTimes(1));

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(mockFetchBalanceSummary).toHaveBeenCalledTimes(2));
  });

  it("refreshes balance on websocket balance_update signal", async () => {
    const sockets: Array<{ onmessage: ((event: MessageEvent) => void) | null; close: () => void }> = [];
    class MockWebSocket {
      onopen: (() => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        sockets.push(this);
      }
      close() {}
    }
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    localStorage.setItem("crypto.access_token", "test-token");
    mockFetchBalanceSummary.mockResolvedValue(makeSummary());

    render(
      <LogsProvider>
        <BalanceWidget />
      </LogsProvider>,
    );
    await waitFor(() => expect(mockFetchBalanceSummary).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(sockets.length).toBe(1));

    act(() => {
      sockets[0].onmessage?.({
        data: JSON.stringify({ type: "balance_update", data: {} }),
      } as MessageEvent);
    });

    await waitFor(() => expect(mockFetchBalanceSummary).toHaveBeenCalledTimes(2));
  });
});
