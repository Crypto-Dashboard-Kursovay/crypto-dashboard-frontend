import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Dashboard } from "../app/pages/Dashboard";

vi.mock("../api/balances", () => ({
  fetchBalanceSummary: () => new Promise(() => {}),
}));
vi.mock("../api/trades", () => ({
  listTrades: () => new Promise(() => {}),
}));
vi.mock("../api/bots", () => ({
  listBots: () => new Promise(() => {}),
}));
vi.mock("../api/health", () => ({
  fetchHealth: () => new Promise(() => {}),
}));
vi.mock("../api/candles", () => ({
  fetchCandles: () => new Promise(() => {}),
}));
vi.mock("../api/client", () => ({
  apiFetch: () => new Promise(() => {}),
  ApiHttpError: class ApiHttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

describe("Dashboard", () => {
  it("renders all widget sections", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(screen.getByText("Баланс и P&L")).toBeInTheDocument();
    expect(screen.getByText("Открытые позиции")).toBeInTheDocument();
    expect(screen.getByText("История последних сделок")).toBeInTheDocument();
  });

  it("renders Grid container", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Dashboard />
      </MemoryRouter>,
    );
    const grid = container.querySelector(".MuiGrid-container");
    expect(grid).toBeInTheDocument();
  });
});
