import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router";
import {
  Box,
  Grid,
  Card,
  Typography,
  Stack,
  Button,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
} from "@mui/material";
import {
  Add,
  GridOn,
  PlayArrow,
  Savings,
  Stop,
  DeleteOutline,
  Refresh,
} from "@mui/icons-material";

import { ApiHttpError } from "../../api/client";
import { deleteBot, listBots, startBot, stopBot } from "../../api/bots";
import type { BotOut } from "../../api/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  starting: "Запускается",
  running: "Активна",
  stopping: "Останавливается",
  stopped: "Остановлена",
  error: "Ошибка",
};

const STATUS_COLOR: Record<
  string,
  "default" | "success" | "warning" | "error" | "info" | "primary" | "secondary"
> = {
  draft: "default",
  starting: "info",
  running: "success",
  stopping: "warning",
  stopped: "default",
  error: "error",
};

export function Strategies() {
  const [bots, setBots] = useState<BotOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await listBots();
      setBots(data);
    } catch (err) {
      setError(err instanceof ApiHttpError ? err.message : "Не удалось загрузить ботов");
      setBots([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Лёгкий polling — статус меняется быстро (starting → running и т.п.)
    const t = setInterval(() => {
      void refresh();
    }, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusy((s) => ({ ...s, [id]: true }));
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiHttpError ? err.message : "Операция не удалась");
    } finally {
      setBusy((s) => ({ ...s, [id]: false }));
      await refresh();
    }
  };

  const onStart = (id: string) => withBusy(id, () => startBot(id).then(() => undefined));
  const onStop = (id: string) =>
    withBusy(id, () => stopBot(id, false).then(() => undefined));
  const onDelete = (id: string) => {
    if (!confirm("Удалить бота? Действие необратимо.")) return;
    void withBusy(id, () => deleteBot(id));
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        mb={4}
      >
        <Typography variant="h1">Стратегии</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <IconButton onClick={() => void refresh()} aria-label="Обновить">
            <Refresh />
          </IconButton>
          <Button
            component={RouterLink}
            to="/strategies/new?template=dca"
            variant="outlined"
            color="inherit"
            startIcon={<Savings />}
          >
            Создать DCA
          </Button>
          <Button
            component={RouterLink}
            to="/strategies/new?template=grid"
            variant="outlined"
            color="inherit"
            startIcon={<GridOn />}
          >
            Создать Grid
          </Button>
          <Button
            component={RouterLink}
            to="/strategies/new"
            variant="contained"
            color="primary"
            startIcon={<Add />}
          >
            Создать стратегию
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {bots === null ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : bots.length === 0 ? (
        <Card sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h3" mb={1}>
            Пока нет ни одного бота
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Сначала добавьте API-ключи в{" "}
            <RouterLink to="/settings" style={{ color: "inherit" }}>
              <strong>Настройках</strong>
            </RouterLink>
            , потом выберите тип стратегии.
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            justifyContent="center"
          >
            <Button
              component={RouterLink}
              to="/strategies/new"
              variant="contained"
              color="primary"
              startIcon={<Add />}
            >
              Создать стратегию
            </Button>
            <Button
              component={RouterLink}
              to="/strategies/new?template=dca"
              variant="outlined"
              color="inherit"
              startIcon={<Savings />}
            >
              Создать DCA
            </Button>
            <Button
              component={RouterLink}
              to="/strategies/new?template=grid"
              variant="outlined"
              color="inherit"
              startIcon={<GridOn />}
            >
              Создать Grid
            </Button>
          </Stack>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {bots.map((bot) => {
            const isBusy = busy[bot.id] === true;
            const canStart = bot.status === "stopped" || bot.status === "draft" || bot.status === "error";
            const canStop = bot.status === "running" || bot.status === "starting";
            return (
              <Grid size={{ xs: 12, sm: 12, md: 6, lg: 4 }} key={bot.id}>
                <Card
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    p: 2,
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    mb={2}
                  >
                    <Typography
                      variant="h3"
                      noWrap
                      title={bot.strategy_class}
                      sx={{ maxWidth: "65%" }}
                    >
                      {bot.strategy_class}
                    </Typography>
                    <Chip
                      label={STATUS_LABEL[bot.status] ?? bot.status}
                      size="small"
                      color={STATUS_COLOR[bot.status] ?? "default"}
                      variant="outlined"
                    />
                  </Stack>

                  <Stack spacing={1.25} mb={2} flexGrow={1}>
                    <Row label="Пара" value={bot.symbol} />
                    <Row label="Таймфрейм" value={bot.timeframe} />
                    <Row
                      label="Параметры"
                      value={Object.entries(bot.params)
                        .map(([k, v]) => `${k}=${String(v)}`)
                        .join(", ") || "—"}
                    />
                  </Stack>

                  <Stack direction="row" spacing={1} mt="auto">
                    <Button
                      fullWidth
                      variant="contained"
                      color="success"
                      startIcon={<PlayArrow />}
                      disabled={!canStart || isBusy}
                      onClick={() => void onStart(bot.id)}
                    >
                      Start
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="error"
                      startIcon={<Stop />}
                      disabled={!canStop || isBusy}
                      onClick={() => void onStop(bot.id)}
                    >
                      Stop
                    </Button>
                    <IconButton
                      color="error"
                      onClick={() => onDelete(bot.id)}
                      disabled={isBusy || bot.status === "running"}
                      aria-label="Удалить бота"
                    >
                      <DeleteOutline />
                    </IconButton>
                  </Stack>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight="medium"
        sx={{
          maxWidth: "60%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={value}
      >
        {value}
      </Typography>
    </Stack>
  );
}
