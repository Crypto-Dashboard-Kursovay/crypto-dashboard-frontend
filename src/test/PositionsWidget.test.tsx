import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PositionsWidget } from "../app/components/dashboard/PositionsWidget";
import { apiFetch } from "../api/client";

vi.mock("../api/client", () => ({
  apiFetch: vi.fn(),
  ApiHttpError: class ApiHttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

const mockApiFetch = vi.mocked(apiFetch);

describe("PositionsWidget", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner initially", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    render(<PositionsWidget />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders positions from multiple credentials", async () => {
    mockApiFetch
      .mockResolvedValueOnce([{ id: "cred-1" }, { id: "cred-2" }])
      .mockResolvedValueOnce([
        { id: "p1", credential_id: "cred-1", symbol: "BTC/USDT", side: "buy", entry_price: "95000.00", size: "0.1", current_pnl: "150.25", observed_at: "2026-01-01T00:00:00Z" },
      ])
      .mockResolvedValueOnce([
        { id: "p2", credential_id: "cred-2", symbol: "ETH/USDT", side: "sell", entry_price: "3100.00", size: "2.5", current_pnl: "-45.10", observed_at: "2026-01-01T00:00:00Z" },
      ]);

    render(<PositionsWidget />);
    await waitFor(() => {
      expect(screen.getByText("BTC/USDT")).toBeInTheDocument();
    });
    expect(screen.getByText("ETH/USDT")).toBeInTheDocument();
    expect(screen.getByText("Long")).toBeInTheDocument();
    expect(screen.getByText("Short")).toBeInTheDocument();
    expect(screen.getByText("0.1")).toBeInTheDocument();
    expect(screen.getByText("2.5")).toBeInTheDocument();
    expect(screen.getByText("+150.25")).toBeInTheDocument();
    expect(screen.getByText("-45.10")).toBeInTheDocument();
    expect(screen.getByText("95000.00")).toBeInTheDocument();
    expect(screen.getByText("3100.00")).toBeInTheDocument();
  });

  it("shows empty state when no positions", async () => {
    mockApiFetch
      .mockResolvedValueOnce([{ id: "cred-1" }])
      .mockResolvedValueOnce([]);
    render(<PositionsWidget />);
    await waitFor(() => {
      expect(screen.getByText("Нет открытых позиций")).toBeInTheDocument();
    });
  });

  it("handles credential fetch error gracefully", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("fetch failed"));
    render(<PositionsWidget />);
    await waitFor(() => {
      expect(screen.getByText("Не удалось загрузить позиции")).toBeInTheDocument();
    });
  });

  it("skips failed credential position fetches", async () => {
    mockApiFetch
      .mockResolvedValueOnce([{ id: "cred-1" }, { id: "cred-2" }])
      .mockRejectedValueOnce(new Error("cred-1 failed"))
      .mockResolvedValueOnce([
        { id: "p2", credential_id: "cred-2", symbol: "ETH/USDT", side: "sell", entry_price: "3100.00", size: "2.5", current_pnl: "-45.10", observed_at: "2026-01-01T00:00:00Z" },
      ]);

    render(<PositionsWidget />);
    await waitFor(() => {
      expect(screen.getByText("ETH/USDT")).toBeInTheDocument();
    });
    expect(screen.queryByText("BTC/USDT")).not.toBeInTheDocument();
  });

  it("has column headers", async () => {
    mockApiFetch.mockResolvedValueOnce([]);
    render(<PositionsWidget />);
    await waitFor(() => {
      expect(screen.getByText("Пара / Тип")).toBeInTheDocument();
      expect(screen.getByText("Объём / P&L")).toBeInTheDocument();
      expect(screen.getByText("Цена входа")).toBeInTheDocument();
    });
  });
});
