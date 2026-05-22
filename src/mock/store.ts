// Singleton-стор демо-режима.
//
// Обычный TS-модуль (не React), чтобы тонкие функции из src/api/*.ts могли читать
// его синхронно из любого места. Держит «сессию»: фиктивные ключи бирж, 5–15
// стратегий, открытые позиции, баланс, историю сделок и бэктесты. Никаких сетевых
// вызовов — мутации меняют только память процесса, поэтому действия пользователя в
// демо-режиме гарантированно НЕ дёргают движок/биржи.

import type {
  BalanceOut,
  BalanceSummaryOut,
  BotOut,
  CandleOut,
  CredentialOut,
  ExchangeMeta,
  PositionOut,
} from "../api/types";
import type { TradeOut, ListTradesParams } from "../api/trades";
import type {
  BacktestJobOut,
  BacktestJobSummary,
  BacktestResult,
  BacktestRunIn,
  BacktestTrade,
  EquityPoint,
} from "../api/backtest";
import {
  MOCK_EXCHANGES,
  MOCK_STRATEGIES,
  MOCK_SYMBOL_NAMES,
  MOCK_TIMEFRAMES,
  basePriceOf,
  defaultStrategyParams,
} from "./config";
import {
  chance,
  decStr,
  generateCandles,
  pickRandom,
  priceDigits,
  randFloat,
  randInt,
  uuid,
} from "./generators";

/** Лог-строка для инъекции в LogsContext (форма Omit<LogLine,"id">). */
export interface MockLogLine {
  time: string;
  level: "INFO" | "WARNING" | "ERROR";
  source: string;
  message: string;
}

interface MockPosition {
  id: string;
  bot_id: string;
  credential_id: string;
  symbol: string;
  side: "buy" | "sell";
  entryPrice: number;
  size: number;
}

const RUNNING_RATIO = 0.78; // доля изначально активных стратегий
const MAX_TRADES = 500;

class MockStore {
  private initialized = false;

  private credentials: CredentialOut[] = [];
  private bots: BotOut[] = [];
  private positions: MockPosition[] = [];
  private markPrices: Record<string, number> = {};
  private trades: TradeOut[] = [];
  private backtests = new Map<string, BacktestJobOut>();
  private freeCash = 10000;

  // ── Сессия ────────────────────────────────────────────────────────────────

