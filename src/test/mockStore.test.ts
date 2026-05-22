import { describe, it, expect, vi } from "vitest";

import { mockStore } from "../mock/store";
import { MOCK_EXCHANGES, MOCK_SYMBOL_NAMES } from "../mock/config";

// Стор — singleton, поэтому проверяем инвариантные свойства уже инициализированной
// сессии (порядок тестов не важен — все опираются на один и тот же стор).

describe("mockStore — сессия", () => {
  it("создаёт по ключу на каждую биржу (все биржи подключены)", () => {
    const creds = mockStore.getCredentials();
    expect(creds.length).toBe(MOCK_EXCHANGES.length);
    for (const ex of MOCK_EXCHANGES) {
      expect(creds.some((c) => c.exchange === ex.name)).toBe(true);
    }
  });

  it("генерирует от 5 до 15 стратегий", () => {
    const bots = mockStore.getBots();
    expect(bots.length).toBeGreaterThanOrEqual(5);
    expect(bots.length).toBeLessThanOrEqual(15);
  });

  it("у каждой активной стратегии есть открытая позиция, и число сходится с балансом", () => {
    const bots = mockStore.getBots();
    const running = bots.filter((b) => b.status === "running");
    const allPositions = mockStore
      .getCredentials()
      .flatMap((c) => mockStore.getPositions(c.id));
    expect(allPositions.length).toBe(running.length);
    expect(mockStore.getBalanceSummary().position_count).toBe(allPositions.length);
  });

  it("health всегда ok", () => {
    expect(mockStore.getHealth()).toEqual({ backend: "ok", postgres: "ok", redis: "ok" });
  });

  it("getCandles отдаёт запрошенное число свечей с числовыми строками", () => {
    const candles = mockStore.getCandles(MOCK_SYMBOL_NAMES[0], "1h", 50);
    expect(candles).toHaveLength(50);
    expect(Number.isNaN(Number(candles[0].close))).toBe(false);
  });
});

describe("mockStore — тик", () => {
  it("двигает equity и иногда добавляет сделки/логи", () => {
    const before = mockStore.getTrades().length;
    let logsSeen = 0;
    let tradesAdded = 0;
    for (let i = 0; i < 200; i++) {
      const logs = mockStore.tick();
      logsSeen += logs.length;
    }
    tradesAdded = mockStore.getTrades().length - before;
    expect(logsSeen).toBeGreaterThan(0);
    expect(tradesAdded).toBeGreaterThan(0);
  });
});

describe("mockStore — мутации без сети", () => {
  it("createBot → startBot открывает позицию, stopBot закрывает, deleteBot убирает", () => {
    const cred = mockStore.getCredentials()[0];
    const created = mockStore.createBot({
      credential_id: cred.id,
      strategy_class: "SmaCross",
      symbol: MOCK_SYMBOL_NAMES[0],
      timeframe: "1m",
      params: { fast_period: 5, slow_period: 20, order_size: "0.001" },
    });
    expect(mockStore.getBots().some((b) => b.id === created.id)).toBe(true);

    const posBefore = mockStore.getPositions(cred.id).length;
    mockStore.startBot(created.id);
    expect(mockStore.getPositions(cred.id).length).toBe(posBefore + 1);

    mockStore.stopBot(created.id);
    expect(mockStore.getPositions(cred.id).length).toBe(posBefore);

    mockStore.deleteBot(created.id);
    expect(mockStore.getBots().some((b) => b.id === created.id)).toBe(false);
  });

  it("updateBotParams сливает параметры", () => {
    const bot = mockStore.getBots()[0];
    const updated = mockStore.updateBotParams(bot.id, { custom_param: "42" });
    expect(updated.params.custom_param).toBe("42");
  });

  it("runBacktest стартует как running и завершается по истечении расчётного времени", () => {
    vi.useFakeTimers();
    try {
      const job = mockStore.runBacktest({
        strategy_class: "SmaCross",
        exchange: "binance",
        symbol: MOCK_SYMBOL_NAMES[0],
        timeframe: "1h",
        params: {},
        date_from: "2026-01-01T00:00:00Z",
        date_to: "2026-02-01T00:00:00Z",
        initial_balance: { USDT: "1000" },
      });
      expect(job.status).toBe("running");
      expect(job.result).toBeNull();

      // До завершения — всё ещё running.
      vi.advanceTimersByTime(500);
      expect(mockStore.getBacktest(job.id).status).toBe("running");

      // После расчётного времени — completed с метриками.
      vi.advanceTimersByTime(15000);
      const done = mockStore.getBacktest(job.id);
      expect(done.status).toBe("completed");
      expect(done.result).not.toBeNull();
      expect(done.result!.equity_curve.length).toBeGreaterThan(0);
      expect(done.result!.trades.length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("длительность прогона растёт при более мелком таймфрейме / длинном периоде", () => {
    vi.useFakeTimers();
    try {
      const base = {
        strategy_class: "SmaCross",
        exchange: "binance",
        symbol: MOCK_SYMBOL_NAMES[0],
        params: {},
        initial_balance: { USDT: "1000" },
      };
      const slow = mockStore.runBacktest({
        ...base,
        timeframe: "1m",
        date_from: "2026-01-01T00:00:00Z",
        date_to: "2026-03-01T00:00:00Z",
      });
      const fast = mockStore.runBacktest({
        ...base,
        timeframe: "1d",
        date_from: "2026-01-01T00:00:00Z",
        date_to: "2026-01-10T00:00:00Z",
      });
      // Через 2с мелкий ТФ за длинный период ещё бежит, а крупный за неделю готов.
      vi.advanceTimersByTime(2000);
      expect(mockStore.getBacktest(slow.id).status).toBe("running");
      expect(mockStore.getBacktest(fast.id).status).toBe("completed");
    } finally {
      vi.useRealTimers();
    }
  });
});
