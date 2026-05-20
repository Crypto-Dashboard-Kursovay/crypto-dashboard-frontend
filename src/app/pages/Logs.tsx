import { useMemo, useState } from "react";
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

import { useLogs, type LogLevel } from "../LogsContext";

export function Logs() {
  const { lines, wsState, paused, setPaused, clear } = useLogs();
  const [levelFilter, setLevelFilter] = useState<LogLevel | "ALL">("ALL");
  const [search, setSearch] = useState("");

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
            onClick={clear}
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
