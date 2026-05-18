import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link as RouterLink, useNavigate } from "react-router";
import {
  Autocomplete,
  Box,
  Typography,
  Stack,
  IconButton,
  Button,
  Alert,
  Card,
  CardContent,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from "@mui/material";
import { ArrowBack, PlayArrow } from "@mui/icons-material";

import { ApiHttpError } from "../../api/client";
import { listCredentials } from "../../api/credentials";
import { createBot, startBot } from "../../api/bots";
import { listExchangeSymbols } from "../../api/exchanges";
import type { CredentialOut } from "../../api/types";

// Реестр стратегий — должен соответствовать default_registry() в движке
// (см. trade-engine-crypto/src/strategies/__init__.py).
const STRATEGIES = ["SmaCross"] as const;
type StrategyName = (typeof STRATEGIES)[number];

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"] as const;

// Дефолты параметров — должны проходить валидацию __init__ соответствующей стратегии.
function defaultParams(strategy: StrategyName): Record<string, string> {
  if (strategy === "SmaCross") {
    return {
      fast_period: "5",
      slow_period: "20",
      order_size: "0.001",
    };
  }
  return {};
}

function paramHint(strategy: StrategyName, key: string): string {
  if (strategy === "SmaCross") {
    if (key === "fast_period") return "Период короткой SMA (целое число)";
    if (key === "slow_period")
      return "Период длинной SMA — должен быть больше fast_period";
    if (key === "order_size") return "Размер ордера в базовой валюте (BTC)";
  }
  return "";
}

// JSONB params в API ожидает значения с правильным типом: числа — числами, строки — строками.
function coerceParams(strategy: StrategyName, raw: Record<string, string>): Record<string, unknown> {
  if (strategy === "SmaCross") {
    return {
      fast_period: Number(raw.fast_period ?? "5"),
      slow_period: Number(raw.slow_period ?? "20"),
      order_size: raw.order_size ?? "0.001", // Decimal как строка
    };
  }
  return raw;
}

export function CreateStrategy() {
  const navigate = useNavigate();

  const [creds, setCreds] = useState<CredentialOut[] | null>(null);
  const [credId, setCredId] = useState<string>("");
  const [strategy, setStrategy] = useState<StrategyName>("SmaCross");
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [timeframe, setTimeframe] = useState<string>("1m");
  const [params, setParams] = useState<Record<string, string>>(defaultParams("SmaCross"));
  const [topSymbols, setTopSymbols] = useState<string[]>([]);
  const [symbolsLoading, setSymbolsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedCred = useMemo(
    () => creds?.find((c) => c.id === credId),
    [creds, credId],
  );

  useEffect(() => {
    listCredentials()
      .then((data) => {
        setCreds(data);
        if (data.length > 0 && !credId) setCredId(data[0].id);
      })
      .catch((err) =>
        setError(err instanceof ApiHttpError ? err.message : "Не удалось загрузить ключи"),
      );
  }, [credId]);

  // Топ-10 USDT-пар выбранной биржи. Кэшируется на бэке (Redis, TTL 1ч),
  // здесь просто дёргаем при смене credential.
  useEffect(() => {
    if (!selectedCred) return;
    setSymbolsLoading(true);
    listExchangeSymbols(selectedCred.exchange)
      .then(setTopSymbols)
      .catch(() => setTopSymbols([]))
      .finally(() => setSymbolsLoading(false));
  }, [selectedCred]);

  const onStrategyChange = (name: StrategyName) => {
    setStrategy(name);
    setParams(defaultParams(name));
  };

  const handleSubmit = async (e: FormEvent, alsoStart: boolean) => {
    e.preventDefault();
    setError(null);
    if (!credId) {
      setError("Сначала добавьте API-ключи в Настройках.");
      return;
    }
    setBusy(true);
    try {
      const bot = await createBot({
        credential_id: credId,
        strategy_class: strategy,
        symbol: symbol.trim().toUpperCase(),
        timeframe,
        params: coerceParams(strategy, params),
      });
      if (alsoStart) {
        await startBot(bot.id);
      }
      navigate("/strategies");
    } catch (err) {
      setError(err instanceof ApiHttpError ? err.message : "Не удалось создать бота");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", pb: 6 }}>
      <Stack direction="row" alignItems="center" mb={4} spacing={2}>
        <IconButton component={RouterLink} to="/strategies" color="inherit">
          <ArrowBack />
        </IconButton>
        <Typography variant="h1">Новая стратегия</Typography>
      </Stack>

      <form onSubmit={(e) => handleSubmit(e, false)}>
        <Stack spacing={3}>
          {error && <Alert severity="error">{error}</Alert>}
          {creds !== null && creds.length === 0 && (
            <Alert severity="warning">
              У вас ещё нет API-ключей. Сначала добавьте их в{" "}
              <RouterLink to="/settings" style={{ color: "inherit" }}>
                <strong>Настройках</strong>
              </RouterLink>
              .
            </Alert>
          )}

          {/* Биржа и пара */}
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h2" mb={3}>
                1. Биржа и инструмент
              </Typography>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth size="small" required>
                    <InputLabel>API-ключи</InputLabel>
                    <Select
                      value={credId}
                      label="API-ключи"
                      onChange={(e) => setCredId(String(e.target.value))}
                      disabled={busy || creds === null || (creds?.length ?? 0) === 0}
                    >
                      {creds === null ? (
                        <MenuItem disabled>
                          <CircularProgress size={16} />
                        </MenuItem>
                      ) : (
                        creds.map((c) => (
                          <MenuItem key={c.id} value={c.id}>
                            {c.label} ({c.exchange})
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Autocomplete
                    freeSolo
                    value={symbol}
                    onChange={(_e, v) => setSymbol((v ?? "").toString())}
                    onInputChange={(_e, v) => setSymbol(v)}
                    options={topSymbols}
                    loading={symbolsLoading}
                    disabled={busy}
                    renderInput={(p) => (
                      <TextField
                        {...p}
                        label="Торговая пара"
                        size="small"
                        required
                        helperText={
                          topSymbols.length > 0
                            ? `Топ-${topSymbols.length} USDT-пар по объёму`
                            : "например, BTC/USDT"
                        }
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <FormControl fullWidth size="small" required>
                    <InputLabel>Таймфрейм</InputLabel>
                    <Select
                      value={timeframe}
                      label="Таймфрейм"
                      onChange={(e) => setTimeframe(String(e.target.value))}
                      disabled={busy}
                    >
                      {TIMEFRAMES.map((tf) => (
                        <MenuItem key={tf} value={tf}>
                          {tf}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Стратегия */}
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h2" mb={3}>
                2. Стратегия
              </Typography>
              <FormControl fullWidth size="small" required sx={{ mb: 3 }}>
                <InputLabel>Тип стратегии</InputLabel>
                <Select
                  value={strategy}
                  label="Тип стратегии"
                  onChange={(e) => onStrategyChange(e.target.value as StrategyName)}
                  disabled={busy}
                >
                  {STRATEGIES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Grid container spacing={2}>
                {Object.entries(params).map(([key, value]) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={key}>
                    <TextField
                      label={key}
                      size="small"
                      value={value}
                      onChange={(e) =>
                        setParams((p) => ({ ...p, [key]: e.target.value }))
                      }
                      fullWidth
                      helperText={paramHint(strategy, key)}
                      disabled={busy}
                    />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* Действия */}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="flex-end"
            spacing={2}
            pt={1}
          >
            <Button
              component={RouterLink}
              to="/strategies"
              variant="outlined"
              color="inherit"
              disabled={busy}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="secondary"
              disabled={busy || !credId}
              sx={{
                bgcolor: "#2a2e39",
                color: "white",
                "&:hover": { bgcolor: "#3b4050" },
              }}
            >
              Сохранить
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<PlayArrow />}
              disabled={busy || !credId}
              onClick={(e) => void handleSubmit(e, true)}
            >
              {busy ? "Создаём..." : "Сохранить и запустить"}
            </Button>
          </Stack>
        </Stack>
      </form>
    </Box>
  );
}