  private ensureSession(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Цены-маркеры с лёгким разбросом от базовых.
    for (const symbol of MOCK_SYMBOL_NAMES) {
      this.markPrices[symbol] = basePriceOf(symbol) * randFloat(0.92, 1.08);
    }

    // По одному фиктивному ключу на каждую биржу ⇒ «все биржи подключены».
    const now = Date.now();
    this.credentials = MOCK_EXCHANGES.map((ex, i) => ({
      id: uuid(),
      exchange: ex.name,
      label: ex.display_name,
      created_at: new Date(now - (i + 1) * 86_400_000).toISOString(),
    }));

    this.freeCash = randFloat(6000, 16000);

    // 5–15 случайных стратегий.
    const count = randInt(5, 15);
    for (let i = 0; i < count; i++) {
      const cred = pickRandom(this.credentials);
      const strategy = pickRandom(MOCK_STRATEGIES);
      const symbol = pickRandom(MOCK_SYMBOL_NAMES);
      const timeframe = pickRandom(MOCK_TIMEFRAMES);
      const running = chance(RUNNING_RATIO);
      const status = running ? "running" : pickRandom(["stopped", "error"] as const);
      const createdAt = new Date(now - randInt(1, 240) * 60_000).toISOString();
      const bot: BotOut = {
        id: uuid(),
        credential_id: cred.id,
        strategy_class: strategy,
        symbol,
        timeframe,
        params: defaultStrategyParams(strategy),
        status,
        created_at: createdAt,
        updated_at: createdAt,
      };
      this.bots.push(bot);
      if (status === "running") this.openPosition(bot);
    }

    // Стартовая история сделок за последние ~6 часов.
    const seedTrades = randInt(20, 45);
    for (let i = 0; i < seedTrades; i++) {
      const bot = pickRandom(this.bots);
      const at = new Date(now - randInt(1, 360) * 60_000).toISOString();
      this.trades.push(this.makeTrade(bot, at));
    }
    this.trades.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  private openPosition(bot: BotOut): void {
    const price = this.markPrices[bot.symbol] ?? basePriceOf(bot.symbol);
    const notional = randFloat(250, 3500); // USDT
    const size = notional / price;
    this.positions.push({
      id: uuid(),
      bot_id: bot.id,
      credential_id: bot.credential_id,
      symbol: bot.symbol,
      side: chance(0.7) ? "buy" : "sell",
      entryPrice: price * randFloat(0.97, 1.03),
      size,
    });
  }

  private makeTrade(bot: BotOut, at: string): TradeOut {
    const price = this.markPrices[bot.symbol] ?? basePriceOf(bot.symbol);
    const dg = priceDigits(price);
    const size = randFloat(0.001, 0.5);
    const fillPrice = price * randFloat(0.995, 1.005);
    return {
      id: uuid(),
      bot_id: bot.id,
      symbol: bot.symbol,
      side: chance(0.5) ? "buy" : "sell",
      size: decStr(size, 6),
      price: decStr(fillPrice, dg),
      fee: decStr(size * fillPrice * 0.001, 4),
      strategy: bot.strategy_class,
      created_at: at,
    };
  }

  private pnlOf(p: MockPosition): number {
    const mark = this.markPrices[p.symbol] ?? p.entryPrice;
    const dir = p.side === "buy" ? 1 : -1;
    return (mark - p.entryPrice) * p.size * dir;
  }

  // ── Тик (двигает рынок, иногда сделка/лог) ──────────────────────────────────

  tick(): MockLogLine[] {
    this.ensureSession();
    const logs: MockLogLine[] = [];

    // Случайное блуждание цен-маркеров ⇒ колебание PnL и equity в обе стороны.
    for (const symbol of Object.keys(this.markPrices)) {
      this.markPrices[symbol] *= 1 + randFloat(-0.004, 0.004);
    }

    const running = this.bots.filter((b) => b.status === "running");

    // Периодически — новая сделка от случайной активной стратегии.
    if (running.length > 0 && chance(0.45)) {
      const bot = pickRandom(running);
      const trade = this.makeTrade(bot, new Date().toISOString());
      this.trades.push(trade);
      if (this.trades.length > MAX_TRADES) {
        this.trades = this.trades.slice(this.trades.length - MAX_TRADES);
      }
      logs.push({
        time: trade.created_at,
        level: "INFO",
        source: "new_trade",
        message: `${trade.side.toUpperCase()} ${trade.symbol} size=${trade.size} price=${trade.price} (${trade.strategy})`,
      });
    }

    // Периодически — служебный лог движка.
    if (chance(0.4)) {
      if (running.length > 0 && chance(0.7)) {
        const bot = pickRandom(running);
        logs.push({
          time: new Date().toISOString(),
          level: "INFO",
          source: "engine",
          message: `[${bot.strategy_class}] оценка свечи ${bot.symbol} ${bot.timeframe} — сигнала нет`,
        });
      } else {
        logs.push({
          time: new Date().toISOString(),
          level: "INFO",
          source: "balance_update",
          message: "Снапшот баланса обновлён",
        });
      }
    }

    // Изредка — предупреждение.
    if (chance(0.05) && running.length > 0) {
      const bot = pickRandom(running);
      logs.push({
        time: new Date().toISOString(),
        level: "WARNING",
        source: "strategy_error",
        message: `[${bot.strategy_class}] высокая волатильность ${bot.symbol}, ордер отложен`,
      });
    }

    return logs;
  }

  // ── Геттеры (форма DTO бэка) ────────────────────────────────────────────────

  getCredentials(): CredentialOut[] {
    this.ensureSession();
    return [...this.credentials];
  }

  addCredential(body: { exchange: string; label?: string }): CredentialOut {
    this.ensureSession();
    const cred: CredentialOut = {
      id: uuid(),
      exchange: body.exchange,
      label: body.label || body.exchange,
      created_at: new Date().toISOString(),
    };
    this.credentials.push(cred);
    return { ...cred };
  }

  removeCredential(id: string): void {
    this.ensureSession();
    this.credentials = this.credentials.filter((c) => c.id !== id);
    this.bots = this.bots.filter((b) => b.credential_id !== id);
    this.positions = this.positions.filter((p) => p.credential_id !== id);
  }

  getSupportedExchanges(): ExchangeMeta[] {
    return [...MOCK_EXCHANGES];
  }

  getExchangeSymbols(): string[] {
    return [...MOCK_SYMBOL_NAMES];
  }

  getBots(): BotOut[] {
    this.ensureSession();
    return this.bots.map((b) => ({ ...b }));
  }

  getBot(id: string): BotOut {
    this.ensureSession();
    const bot = this.bots.find((b) => b.id === id);
    if (!bot) throw new Error("bot not found");
    return { ...bot };
  }

  getPositions(credentialId: string): PositionOut[] {
    this.ensureSession();
    const at = new Date().toISOString();
    return this.positions
      .filter((p) => p.credential_id === credentialId)
      .map((p) => {
        const dg = priceDigits(p.entryPrice);
        return {
          id: p.id,
          credential_id: p.credential_id,
          symbol: p.symbol,
          side: p.side,
          entry_price: decStr(p.entryPrice, dg),
          size: decStr(p.size, 6),
          current_pnl: decStr(this.pnlOf(p), 2),
          observed_at: at,
        } satisfies PositionOut;
      });
  }

  getBalanceSummary(): BalanceSummaryOut {
    this.ensureSession();
    const used = this.positions.reduce((s, p) => s + p.entryPrice * p.size, 0);
    const openPnl = this.positions.reduce((s, p) => s + this.pnlOf(p), 0);
    const equity = this.freeCash + used + openPnl;
    const at = new Date().toISOString();
    return {
      total_equity: decStr(equity, 2),
      free_total: decStr(this.freeCash, 2),
      used_total: decStr(used, 2),
      currencies: [
        {
          credential_id: this.credentials[0]?.id ?? "",
          currency: "USDT",
          free: decStr(this.freeCash, 2),
          used: decStr(used, 2),
          total: decStr(equity, 2),
          observed_at: at,
        },
      ],
      open_pnl: decStr(openPnl, 2),
      position_count: this.positions.length,
      last_observed_at: at,
    };
  }

  getBalances(credentialId: string): BalanceOut[] {
    this.ensureSession();
    const used = this.positions
      .filter((p) => p.credential_id === credentialId)
      .reduce((s, p) => s + p.entryPrice * p.size, 0);
    const free = this.freeCash / (this.credentials.length || 1);
    const at = new Date().toISOString();
    return [
      {
        credential_id: credentialId,
        currency: "USDT",
        free: decStr(free, 2),
        used: decStr(used, 2),
        total: decStr(free + used, 2),
        observed_at: at,
      },
    ];
  }

  getTrades(params: ListTradesParams = {}): TradeOut[] {
    this.ensureSession();
    let out = [...this.trades];
    if (params.bot_id) out = out.filter((t) => t.bot_id === params.bot_id);
    if (params.from) out = out.filter((t) => t.created_at >= params.from!);
    if (params.to) out = out.filter((t) => t.created_at <= params.to!);
    // Свежие сверху.
    out.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (params.limit !== undefined) out = out.slice(0, params.limit);
    return out;
  }

  getCandles(symbol: string, timeframe: string, limit: number): CandleOut[] {
    this.ensureSession();
    const last = this.markPrices[symbol] ?? basePriceOf(symbol);
    return generateCandles(last, timeframe, limit);
  }

  getHealth(): { backend: string; postgres: string; redis: string } {
    return { backend: "ok", postgres: "ok", redis: "ok" };
  }

  // ── Мутации (без сети) ──────────────────────────────────────────────────────

  createBot(body: {
    credential_id: string;
    strategy_class: string;
    symbol: string;
    timeframe: string;
    params: Record<string, unknown>;
  }): BotOut {
    this.ensureSession();
    const at = new Date().toISOString();
    const bot: BotOut = {
      id: uuid(),
      credential_id: body.credential_id || this.credentials[0]?.id || uuid(),
      strategy_class: body.strategy_class,
      symbol: body.symbol,
      timeframe: body.timeframe,
      params: { ...body.params },
      status: "stopped",
      created_at: at,
      updated_at: at,
    };
    if (!this.markPrices[bot.symbol]) {
      this.markPrices[bot.symbol] = basePriceOf(bot.symbol);
    }
    this.bots.push(bot);
    return { ...bot };
  }

  startBot(id: string): BotOut {
    this.ensureSession();
    const bot = this.bots.find((b) => b.id === id);
    if (!bot) throw new Error("bot not found");
    bot.status = "running";
    bot.updated_at = new Date().toISOString();
    if (!this.positions.some((p) => p.bot_id === id)) this.openPosition(bot);
    return { ...bot };
  }

  stopBot(id: string): BotOut {
    this.ensureSession();
    const bot = this.bots.find((b) => b.id === id);
    if (!bot) throw new Error("bot not found");
    bot.status = "stopped";
    bot.updated_at = new Date().toISOString();
    this.positions = this.positions.filter((p) => p.bot_id !== id);
    return { ...bot };
  }

  updateBotParams(id: string, params: Record<string, unknown>): BotOut {
    this.ensureSession();
    const bot = this.bots.find((b) => b.id === id);
    if (!bot) throw new Error("bot not found");
    bot.params = { ...bot.params, ...params };
    bot.updated_at = new Date().toISOString();
    return { ...bot };
  }

  deleteBot(id: string): void {
    this.ensureSession();
    this.bots = this.bots.filter((b) => b.id !== id);
    this.positions = this.positions.filter((p) => p.bot_id !== id);
  }

  // ── Бэктест (фейковый результат, оффлайн) ────────────────────────────────────

  runBacktest(body: BacktestRunIn): BacktestJobOut {
    this.ensureSession();
    const result = this.makeBacktestResult(body);
    const now = new Date().toISOString();
    const job: BacktestJobOut = {
      id: uuid(),
      status: "completed",
      exchange: body.exchange,
      strategy_class: body.strategy_class,
      symbol: body.symbol,
      timeframe: body.timeframe,
      params: { ...body.params },
      date_from: body.date_from,
      date_to: body.date_to,
      initial_balance: { ...body.initial_balance },
      result,
      error_message: null,
      created_at: now,
      completed_at: now,
    };
    this.backtests.set(job.id, job);
    return job;
  }

  getBacktest(id: string): BacktestJobOut {
    const job = this.backtests.get(id);
    if (!job) throw new Error("backtest not found");
    return job;
  }

  listBacktests(limit = 20): BacktestJobSummary[] {
    return [...this.backtests.values()]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((j) => ({
        id: j.id,
        status: j.status,
        exchange: j.exchange,
        strategy_class: j.strategy_class,
        symbol: j.symbol,
        timeframe: j.timeframe,
        created_at: j.created_at,
        completed_at: j.completed_at,
        total_return_pct: j.result?.total_return_pct ?? null,
        trades_count: j.result?.trades_count ?? null,
      }));
  }

  deleteBacktest(id: string): void {
    this.backtests.delete(id);
  }

  private makeBacktestResult(body: BacktestRunIn): BacktestResult {
    const ccy = Object.keys(body.initial_balance)[0] ?? "USDT";
    const initial = Number(body.initial_balance[ccy] ?? "1000") || 1000;
    const totalReturnPct = randFloat(-25, 60);
    const final = initial * (1 + totalReturnPct / 100);

    const from = new Date(body.date_from).getTime();
    const to = new Date(body.date_to).getTime();
    const span = Math.max(to - from, 86_400_000);

    // Equity-кривая: блуждание от initial к final.
    const points = 60;
    const equity_curve: EquityPoint[] = [];
    let peak = initial;
    let maxDd = 0;
    for (let i = 0; i <= points; i++) {
      const t = i / points;
      const base = initial + (final - initial) * t;
      const noise = base * randFloat(-0.03, 0.03);
      const eq = Math.max(base + noise, initial * 0.3);
      peak = Math.max(peak, eq);
      maxDd = Math.max(maxDd, (peak - eq) / peak);
      equity_curve.push({
        timestamp: new Date(from + span * t).toISOString(),
        equity: decStr(eq, 2),
      });
    }

    const tradesCount = randInt(8, 40);
    const price = basePriceOf(body.symbol);
    const dg = priceDigits(price);
    let wins = 0;
    const trades: BacktestTrade[] = [];
    for (let i = 0; i < tradesCount; i++) {
      const side: "buy" | "sell" = i % 2 === 0 ? "buy" : "sell";
      const size = randFloat(0.001, 0.2);
      const fillPrice = price * randFloat(0.9, 1.1);
      const pnl = side === "sell" ? randFloat(-50, 80) : null;
      if (pnl !== null && pnl > 0) wins++;
      trades.push({
        timestamp: new Date(from + span * (i / tradesCount)).toISOString(),
        side,
        price: decStr(fillPrice, dg),
        size: decStr(size, 6),
        fee: decStr(size * fillPrice * 0.001, 4),
        pnl: pnl === null ? null : decStr(pnl, 2),
      });
    }
    const sells = trades.filter((t) => t.pnl !== null).length || 1;

    return {
      initial_balance: { [ccy]: decStr(initial, 2) },
      final_balance: { [ccy]: decStr(final, 2) },
      total_return_pct: decStr(totalReturnPct, 2),
      max_drawdown_pct: decStr(maxDd * 100, 2),
      sharpe_ratio: decStr(randFloat(-0.5, 2.5), 2),
      trades_count: tradesCount,
      win_rate: decStr(wins / sells, 4),
      profit_factor: decStr(randFloat(0.6, 2.4), 2),
      trades,
      equity_curve,
    };
  }
}

export const mockStore = new MockStore();
