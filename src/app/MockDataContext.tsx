import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { isMockEnabled, setMockEnabled } from "../mock/config";
import { mockStore } from "../mock/store";
import { useLogs } from "./LogsContext";

interface MockDataContextValue {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
}

const MockDataContext = createContext<MockDataContextValue | null>(null);

// Период «тика»: двигает рынок, иногда рождает сделку и строки логов.
const TICK_MS = 4000;

export function MockDataProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(() => isMockEnabled());
  const { pushLog } = useLogs();

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const setEnabled = (value: boolean) => {
    setMockEnabled(value);
    setEnabledState(value);
  };

  // Таймер демо-данных: активен только пока режим включён.
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (!enabledRef.current) return;
      const logs = mockStore.tick();
      for (const line of logs) pushLog(line);
    };
    // Первый тик сразу — чтобы сессия инициализировалась и логи пошли без задержки.
    tick();
    const t = setInterval(tick, TICK_MS);
    return () => clearInterval(t);
  }, [enabled, pushLog]);

  const value = useMemo<MockDataContextValue>(
    () => ({ enabled, setEnabled }),
    [enabled],
  );

  return <MockDataContext.Provider value={value}>{children}</MockDataContext.Provider>;
}

export function useMockData(): MockDataContextValue {
  const ctx = useContext(MockDataContext);
  if (!ctx) {
    throw new Error("useMockData must be used within a MockDataProvider");
  }
  return ctx;
}
