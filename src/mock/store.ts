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
  timeframeMs,
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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// Кэш сессии демо-режима: сгенерированные данные сохраняются и переживают перезагрузку
// страницы ~2 суток (по просьбе — «кэшируясь на ближайшие сутки-двое»).
const SESSION_KEY = "crypto.mock.session.v1";
const SESSION_TTL_MS = 48 * 60 * 60 * 1000;

interface BacktestEntry {
  job: BacktestJobOut;
  result: BacktestResult;
  completeAt: number; // ms-таймстамп, когда «прогон» считается завершённым
}

interface PersistedSession {
  savedAt: number;
  credentials: CredentialOut[];
  bots: BotOut[];
  positions: MockPosition[];
  markPrices: Record<string, number>;
  trades: TradeOut[];
  freeCash: number;
  backtests: BacktestEntry[];
}

class MockStore {
  private initialized = false;

  private credentials: CredentialOut[] = [];
  private bots: BotOut[] = [];
  private positions: MockPosition[] = [];
  private markPrices: Record<string, number> = {};
  private trades: TradeOut[] = [];
  private backtests = new Map<string, BacktestEntry>();
  private freeCash = 10000;

  // ── Сессия ────────────────────────────────────────────────────────────────

  private ensureSession(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Сначала пробуем восстановить кэшированную сессию (живёт ~2 суток).
    if (this.tryRestore()) return;

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
    this.persist();
  }

