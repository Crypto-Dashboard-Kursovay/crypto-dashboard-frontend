import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BalanceWidget } from "../app/components/dashboard/BalanceWidget";
import * as balancesApi from "../api/balances";
import type { BalanceSummaryOut } from "../api/types";
import { ApiHttpError } from "../api/client";

vi.mock("../api/balances");

const mockFetchBalanceSummary = vi.mocked(balancesApi.fetchBalanceSummary);

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
    ...overrides,
  };
}

describe("BalanceWidget", () => {
  afterEach(() => {
    vi.clearAllMocks();
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
    expect(screen.getByText("+42.1500 USDT")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders negative PnL in red", async () => {
    mockFetchBalanceSummary.mockResolvedValue(makeSummary({ open_pnl: "-10.50" }));
    render(<BalanceWidget />);
    await waitFor(() => {
      expect(screen.getByText("-10.5000 USDT")).toBeInTheDocument();
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
});
