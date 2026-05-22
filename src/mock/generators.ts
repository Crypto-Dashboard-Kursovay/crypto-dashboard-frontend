// Чистые генераторы случайных данных для демо-режима.
// Никакого React и сетевых вызовов — только детерминированно-случайные хелперы.

import type { CandleOut } from "../api/types";

export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Фолбэк для окружений без crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function chance(p: number): boolean {
  return Math.random() < p;
}

/** Число знаков после запятой для цены в зависимости от её величины. */
export function priceDigits(price: number): number {
  if (price < 1) return 5;
  if (price < 100) return 3;
  return 2;
}

/** Decimal → строка (как приходит из бэка с pydantic Decimal). */
export function decStr(value: number, digits: number): string {
  return value.toFixed(digits);
}

const TF_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
};

export function timeframeMs(tf: string): number {
  return TF_MS[tf] ?? 60_000;
}

/**
 * Генерирует `count` свечей OHLCV случайным блужданием, заканчивающихся на
 * `lastClose` в текущий момент. Возвращает в хронологическом порядке.
 */
export function generateCandles(
  lastClose: number,
  timeframe: string,
  count: number,
): CandleOut[] {
  const step = timeframeMs(timeframe);
  const digits = priceDigits(lastClose);
  const now = Date.now();

  // Идём назад от lastClose, восстанавливая ряд цен закрытия.
  const closes: number[] = new Array(count);
  closes[count - 1] = lastClose;
  for (let i = count - 2; i >= 0; i--) {
    const drift = randFloat(-0.012, 0.012);
    closes[i] = Math.max(closes[i + 1] / (1 + drift), lastClose * 0.5);
  }

  const candles: CandleOut[] = [];
  for (let i = 0; i < count; i++) {
    const close = closes[i];
    const open = i === 0 ? close / (1 + randFloat(-0.01, 0.01)) : closes[i - 1];
    const hi = Math.max(open, close) * (1 + randFloat(0, 0.006));
    const lo = Math.min(open, close) * (1 - randFloat(0, 0.006));
    const ts = now - (count - 1 - i) * step;
    candles.push({
      timestamp: new Date(ts).toISOString(),
      open: decStr(open, digits),
      high: decStr(hi, digits),
      low: decStr(lo, digits),
      close: decStr(close, digits),
      volume: decStr(randFloat(10, 5000), 2),
    });
  }
  return candles;
}