  private tryRestore(): boolean {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw) as PersistedSession;
      if (!s || typeof s.savedAt !== "number") return false;
      if (Date.now() - s.savedAt > SESSION_TTL_MS) {
        localStorage.removeItem(SESSION_KEY);
        return false;
      }
      this.credentials = s.credentials ?? [];
      this.bots = s.bots ?? [];
      this.positions = s.positions ?? [];
      this.markPrices = s.markPrices ?? {};
      this.trades = s.trades ?? [];
      this.freeCash = s.freeCash ?? 10000;
      this.backtests = new Map((s.backtests ?? []).map((e) => [e.job.id, e]));
      // Минимальная валидность: восстановили хотя бы ключи и ботов.
      return this.credentials.length > 0 && this.bots.length > 0;
    } catch {
      return false;
    }
  }

  private persist(): void {
    try {
      const payload: PersistedSession = {
        savedAt: Date.now(),
        credentials: this.credentials,
        bots: this.bots,
        positions: this.positions,
        markPrices: this.markPrices,
        trades: this.trades,
        freeCash: this.freeCash,
        backtests: [...this.backtests.values()],
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch {
      // localStorage переполнен/недоступен — не критично
    }
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

    this.persist();
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
    this.persist();
    return { ...cred };
  }

  removeCredential(id: string): void {
    this.ensureSession();
    this.credentials = this.credentials.filter((c) => c.id !== id);
    this.bots = this.bots.filter((b) => b.credential_id !== id);
    this.positions = this.positions.filter((p) => p.credential_id !== id);
    this.persist();
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
    this.persist();
    return { ...bot };
  }

  startBot(id: string): BotOut {
    this.ensureSession();
    const bot = this.bots.find((b) => b.id === id);
    if (!bot) throw new Error("bot not found");
    bot.status = "running";
    bot.updated_at = new Date().toISOString();
    if (!this.positions.some((p) => p.bot_id === id)) this.openPosition(bot);
    this.persist();
    return { ...bot };
  }

  stopBot(id: string): BotOut {
    this.ensureSession();
    const bot = this.bots.find((b) => b.id === id);
    if (!bot) throw new Error("bot not found");
    bot.status = "stopped";
    bot.updated_at = new Date().toISOString();
    this.positions = this.positions.filter((p) => p.bot_id !== id);
    this.persist();
    return { ...bot };
  }

  updateBotParams(id: string, params: Record<string, unknown>): BotOut {
    this.ensureSession();
    const bot = this.bots.find((b) => b.id === id);
    if (!bot) throw new Error("bot not found");
    bot.params = { ...bot.params, ...params };
    bot.updated_at = new Date().toISOString();
    this.persist();
    return { ...bot };
  }

  deleteBot(id: string): void {
    this.ensureSession();
    this.bots = this.bots.filter((b) => b.id !== id);
    this.positions = this.positions.filter((p) => p.bot_id !== id);
    this.persist();
  }

  // ── Бэктест (фейковый результат, оффлайн) ────────────────────────────────────

  /** Сколько свечей покрывает период при данном таймфрейме. */
  private candleCountOf(body: BacktestRunIn): number {
    const from = new Date(body.date_from).getTime();
    const to = new Date(body.date_to).getTime();
    const span = Math.max(to - from, 86_400_000);
    return Math.max(1, Math.floor(span / timeframeMs(body.timeframe)));
  }

  runBacktest(body: BacktestRunIn): BacktestJobOut {
    this.ensureSession();
    const result = this.makeBacktestResult(body);
    const now = Date.now();
    // Скорость «прогона» зависит от числа свечей (мельче ТФ + длиннее период →
    // дольше). Клампим в разумный диапазон, чтобы анимация была заметна, но не вечной.
    const duration = clamp(1000 + this.candleCountOf(body) * 3, 1800, 12000);
    const nowIso = new Date(now).toISOString();
    const job: BacktestJobOut = {
      id: uuid(),
      status: "running",
      exchange: body.exchange,
      strategy_class: body.strategy_class,
      symbol: body.symbol,
      timeframe: body.timeframe,
      params: { ...body.params },
      date_from: body.date_from,
      date_to: body.date_to,
      initial_balance: { ...body.initial_balance },
      result: null,
      error_message: null,
      created_at: nowIso,
      completed_at: null,
    };
    this.backtests.set(job.id, { job, result, completeAt: now + duration });
    this.persist();
    return { ...job };
  }

  getBacktest(id: string): BacktestJobOut {
    const entry = this.backtests.get(id);
    if (!entry) throw new Error("backtest not found");
    // По истечении расчётного времени помечаем прогон завершённым.
    if (entry.job.status === "running" && Date.now() >= entry.completeAt) {
      entry.job.status = "completed";
      entry.job.result = entry.result;
      entry.job.completed_at = new Date().toISOString();
      this.persist();
    }
    return { ...entry.job };
  }

  listBacktests(limit = 20): BacktestJobSummary[] {
    return [...this.backtests.values()]
      .map((e) => e.job)
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
    this.persist();
  }

  // Реалистичная симуляция: random-walk цены + простая логика входов/выходов,
  // метрики считаются из фактических сделок и equity-кривой (не из «потолка»).
  private makeBacktestResult(body: BacktestRunIn): BacktestResult {
    const ccy = Object.keys(body.initial_balance)[0] ?? "USDT";
    const initial = Number(body.initial_balance[ccy] ?? "1000") || 1000;

    const from = new Date(body.date_from).getTime();
    const to = new Date(body.date_to).getTime();
    const span = Math.max(to - from, 86_400_000);
    const candleMs = timeframeMs(body.timeframe);
    const candleCount = this.candleCountOf(body);
    // Шагов симуляции ограничиваем (производительность/UI), но больше период —
    // больше шагов и сделок.
    const steps = Math.round(clamp(candleCount, 40, 600));

    const startPrice = basePriceOf(body.symbol);
    // Волатильность за шаг растёт с таймфреймом (1m спокойнее, 1d размашистее).
    const vol = 0.004 + Math.min(candleMs / 86_400_000, 1) * 0.02;
    const drift = randFloat(-0.0006, 0.001); // лёгкий тренд на весь период
    const riskFrac = 0.25; // доля депозита на сделку
    const feeRate = 0.001;

    let price = startPrice;
    let cash = initial;
    let inPos = false;
    let entryPrice = 0;
    let posSize = 0;

    const trades: BacktestTrade[] = [];
    const equity_curve: EquityPoint[] = [];
    let peak = initial;
    let maxDd = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let wins = 0;
    let closed = 0;
    const rets: number[] = [];
    let prevEquity = initial;

    const closeAt = (p: number, ts: string) => {
      const fee = posSize * p * feeRate;
      const pnl = (p - entryPrice) * posSize - fee;
      cash += pnl;
      closed += 1;
      if (pnl >= 0) {
        wins += 1;
        grossProfit += pnl;
      } else {
        grossLoss += -pnl;
      }
      trades.push({
        timestamp: ts,
        side: "sell",
        price: decStr(p, priceDigits(p)),
        size: decStr(posSize, 6),
        fee: decStr(fee, 4),
        pnl: decStr(pnl, 2),
      });
      inPos = false;
    };

    for (let i = 0; i < steps; i++) {
      price = Math.max(price * (1 + drift + randFloat(-vol, vol)), startPrice * 0.2);
      const ts = new Date(from + span * (i / steps)).toISOString();

      if (!inPos && chance(0.14)) {
        posSize = (cash * riskFrac) / price;
        entryPrice = price;
        const fee = posSize * price * feeRate;
        cash -= fee;
        inPos = true;
        trades.push({
          timestamp: ts,
          side: "buy",
          price: decStr(price, priceDigits(price)),
          size: decStr(posSize, 6),
          fee: decStr(fee, 4),
          pnl: null,
        });
      } else if (inPos && chance(0.2)) {
        closeAt(price, ts);
      }

      const unrealized = inPos ? (price - entryPrice) * posSize : 0;
      const equity = cash + unrealized;
      equity_curve.push({ timestamp: ts, equity: decStr(equity, 2) });
      peak = Math.max(peak, equity);
      maxDd = Math.max(maxDd, peak > 0 ? (peak - equity) / peak : 0);
      rets.push(prevEquity > 0 ? (equity - prevEquity) / prevEquity : 0);
      prevEquity = equity;
    }

    // Закрываем хвостовую позицию по последней цене.
    if (inPos) closeAt(price, new Date(to).toISOString());

    const finalEquity = cash;
    const totalReturnPct = (finalEquity / initial - 1) * 100;
    const meanRet = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
    const variance =
      rets.reduce((a, b) => a + (b - meanRet) ** 2, 0) / (rets.length || 1);
    const std = Math.sqrt(variance);
    const sharpe = std > 0 ? clamp((meanRet / std) * Math.sqrt(rets.length), -2, 4) : 0;
    const winRatePct = closed > 0 ? (wins / closed) * 100 : 0;
    const profitFactor =
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0;

    return {
      initial_balance: { [ccy]: decStr(initial, 2) },
      final_balance: { [ccy]: decStr(finalEquity, 2) },
      total_return_pct: decStr(totalReturnPct, 2),
      max_drawdown_pct: decStr(maxDd * 100, 2),
      sharpe_ratio: decStr(sharpe, 2),
      trades_count: trades.length,
      win_rate: decStr(winRatePct, 1),
      profit_factor: profitFactor === null ? null : decStr(profitFactor, 2),
      trades,
      equity_curve,
    };
  }
}

export const mockStore = new MockStore();
