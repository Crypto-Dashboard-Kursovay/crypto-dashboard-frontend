import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router";
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Box,
  Button,
  CircularProgress,
} from "@mui/material";
import { QueryStats } from "@mui/icons-material";

import { listBots } from "../../../api/bots";
import { fetchHealth, type HealthStatus } from "../../../api/health";
import type { BotOut } from "../../../api/types";

interface CounterBoxProps {
  label: string;
  value: number | string;
  color?: string;
}

function CounterBox({ label, value, color }: CounterBoxProps) {
  return (
    <Box
      flex={1}
      textAlign="center"
      bgcolor="background.default"
      borderRadius={2}
      py={1}
      border={1}
      borderColor="divider"
    >
      <Typography variant="h5" fontWeight="bold" sx={color ? { color } : undefined}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

function healthState(value: string | undefined): "ok" | "fail" | "unknown" {
  if (value === "ok") return "ok";
  if (!value || value === "unknown") return "unknown";
  return "fail";
}

interface HealthRowProps {
  label: string;
  state: "ok" | "fail" | "unknown";
}

function HealthRow({ label, state }: HealthRowProps) {
  const color =
    state === "ok"
      ? "success.main"
      : state === "fail"
        ? "error.main"
        : "text.disabled";
  const text = state === "ok" ? "OK" : state === "fail" ? "FAIL" : "—";
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Box
        sx={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          bgcolor: color,
          flexShrink: 0,
        }}
      />
      <Typography variant="body2">{label}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
        {text}
      </Typography>
    </Stack>
  );
}

export function EngineStatusWidget() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [bots, setBots] = useState<BotOut[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const [h, bs] = await Promise.allSettled([fetchHealth(), listBots()]);
      if (cancelled) return;
      if (h.status === "fulfilled") setHealth(h.value);
      if (bs.status === "fulfilled") setBots(bs.value);
    };
    void tick();
    const t = setInterval(() => void tick(), 10_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const runningList = useMemo(
    () => (bots ?? []).filter((b) => b.status === "running"),
    [bots],
  );
  const startingCount = (bots ?? []).filter((b) => b.status === "starting").length;
  const errorCount = (bots ?? []).filter((b) => b.status === "error").length;

  const backendState = healthState(health?.backend);
  const pgState = healthState(health?.postgres);
  const redisState = healthState(health?.redis);

  const allHealthy =
    backendState === "ok" && pgState === "ok" && redisState === "ok";

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Header — иконка + статус */}
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: "50%",
              bgcolor: "rgba(59, 130, 246, 0.1)",
              color: "primary.main",
              display: "flex",
            }}
          >
            <QueryStats />
          </Box>
          <Box>
            <Typography variant="body1" fontWeight="medium">
              Статус движка
            </Typography>
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.5}
              color={
                health === null
                  ? "text.disabled"
                  : allHealthy
                    ? "success.main"
                    : "error.main"
              }
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  bgcolor: "currentColor",
                }}
              />
              <Typography variant="caption">
                {health === null
                  ? "Проверяем..."
                  : allHealthy
                    ? "Работает"
                    : "Проблема"}
              </Typography>
            </Stack>
          </Box>
        </Stack>

        {/* Health checks */}
        <Stack spacing={0.75} mb={2.5}>
          <HealthRow label="Backend" state={backendState} />
          <HealthRow label="PostgreSQL" state={pgState} />
          <HealthRow label="Redis" state={redisState} />
        </Stack>

        {/* Counters */}
        <Stack direction="row" spacing={1.25} mb={2.5}>
          <CounterBox
            label="Активных"
            value={bots === null ? "—" : runningList.length}
            color="success.main"
          />
          <CounterBox
            label="В очереди"
            value={bots === null ? "—" : startingCount}
          />
          <CounterBox
            label="С ошибкой"
            value={bots === null ? "—" : errorCount}
            color={errorCount > 0 ? "error.main" : undefined}
          />
        </Stack>

        {/* Running list */}
        <Box flexGrow={1}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            Активные стратегии
          </Typography>
          {bots === null ? (
            <Box display="flex" justifyContent="center" py={1.5}>
              <CircularProgress size={16} />
            </Box>
          ) : runningList.length === 0 ? (
            <Typography variant="body2" color="text.disabled" mt={0.5}>
              Нет запущенных стратегий
            </Typography>
          ) : (
            <Stack spacing={0.5} mt={0.5}>
              {runningList.slice(0, 4).map((b) => (
                <Stack
                  key={b.id}
                  direction="row"
                  justifyContent="space-between"
                  py={0.25}
                >
                  <Typography variant="body2" noWrap>
                    {b.symbol}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {b.strategy_class}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Box>

        <Box mt={1.5}>
          <Button
            component={RouterLink}
            to="/strategies"
            size="small"
            variant="text"
            color="inherit"
            sx={{ p: 0, justifyContent: "flex-start" }}
          >
            Показать все →
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
