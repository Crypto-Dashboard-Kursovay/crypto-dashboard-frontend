import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const store = new Map<string, string>();
const storageMock: Storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
  get length() { return store.size; },
  key: (index: number) => Array.from(store.keys())[index] ?? null,
};
vi.stubGlobal("localStorage", storageMock);

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockResponse(data: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(data),
    clone() { return this; },
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

import * as candlesApi from "../api/candles";
import * as positionsApi from "../api/positions";
import * as balancesApi from "../api/balances";
import * as tradesApi from "../api/trades";
import * as botsApi from "../api/bots";
import * as credentialsApi from "../api/credentials";
import * as exchangesApi from "../api/exchanges";
import * as authApi from "../api/auth";
import * as backtestApi from "../api/backtest";
import { apiFetch, clearTokens, getAccessToken, getRefreshToken, setTokens, ApiHttpError } from "../api/client";

function setupTokens() {
  store.clear();
  store.set("crypto.access_token", "test-access");
  store.set("crypto.refresh_token", "test-refresh");
}

describe("API modules", () => {
  beforeEach(() => {
    setupTokens();
    mockFetch.mockClear();
  });

  afterEach(() => {
    store.clear();
  });

  // ------------- candles -------------
  describe("candles.fetchCandles", () => {
    it("fetches candles with correct path", async () => {
      mockResponse([{ timestamp: "2026-01-01T00:00:00Z", open: "100", high: "110", low: "90", close: "105", volume: "1000" }]);
      const result = await candlesApi.fetchCandles("binance", "BTC/USDT", "15m", 50);
      expect(result).toHaveLength(1);
      expect(result[0].close).toBe("105");
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/api/candles/binance/BTC/USDT/15m");
      expect(url).toContain("limit=50");
    });
  });

  // ------------- positions -------------
  describe("positions.listPositions", () => {
    it("fetches positions with credential_id", async () => {
      mockResponse([{ id: "p1", credential_id: "c1", symbol: "BTC/USDT", side: "buy", entry_price: "95000", size: "0.1", current_pnl: "100", observed_at: "2026-01-01T00:00:00Z" }]);
      const result = await positionsApi.listPositions("c1");
      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe("BTC/USDT");
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("credential_id=c1");
    });
  });

  // ------------- balances -------------
  describe("balances", () => {
    it("fetchBalanceSummary fetches balance summary", async () => {
      mockResponse({ total_equity: "10000", free_total: "8000", used_total: "2000", currencies: [], open_pnl: "50", position_count: 1 });
      const result = await balancesApi.fetchBalanceSummary();
      expect(result.total_equity).toBe("10000");
      expect(result.position_count).toBe(1);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/api/balances/summary");
    });

    it("listBalances fetches with credential_id", async () => {
      mockResponse([{ credential_id: "c1", currency: "USDT", free: "1000", used: "200", total: "1200", observed_at: "2026-01-01T00:00:00Z" }]);
      const result = await balancesApi.listBalances("c1");
      expect(result).toHaveLength(1);
      expect(result[0].currency).toBe("USDT");
    });
  });

  // ------------- trades -------------
  describe("trades", () => {
    it("fetches trades with params", async () => {
      mockResponse([{ id: "t1", bot_id: "b1", symbol: "BTC/USDT", side: "buy", size: "0.01", price: "95000", fee: "0.95", strategy: "macd", created_at: "2026-01-01T00:00:00Z" }]);
      const result = await tradesApi.listTrades({ limit: 5, bot_id: "b1" });
      expect(result).toHaveLength(1);
      expect(result[0].price).toBe("95000");
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("limit=5");
      expect(url).toContain("bot_id=b1");
    });

    it("fetches trades with no params", async () => {
      mockResponse([]);
      await tradesApi.listTrades();
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe("/api/trades");
    });

    it("uses from/to params", async () => {
      mockResponse([]);
      await tradesApi.listTrades({ from: "2026-01-01T00:00:00Z", to: "2026-01-02T00:00:00Z" });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("from=2026-01-01T00%3A00%3A00Z");
      expect(url).toContain("to=2026-01-02T00%3A00%3A00Z");
    });
  });

  // ------------- bots -------------
  describe("bots", () => {
    it("listBots fetches all bots", async () => {
      mockResponse([{ id: "1", credential_id: "c1", strategy_class: "macd", symbol: "BTC/USDT", timeframe: "15m", params: {}, status: "running", created_at: "", updated_at: "" }]);
      const result = await botsApi.listBots();
      expect(result).toHaveLength(1);
      expect(result[0].strategy_class).toBe("macd");
    });

    it("createBot sends POST", async () => {
      mockResponse({ id: "1", credential_id: "c1", strategy_class: "macd", symbol: "BTC/USDT", timeframe: "15m", params: {}, status: "draft", created_at: "", updated_at: "" });
      await botsApi.createBot({ credential_id: "c1", strategy_class: "macd", symbol: "BTC/USDT", timeframe: "15m", params: {} });
      expect(mockFetch.mock.calls[0][1].method).toBe("POST");
    });

    it("startBot sends POST", async () => {
      mockResponse({ id: "1", credential_id: "c1", strategy_class: "macd", symbol: "BTC/USDT", timeframe: "15m", params: {}, status: "starting", created_at: "", updated_at: "" });
      await botsApi.startBot("1");
      expect(mockFetch.mock.calls[0][1].method).toBe("POST");
    });

    it("stopBot sends POST with closePositions flag", async () => {
      mockResponse({ id: "1", credential_id: "c1", strategy_class: "macd", symbol: "BTC/USDT", timeframe: "15m", params: {}, status: "stopping", created_at: "", updated_at: "" });
      await botsApi.stopBot("1", true);
      expect(mockFetch.mock.calls[0][1].body).toContain('"close_positions":true');
    });

    it("stopBot default closePositions false", async () => {
      mockResponse({ id: "1", credential_id: "c1", strategy_class: "macd", symbol: "BTC/USDT", timeframe: "15m", params: {}, status: "stopping", created_at: "", updated_at: "" });
      await botsApi.stopBot("1");
      expect(mockFetch.mock.calls[0][1].body).toContain('"close_positions":false');
    });

    it("updateBotParams sends PATCH", async () => {
      mockResponse({ id: "1", credential_id: "c1", strategy_class: "macd", symbol: "BTC/USDT", timeframe: "15m", params: { period: 14 }, status: "running", created_at: "", updated_at: "" });
      await botsApi.updateBotParams("1", { period: 14 });
      expect(mockFetch.mock.calls[0][1].method).toBe("PATCH");
    });

    it("deleteBot sends DELETE", async () => {
      mockResponse(undefined, 204);
      await botsApi.deleteBot("1");
      expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
    });

    it("getBot fetches single bot", async () => {
      mockResponse({ id: "1", credential_id: "c1", strategy_class: "macd", symbol: "BTC/USDT", timeframe: "15m", params: {}, status: "running", created_at: "", updated_at: "" });
      const result = await botsApi.getBot("1");
      expect(result.id).toBe("1");
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/api/bots/1");
    });
  });

  // ------------- credentials -------------
  describe("credentials", () => {
    it("listCredentials fetches all", async () => {
      mockResponse([{ id: "c1", exchange: "binance", label: "main", created_at: "" }]);
      const result = await credentialsApi.listCredentials();
      expect(result).toHaveLength(1);
      expect(result[0].exchange).toBe("binance");
    });

    it("createCredential sends POST", async () => {
      mockResponse({ id: "c1", exchange: "binance", label: "main", created_at: "" });
      await credentialsApi.createCredential({ exchange: "binance", label: "main", api_key: "k", api_secret: "s" });
      expect(mockFetch.mock.calls[0][1].method).toBe("POST");
    });

    it("deleteCredential sends DELETE", async () => {
      mockResponse(undefined, 204);
      await credentialsApi.deleteCredential("c1");
      expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
    });
  });

  // ------------- exchanges -------------
  describe("exchanges", () => {
    it("listSupportedExchanges fetches all", async () => {
      mockResponse([{ name: "binance", display_name: "Binance", requires_passphrase: false, supports_testnet: true }]);
      const result = await exchangesApi.listSupportedExchanges();
      expect(result).toHaveLength(1);
    });

    it("listExchangeSymbols fetches symbols", async () => {
      mockResponse(["BTC/USDT", "ETH/USDT"]);
      const result = await exchangesApi.listExchangeSymbols("binance");
      expect(result).toHaveLength(2);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/api/exchanges/binance/symbols");
    });

    it("listExchangeSymbols encodes name", async () => {
      mockResponse([]);
      await exchangesApi.listExchangeSymbols("binance");
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("binance");
    });
  });

  // ------------- auth -------------
  describe("auth", () => {
    it("requestEmailCode sends POST with skipAuthRetry", async () => {
      mockResponse({ status: "sent" });
      await authApi.requestEmailCode("test@test.com", "captcha123");
      const [url, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe("POST");
      expect(opts.body).toContain("test@test.com");
      expect(opts.body).toContain("captcha123");
      expect(url).toContain("/api/auth/email/request");
    });

    it("verifyEmailCode sends POST and stores tokens", async () => {
      mockResponse({ access_token: "at", refresh_token: "rt" });
      const pair = await authApi.verifyEmailCode("test@test.com", "123456");
      expect(pair.access_token).toBe("at");
      expect(pair.refresh_token).toBe("rt");
      const [url, opts] = mockFetch.mock.calls[0];
      expect(opts.body).toContain("123456");
      expect(localStorage.getItem("crypto.access_token")).toBe("at");
      expect(localStorage.getItem("crypto.refresh_token")).toBe("rt");
    });

    it("getTelegramWidgetConfig fetches config", async () => {
      mockResponse({ bot_id: 123, bot_username: "mybot" });
      const cfg = await authApi.getTelegramWidgetConfig();
      expect(cfg.bot_id).toBe(123);
      expect(cfg.bot_username).toBe("mybot");
    });

    it("loginWithTelegramPayload sends POST and stores tokens", async () => {
      mockResponse({ access_token: "at2", refresh_token: "rt2" });
      const pair = await authApi.loginWithTelegramPayload({
        id: 456, first_name: "John", auth_date: 1700000000, hash: "abc",
      });
      expect(pair.access_token).toBe("at2");
      expect(localStorage.getItem("crypto.access_token")).toBe("at2");
    });

    it("me fetches current user", async () => {
      mockResponse({ id: "u1", email: "test@test.com", role: "trader", is_active: true });
      const user = await authApi.me();
      expect(user.email).toBe("test@test.com");
      expect(user.role).toBe("trader");
    });

    it("logout clears tokens", () => {
      store.set("crypto.access_token", "x");
      store.set("crypto.refresh_token", "y");
      authApi.logout();
      expect(localStorage.getItem("crypto.access_token")).toBeNull();
      expect(localStorage.getItem("crypto.refresh_token")).toBeNull();
    });

    it("consumeCallbackTokens stores tokens", () => {
      authApi.consumeCallbackTokens("at3", "rt3");
      expect(localStorage.getItem("crypto.access_token")).toBe("at3");
      expect(localStorage.getItem("crypto.refresh_token")).toBe("rt3");
    });

    it("getOAuthStartUrl returns correct path", () => {
      expect(authApi.getOAuthStartUrl("google")).toBe("/api/auth/google/start");
      expect(authApi.getOAuthStartUrl("github")).toBe("/api/auth/github/start");
    });
  });

  // ------------- backtest -------------
  describe("backtest", () => {
    it("runBacktest sends POST", async () => {
      mockResponse({ id: "j1", status: "queued", strategy_class: "macd", symbol: "BTC/USDT", timeframe: "15m", params: {}, date_from: "2026-01-01T00:00:00Z", date_to: "2026-02-01T00:00:00Z", initial_balance: { USDT: "10000" }, result: null, error_message: null, created_at: "", completed_at: null });
      const result = await backtestApi.runBacktest({
        strategy_class: "macd", symbol: "BTC/USDT", timeframe: "15m",
        params: {}, date_from: "2026-01-01T00:00:00Z", date_to: "2026-02-01T00:00:00Z",
        initial_balance: { USDT: "10000" },
      });
      expect(result.id).toBe("j1");
      expect(mockFetch.mock.calls[0][1].method).toBe("POST");
    });

    it("getBacktest fetches by id", async () => {
      mockResponse({ id: "j1", status: "completed", strategy_class: "macd", symbol: "BTC/USDT", timeframe: "15m", params: {}, date_from: "", date_to: "", initial_balance: {}, result: null, error_message: null, created_at: "", completed_at: null });
      const result = await backtestApi.getBacktest("j1");
      expect(result.id).toBe("j1");
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/api/backtest/j1");
    });

    it("listBacktests fetches with default limit", async () => {
      mockResponse([]);
      await backtestApi.listBacktests();
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("limit=20");
    });

    it("listBacktests fetches with custom limit", async () => {
      mockResponse([]);
      await backtestApi.listBacktests(5);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("limit=5");
    });

    it("deleteBacktest sends DELETE", async () => {
      mockResponse(undefined, 204);
      await backtestApi.deleteBacktest("j1");
      expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/api/backtest/j1");
    });
  });

  // ------------- health (direct fetch) -------------
  describe("health.fetchHealth", () => {
    it("fetches health status", async () => {
      const { fetchHealth } = await import("../api/health");
      mockResponse({ backend: "ok", postgres: "ok", redis: "ok" });
      const result = await fetchHealth();
      expect(result.backend).toBe("ok");
      expect(result.postgres).toBe("ok");
      expect(result.redis).toBe("ok");
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/healthz");
    });

    it("returns unknown for missing fields", async () => {
      const { fetchHealth } = await import("../api/health");
      mockResponse({});
      const result = await fetchHealth();
      expect(result.backend).toBe("unknown");
      expect(result.postgres).toBe("unknown");
      expect(result.redis).toBe("unknown");
    });
  });

  // ------------- client (token management) -------------
  describe("client token management", () => {
    it("getAccessToken returns stored token", () => {
      store.set("crypto.access_token", "tok");
      expect(getAccessToken()).toBe("tok");
    });

    it("getAccessToken returns null when not set", () => {
      store.delete("crypto.access_token");
      expect(getAccessToken()).toBeNull();
    });

    it("getRefreshToken returns stored token", () => {
      store.set("crypto.refresh_token", "ref");
      expect(getRefreshToken()).toBe("ref");
    });

    it("setTokens stores both tokens", () => {
      setTokens("a", "b");
      expect(store.get("crypto.access_token")).toBe("a");
      expect(store.get("crypto.refresh_token")).toBe("b");
    });

    it("clearTokens removes both", () => {
      setTokens("a", "b");
      clearTokens();
      expect(localStorage.getItem("crypto.access_token")).toBeNull();
      expect(localStorage.getItem("crypto.refresh_token")).toBeNull();
    });

    it("apiFetch includes auth header", async () => {
      store.set("crypto.access_token", "tok123");
      mockResponse({ ok: true });
      await apiFetch("/api/bots");
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers).toHaveProperty("Authorization", "Bearer tok123");
    });

    it("apiFetch sends body as JSON", async () => {
      mockResponse({ ok: true });
      await apiFetch("/api/bots", { method: "POST", body: JSON.stringify({ x: 1 }) });
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe("POST");
      expect(opts.body).toContain('"x":1');
    });

    it("apiFetch handles 204 with undefined return", async () => {
      mockResponse(undefined, 204);
      const result = await apiFetch("/api/bots/1", { method: "DELETE" });
      expect(result).toBeUndefined();
    });

    it("apiFetch throws ApiHttpError on error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.resolve({ detail: "Something broke" }),
        clone() { return this; },
        text: () => Promise.resolve('{"detail":"Something broke"}'),
      });
      await expect(apiFetch("/api/test")).rejects.toThrow(ApiHttpError);
    });

    it("apiFetch throws ApiHttpError with text-only body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: () => Promise.reject(new Error("not json")),
        clone() { return this; },
        text: () => Promise.resolve("plain text error"),
      });
      await expect(apiFetch("/api/test")).rejects.toThrow(ApiHttpError);
    });

    it("getOAuthStartUrl builds correct URL", () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const url = authApi.getOAuthStartUrl("yandex");
      expect(url).toBe("/api/auth/yandex/start");
    });
  });
});
