import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChartWidget } from "../app/components/dashboard/ChartWidget";
import * as candlesApi from "../api/candles";
import { ApiHttpError } from "../api/client";

vi.mock("../api/candles");

const mockFetchCandles = vi.mocked(candlesApi.fetchCandles);

function makeCandles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(2026, 0, 1, 10 + Math.floor(i / 60), i % 60).toISOString(),
    open: (90000 + i * 10).toString(),
    high: (90010 + i * 10).toString(),
    low: (89990 + i * 10).toString(),
    close: (90005 + i * 10).toString(),
    volume: (1.5 + i * 0.1).toString(),
  }));
}

describe("ChartWidget", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches candles on mount with defaults", async () => {
    mockFetchCandles.mockResolvedValue(makeCandles(10));
    render(<ChartWidget />);
    await waitFor(() => {
      expect(mockFetchCandles).toHaveBeenCalledWith("binance", "BTC/USDT", "15m");
    });
  });

  it("shows loading state initially", () => {
    mockFetchCandles.mockReturnValue(new Promise(() => {}));
    render(<ChartWidget />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows last price after data loads", async () => {
    mockFetchCandles.mockResolvedValue(makeCandles(10));
    render(<ChartWidget />);
    await waitFor(() => {
      expect(screen.getByText("$90095")).toBeInTheDocument();
    });
  });

  it("shows error message on fetch failure", async () => {
    mockFetchCandles.mockRejectedValue(new ApiHttpError(502, "Bad gateway"));
    render(<ChartWidget />);
    await waitFor(() => {
      expect(screen.getByText("Bad gateway")).toBeInTheDocument();
    });
  });

  it("shows generic error on unexpected failure", async () => {
    mockFetchCandles.mockRejectedValue(new Error("network"));
    render(<ChartWidget />);
    await waitFor(() => {
      expect(screen.getByText("Ошибка загрузки графика")).toBeInTheDocument();
    });
  });

  it("shows empty state when no candles", async () => {
    mockFetchCandles.mockResolvedValue([]);
    render(<ChartWidget />);
    await waitFor(() => {
      expect(screen.getByText("Нет данных")).toBeInTheDocument();
    });
  });

  it("changes symbol triggers refetch", async () => {
    const user = userEvent.setup();
    mockFetchCandles.mockResolvedValue(makeCandles(5));
    render(<ChartWidget />);
    await waitFor(() => {
      expect(mockFetchCandles).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("combobox"));
    const ethOption = screen.getByRole("option", { name: "ETH/USDT" });
    await user.click(ethOption);

    await waitFor(() => {
      expect(mockFetchCandles).toHaveBeenCalledWith("binance", "ETH/USDT", "15m");
    });
  });

  it("changes timeframe triggers refetch", async () => {
    const user = userEvent.setup();
    mockFetchCandles.mockResolvedValue(makeCandles(5));
    render(<ChartWidget />);
    await waitFor(() => {
      expect(mockFetchCandles).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "1h" }));
    await waitFor(() => {
      expect(mockFetchCandles).toHaveBeenCalledWith("binance", "BTC/USDT", "1h");
    });
  });

  it("renders all timeframe buttons", () => {
    mockFetchCandles.mockResolvedValue(makeCandles(1));
    render(<ChartWidget />);
    expect(screen.getByText("1m")).toBeInTheDocument();
    expect(screen.getByText("5m")).toBeInTheDocument();
    expect(screen.getByText("15m")).toBeInTheDocument();
    expect(screen.getByText("1h")).toBeInTheDocument();
    expect(screen.getByText("4h")).toBeInTheDocument();
    expect(screen.getByText("1d")).toBeInTheDocument();
  });
});
