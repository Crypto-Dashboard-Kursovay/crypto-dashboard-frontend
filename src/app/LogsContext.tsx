import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { API_ORIGIN, getAccessToken } from "../api/client";

export type LogLevel = "INFO" | "WARNING" | "ERROR";

export interface LogLine {
  id: number;
  time: string; // ISO timestamp
  level: LogLevel;
  source: string; // strategy_error | new_trade | balance_update | ws
  message: string;
}

const STORAGE_KEY = "crypto.logs.v1";
const RETENTION_MS = 12 * 60 * 60 * 1000; // 12 часов
const MAX_LINES = 2000;
const PRUNE_INTERVAL_MS = 5 * 60 * 1000; // прунинг по таймеру раз в 5 минут

type WsState = "connecting" | "open" | "closed";

interface LogsContextValue {
  lines: LogLine[];
  wsState: WsState;
  paused: boolean;
  setPaused: (v: boolean | ((p: boolean) => boolean)) => void;
  clear: () => void;
}

const LogsContext = createContext<LogsContextValue | null>(null);

function buildWsUrl(token: string): string {
  // API_ORIGIN: либо "http://host:8000" либо "" (когда VITE_API_URL=/api/)
  if (!API_ORIGIN) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws/updates?token=${encodeURIComponent(token)}`;
  }
  const httpOrigin = new URL(API_ORIGIN);
  const proto = httpOrigin.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${httpOrigin.host}/ws/updates?token=${encodeURIComponent(token)}`;
}

function isFresh(time: string): boolean {
  const t = new Date(time).getTime();
  return Number.isFinite(t) && Date.now() - t <= RETENTION_MS;
}

function loadFromStorage(): LogLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LogLine[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((l) => l && typeof l.time === "string" && isFresh(l.time));
  } catch {
    return [];
  }
}

function saveToStorage(lines: LogLine[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // localStorage может быть переполнен/недоступен — не критично
  }
}

export function LogsProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<LogLine[]>(() => loadFromStorage());
  const [paused, setPaused] = useState(false);
  const [wsState, setWsState] = useState<WsState>("connecting");

  const idCounter = useRef(0);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  const append = useCallback((line: Omit<LogLine, "id">) => {
    if (pausedRef.current) return;
    setLines((prev) => {
      idCounter.current += 1;
      const fresh = prev.filter((l) => isFresh(l.time));
      const next = [...fresh, { ...line, id: idCounter.current }];
      const capped = next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
      saveToStorage(capped);
      return capped;
    });
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  // Прунинг записей старше 12ч по таймеру (на случай долгой неактивности вкладки).
  useEffect(() => {
    const prune = () =>
      setLines((prev) => {
        const fresh = prev.filter((l) => isFresh(l.time));
        if (fresh.length !== prev.length) saveToStorage(fresh);
        return fresh.length !== prev.length ? fresh : prev;
      });
    const t = setInterval(prune, PRUNE_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  // Глобальное WS-соединение: живёт всё время, пока провайдер смонтирован
  // (т.е. пока пользователь авторизован), независимо от текущей страницы.
  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      const token = getAccessToken();
      if (!token) {
        setWsState("closed");
        return;
      }
      setWsState("connecting");
      ws = new WebSocket(buildWsUrl(token));
      ws.onopen = () => {
        if (cancelled) return;
        setWsState("open");
        append({
          time: new Date().toISOString(),
          level: "INFO",
          source: "ws",
          message: "WebSocket подключён",
        });
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as { type?: string; data?: unknown };
          if (msg.type === "ping") return;
          if (msg.type === "strategy_error") {
            const d = (msg.data ?? {}) as Record<string, unknown>;
            append({
              time: new Date().toISOString(),
              level: (d.kind === "execution_failed" ? "ERROR" : "WARNING") as LogLevel,
              source: "strategy_error",
              message: `[${d.strategy ?? "?"}] ${d.kind ?? "?"}: ${d.message ?? ""}`,
            });
          } else if (msg.type === "new_trade") {
            const d = (msg.data ?? {}) as Record<string, unknown>;
            append({
              time: new Date().toISOString(),
              level: "INFO",
              source: "new_trade",
              message: `${String(d.side ?? "").toUpperCase()} ${d.symbol ?? "?"} size=${d.size ?? "?"} price=${d.price ?? "?"} (${d.strategy ?? "?"})`,
            });
          } else if (msg.type === "balance_update") {
            append({
              time: new Date().toISOString(),
              level: "INFO",
              source: "balance_update",
              message: "Обновление баланса",
            });
          }
        } catch {
          // ignore malformed
        }
      };
      ws.onclose = () => {
        if (cancelled) return;
        setWsState("closed");
        // Reconnect with backoff 5s
        reconnectTimer = setTimeout(connect, 5000);
      };
      ws.onerror = () => {
        // close event последует — там и обработаем
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [append]);

  const value = useMemo<LogsContextValue>(
    () => ({ lines, wsState, paused, setPaused, clear }),
    [lines, wsState, paused, clear],
  );

  return <LogsContext.Provider value={value}>{children}</LogsContext.Provider>;
}

export function useLogs(): LogsContextValue {
  const ctx = useContext(LogsContext);
  if (!ctx) {
    throw new Error("useLogs must be used within a LogsProvider");
  }
  return ctx;
}
