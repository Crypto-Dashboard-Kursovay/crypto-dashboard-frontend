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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import {
  Add,
  GridOn,
  PlayArrow,
  Savings,
  Stop,
  DeleteOutline,
  Refresh,
  EditOutlined,
} from "@mui/icons-material";

import { ApiHttpError } from "../../api/client";
import { deleteBot, listBots, startBot, stopBot, updateBotParams } from "../../api/bots";
import type { BotOut } from "../../api/types";

// Какие параметры имеют целочисленный смысл — приводим к Number при сохранении
// (зеркало CreateStrategy.coerceParams).
const INT_PARAM_KEYS = new Set([
  "fast_period",
  "slow_period",
  "signal_period",
  "rsi_period",
  "bb_period",
  "period",
  "interval_candles",
  "num_levels",
]);

function coerceEditParams(raw: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = INT_PARAM_KEYS.has(k) ? Number(v) : v;
  }
  return out;
}

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
  const [editing, setEditing] = useState<BotOut | null>(null);
  const [editParams, setEditParams] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);

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

  const onEdit = (bot: BotOut) => {
    setEditing(bot);
    const asStrings: Record<string, string> = {};
    for (const [k, v] of Object.entries(bot.params)) asStrings[k] = String(v);
    setEditParams(asStrings);
  };

  const onSaveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    setError(null);
    try {
      await updateBotParams(editing.id, coerceEditParams(editParams));
      setEditing(null);
    } catch (err) {
      setError(err instanceof ApiHttpError ? err.message : "Не удалось сохранить изменения");
    } finally {
      setSavingEdit(false);
      await refresh();
    }
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
                      color="inherit"
                      onClick={() => onEdit(bot)}
                      disabled={isBusy}
                      aria-label="Редактировать бота"
                    >
                      <EditOutlined />
                    </IconButton>
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

      <Dialog open={editing !== null} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          Редактировать стратегию
          {editing && (
            <Typography variant="body2" color="text.secondary">
              {editing.strategy_class} · {editing.symbol} · {editing.timeframe}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {editing && Object.keys(editParams).length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              У этой стратегии нет редактируемых параметров.
            </Typography>
          ) : (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              {Object.entries(editParams).map(([key, value]) => (
                <Grid size={{ xs: 12, sm: 6 }} key={key}>
                  <TextField
                    label={key}
                    size="small"
                    fullWidth
                    value={value}
                    disabled={savingEdit}
                    onChange={(e) =>
                      setEditParams((p) => ({ ...p, [key]: e.target.value }))
                    }
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setEditing(null)} disabled={savingEdit}>
            Отмена
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => void onSaveEdit()}
            disabled={savingEdit}
          >
            {savingEdit ? "Сохраняем..." : "Сохранить"}
          </Button>
        </DialogActions>
      </Dialog>
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
