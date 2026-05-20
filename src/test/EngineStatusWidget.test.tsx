import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { EngineStatusWidget } from "../app/components/dashboard/EngineStatusWidget";
import * as botsApi from "../api/bots";
import * as healthApi from "../api/health";
import type { BotOut } from "../api/types";
import type { HealthStatus } from "../api/health";

vi.mock("../api/bots");
vi.mock("../api/health");

const mockListBots = vi.mocked(botsApi.listBots);
const mockFetchHealth = vi.mocked(healthApi.fetchHealth);

function makeBot(overrides: Partial<BotOut> = {}): BotOut {
  return {
    id: "bot-1", credential_id: "c1", strategy_class: "macd_cross",
    symbol: "BTC/USDT", timeframe: "15m", params: {}, status: "running",
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeHealth(overrides: Partial<HealthStatus> = {}): HealthStatus {
  return { backend: "ok", postgres: "ok", redis: "ok", ...overrides };
}

describe("EngineStatusWidget", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function renderWidget() {
    return render(
      <MemoryRouter initialEntries={["/"]}>
        <EngineStatusWidget />
      </MemoryRouter>,
    );
  }

  it("shows loading spinners initially", () => {
    mockListBots.mockReturnValue(new Promise(() => {}));
    mockFetchHealth.mockRejectedValue(new Error("x"));
    renderWidget();
    const spinners = screen.getAllByRole("progressbar");
    expect(spinners.length).toBeGreaterThanOrEqual(1);
  });

  it("shows all healthy when checks pass", async () => {
    mockListBots.mockResolvedValue([]);
    mockFetchHealth.mockResolvedValue(makeHealth());
    renderWidget();
    await waitFor(() => {
      expect(screen.getByText("Работает")).toBeInTheDocument();
      expect(screen.getByText("Backend")).toBeInTheDocument();
      expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
      expect(screen.getByText("Redis")).toBeInTheDocument();
    });
  });

  it("shows problem when backend is down", async () => {
    mockListBots.mockResolvedValue([]);
    mockFetchHealth.mockResolvedValue(makeHealth({ backend: "error: boom" }));
    renderWidget();
    await waitFor(() => {
      expect(screen.getByText("Проблема")).toBeInTheDocument();
    });
  });

  it("shows active strategies list", async () => {
    mockFetchHealth.mockResolvedValue(makeHealth());
    mockListBots.mockResolvedValue([
      makeBot({ id: "1", symbol: "BTC/USDT", strategy_class: "macd_cross", status: "running" }),
    ]);
    renderWidget();
    await waitFor(() => {
      expect(screen.getByText("BTC/USDT")).toBeInTheDocument();
      expect(screen.getByText("macd_cross")).toBeInTheDocument();
    });
  });

  it("shows no running strategies message", async () => {
    mockFetchHealth.mockResolvedValue(makeHealth());
    mockListBots.mockResolvedValue([]);
    renderWidget();
    await waitFor(() => {
      expect(screen.getByText("Нет запущенных стратегий")).toBeInTheDocument();
    });
  });

  it("shows Проверяем while health unknown", async () => {
    mockFetchHealth.mockReturnValue(new Promise(() => {}));
    mockListBots.mockResolvedValue([]);
    renderWidget();
    await waitFor(() => {
      expect(screen.getByText("Проверяем...")).toBeInTheDocument();
    });
  });

  it("shows link to strategies", async () => {
    mockFetchHealth.mockResolvedValue(makeHealth());
    mockListBots.mockResolvedValue([]);
    renderWidget();
    await waitFor(() => {
      expect(screen.getByText(/Показать все/)).toBeInTheDocument();
    });
  });

  it("handles both fetches rejecting", async () => {
    mockFetchHealth.mockRejectedValue(new Error("down"));
    mockListBots.mockRejectedValue(new Error("fail"));
    renderWidget();
    await waitFor(() => {
      expect(screen.getByText("Проверяем...")).toBeInTheDocument();
    });
  });

  it("shows counter labels", async () => {
    mockFetchHealth.mockResolvedValue(makeHealth());
    mockListBots.mockResolvedValue([]);
    renderWidget();
    await waitFor(() => {
      expect(screen.getByText("Активных")).toBeInTheDocument();
      expect(screen.getByText("В очереди")).toBeInTheDocument();
      expect(screen.getByText("С ошибкой")).toBeInTheDocument();
    });
  });
});
