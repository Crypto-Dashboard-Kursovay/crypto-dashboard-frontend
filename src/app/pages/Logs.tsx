import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  FormControl,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  DeleteOutline,
  Pause,
  PlayArrow,
  Search,
} from "@mui/icons-material";

import { API_ORIGIN, getAccessToken } from "../../api/client";

type LogLevel = "INFO" | "WARNING" | "ERROR";

interface LogLine {
  id: number;
  time: string;          // ISO timestamp
  level: LogLevel;
  source: string;        // strategy_error | new_trade | balance_update | ws
  message: string;
}

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

export function Logs() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [levelFilter, setLevelFilter] = useState<LogLevel | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [wsState, setWsState] = useState<"connecting" | "open" | "closed">(
    "connecting",
  );
  const idCounter = useRef(0);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const append = (line: Omit<LogLine, "id">) => {
      if (pausedRef.current) return;
      setLines((prev) => {
        idCounter.current += 1;
        const next = [...prev, { ...line, id: idCounter.current }];
        // Бесконечный лог быстро съест память — режем до 500 строк
        return next.length > 500 ? next.slice(next.length - 500) : next;
      });
    };

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
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lines.filter((l) => {
      if (levelFilter !== "ALL" && l.level !== levelFilter) return false;
      if (q && !l.message.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lines, levelFilter, search]);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        mb={4}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="h1">Журнал событий</Typography>
          <Chip
            size="small"
            label={
              wsState === "open"
                ? "live"
                : wsState === "connecting"
                  ? "connecting..."
                  : "offline"
            }
            color={
              wsState === "open"
                ? "success"
                : wsState === "connecting"
                  ? "info"
                  : "error"
            }
            variant="outlined"
          />
        </Stack>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={paused ? <PlayArrow /> : <Pause />}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "Продолжить" : "Пауза"}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutline />}
            onClick={() => setLines([])}
          >
            Очистить
          </Button>
        </Stack>
      </Stack>

      <Card sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "rgba(19, 23, 34, 0.5)",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as LogLevel | "ALL")}
              >
                <MenuItem value="ALL">Все уровни</MenuItem>
                <MenuItem value="INFO">INFO</MenuItem>
                <MenuItem value="WARNING">WARNING</MenuItem>
                <MenuItem value="ERROR">ERROR</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              placeholder="Поиск по тексту..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flexGrow: 1, maxWidth: { md: 360 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </Box>

        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            p: 2,
            bgcolor: "#000",
            fontFamily: "monospace",
          }}
        >
          {filtered.length === 0 ? (
            <Typography variant="body2" color="text.disabled" textAlign="center" py={4}>
              {wsState === "open"
                ? "Пока нет событий — ждём от движка..."
                : wsState === "connecting"
                  ? "Подключаемся к WebSocket..."
                  : "WebSocket отключён"}
            </Typography>
          ) : (
            <Stack spacing={1}>
              {filtered.map((log) => (
                <Box
                  key={log.id}
                  sx={{
                    display: "flex",
                    gap: 2,
                    py: 0.5,
                    px: 1,
                    borderRadius: 1,
                    "&:hover": { bgcolor: "rgba(255,255,255,0.05)" },
                  }}
                >
                  <Typography
                    variant="body2"
                    fontFamily="monospace"
                    color="text.secondary"
                    sx={{ flexShrink: 0, width: { xs: 80, sm: 110 } }}
                    noWrap
                  >
                    [{new Date(log.time).toLocaleTimeString("ru-RU")}]
                  </Typography>
                  <Typography
                    variant="body2"
                    fontFamily="monospace"
                    fontWeight="bold"
                    sx={{
                      flexShrink: 0,
                      width: 80,
                      color:
                        log.level === "INFO"
                          ? "info.main"
                          : log.level === "WARNING"
                            ? "warning.main"
                            : "error.main",
                    }}
                  >
                    [{log.level}]
                  </Typography>
                  <Typography
                    variant="body2"
                    fontFamily="monospace"
                    sx={{ wordBreak: "break-word" }}
                  >
                    {log.message}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Card>
    </Box>
  );
}
