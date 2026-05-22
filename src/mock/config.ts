// Конфигурация демо-режима («мок-данные»).
//
// Когда режим включён, фронт фабрикует данные локально и НЕ обращается к
// бэкенду/движку/биржам. Флаг хранится в localStorage; по умолчанию режим ВКЛЮЧЁН
// (отсутствие ключа трактуется как true) — так задумано для демонстрации UI без
// поднятого стека.

import type { ExchangeMeta } from "../api/types";

export const MOCK_ENABLED_KEY = "crypto.mock.enabled";

// Под Vitest по умолчанию режим ВЫКЛЮЧЕН: тесты api/виджетов мокают fetch и должны
// идти реальным путём. В приложении (prod/dev) по умолчанию ВКЛЮЧЁН.
const IS_TEST =
  typeof process !== "undefined" && !!(process.env && process.env.VITEST);

/** Включён ли демо-режим. Отсутствие ключа ⇒ true в приложении, false в тестах. */
export function isMockEnabled(): boolean {
  try {
    const v = localStorage.getItem(MOCK_ENABLED_KEY);
    if (v === null) return !IS_TEST;
    return v !== "false";
  } catch {
    return !IS_TEST;
  }
}

export function setMockEnabled(value: boolean): void {
  try {
    localStorage.setItem(MOCK_ENABLED_KEY, value ? "true" : "false");
  } catch {
    // localStorage недоступен — не критично
  }
}

// Биржи — зеркало backend/src/infrastructure/exchange_meta.py (multi-exchange).
export const MOCK_EXCHANGES: ExchangeMeta[] = [
  { name: "binance", display_name: "Binance", requires_passphrase: false, supports_testnet: true },
  { name: "bybit", display_name: "Bybit", requires_passphrase: false, supports_testnet: true },
  { name: "okx", display_name: "OKX", requires_passphrase: true, supports_testnet: true },
  { name: "mexc", display_name: "MEXC", requires_passphrase: false, supports_testnet: false },
];

// Allowlist пар + базовые цены (USDT). Совпадает с ALLOWED_SYMBOLS на бэке.
export const MOCK_SYMBOLS: { symbol: string; basePrice: number }[] = [
  { symbol: "BTC/USDT", basePrice: 65000 },
  { symbol: "ETH/USDT", basePrice: 3200 },
  { symbol: "SOL/USDT", basePrice: 150 },
  { symbol: "XRP/USDT", basePrice: 0.55 },
  { symbol: "BNB/USDT", basePrice: 600 },
];

export const MOCK_SYMBOL_NAMES: string[] = MOCK_SYMBOLS.map((s) => s.symbol);

export function basePriceOf(symbol: string): number {
  return MOCK_SYMBOLS.find((s) => s.symbol === symbol)?.basePrice ?? 100;
}

export const MOCK_TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"] as const;

// Реестр стратегий — соответствует default_registry() движка
// (trade-engine-crypto/src/strategies/__init__.py) и CreateStrategy.tsx.
export const MOCK_STRATEGIES = [
  "SmaCross",
  "RsiThreshold",
  "MacdCross",
  "BollingerBands",
  "BollingerRsi",
  "DcaStrategy",
  "SpotGridStrategy",
] as const;
export type MockStrategyName = (typeof MOCK_STRATEGIES)[number];

// Дефолтные параметры стратегий (как в CreateStrategy.defaultParams).
export function defaultStrategyParams(strategy: string): Record<string, string> {
  switch (strategy) {
    case "SmaCross":
      return { fast_period: "5", slow_period: "20", order_size: "0.001" };
    case "RsiThreshold":
      return { rsi_period: "14", oversold: "30", overbought: "70", order_size: "0.001" };
    case "MacdCross":
      return { fast_period: "12", slow_period: "26", signal_period: "9", order_size: "0.001" };
    case "BollingerBands":
      return { period: "20", num_std: "2.0", order_size: "0.001" };
    case "BollingerRsi":
      return {
        bb_period: "20",
        bb_std: "2.0",
        rsi_period: "14",
        oversold: "30",
        overbought: "70",
        order_size: "0.001",
      };
    case "DcaStrategy":
      return { buy_amount_quote: "10", interval_candles: "24" };
    case "SpotGridStrategy":
      return { price_low: "60000", price_high: "70000", num_levels: "10", base_per_level: "0.001" };
    default:
      return { order_size: "0.001" };
  }
}
