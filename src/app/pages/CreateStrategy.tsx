import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router";
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
import { glassPopupSx } from "../styles/glassDropdown";

// Реестр стратегий — должен соответствовать default_registry() в движке
// (см. trade-engine-crypto/src/strategies/__init__.py).
const STRATEGIES = [
  "SmaCross",
  "RsiThreshold",
  "MacdCross",
  "BollingerBands",
  "BollingerRsi",
  "DcaStrategy",
  "SpotGridStrategy",
] as const;
type StrategyName = (typeof STRATEGIES)[number];

const STRATEGY_LABELS: Record<StrategyName, string> = {
  SmaCross: "SMA Cross",
  RsiThreshold: "RSI порог",
  MacdCross: "MACD Cross",
  BollingerBands: "Bollinger Bands",
  BollingerRsi: "BB + RSI",
  DcaStrategy: "DCA (накопление)",
  SpotGridStrategy: "Спотовый Grid",
};

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"] as const;

// Дефолты параметров — должны проходить валидацию __init__ соответствующей стратегии.
function defaultParams(strategy: StrategyName): Record<string, string> {
  switch (strategy) {
    case "SmaCross":
      return { fast_period: "5", slow_period: "20", order_size: "0.001" };
    case "RsiThreshold":
      return {
        rsi_period: "14",
        oversold: "30",
        overbought: "70",
        order_size: "0.001",
      };
    case "MacdCross":
      return {
        fast_period: "12",
        slow_period: "26",
        signal_period: "9",
        order_size: "0.001",
      };
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
      return {
        price_low: "60000",
        price_high: "70000",
        num_levels: "10",
        base_per_level: "0.001",
      };
  }
}

function paramHint(strategy: StrategyName, key: string): string {
  const hints: Record<string, string> = {
    fast_period: "Период короткой средней (целое число)",
    slow_period: "Период длинной средней — больше fast_period",
    signal_period: "Период сигнальной EMA (целое число)",
    rsi_period: "Период RSI (целое число, обычно 14)",
    bb_period: "Период скользящей для Bollinger Bands",
    period: "Период скользящей для Bollinger Bands",
    bb_std: "Множитель стандартного отклонения (обычно 2.0)",
    num_std: "Множитель стандартного отклонения (обычно 2.0)",
    oversold: "Нижний порог RSI для входа (BUY)",
    overbought: "Верхний порог RSI для выхода (SELL)",
    order_size: "Размер ордера в базовой валюте",
    buy_amount_quote: "Сумма покупки в quote-валюте за один интервал",
    interval_candles: "Каждые сколько свечей покупать (24 на 1h ≈ раз в сутки)",
    price_low: "Нижняя граница сетки (цена)",
    price_high: "Верхняя граница сетки (цена)",
    num_levels: "Количество уровней в сетке (≥2)",
    base_per_level: "Размер ордера на каждом уровне (базовая валюта)",
  };
  return hints[key] ?? "";
}

// JSONB params в API ожидает значения с правильным типом: числа — числами, Decimal — строками.
function coerceParams(
  strategy: StrategyName,
  raw: Record<string, string>,
): Record<string, unknown> {
  // Какие поля имеют целочисленный смысл — приводим к Number, остальное оставляем как строку.
  const intKeys = new Set([
    "fast_period",
    "slow_period",
    "signal_period",
    "rsi_period",
    "bb_period",
    "period",
    "interval_candles",
    "num_levels",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = intKeys.has(k) ? Number(v) : v;
  }
  return out;
}

function templateToStrategy(template: string | null): StrategyName {
  if (template === "dca") return "DcaStrategy";
  if (template === "grid") return "SpotGridStrategy";
  return "SmaCross";
}

export function CreateStrategy() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialStrategy = useMemo<StrategyName>(
    () => templateToStrategy(searchParams.get("template")),
    [searchParams],
  );

  const [creds, setCreds] = useState<CredentialOut[] | null>(null);
  const [credId, setCredId] = useState<string>("");
  const [strategy, setStrategy] = useState<StrategyName>(initialStrategy);
  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState<string>("1m");
  const [params, setParams] = useState<Record<string, string>>(
    defaultParams(initialStrategy),
  );
  const [topSymbols, setTopSymbols] = useState<string[]>([]);
  const [symbolsLoading, setSymbolsLoading] = useState(false);
  const [symbolsError, setSymbolsError] = useState<string | null>(null);

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

  // Топ-N USDT-пар выбранной биржи. Кэшируется на бэке (Redis, TTL 1ч),
  // здесь дёргаем при смене credential.
  useEffect(() => {
    if (!selectedCred) {
      setTopSymbols([]);
      return;
    }
    setSymbolsLoading(true);
    setSymbolsError(null);
    listExchangeSymbols(selectedCred.exchange)
      .then((list) => {
        setTopSymbols(list);
        // Сбрасываем выбранный символ если он не в списке новой биржи
        setSymbol((cur) => (cur && list.includes(cur) ? cur : ""));
      })
      .catch((err) => {
        setTopSymbols([]);
        setSymbolsError(
          err instanceof ApiHttpError
            ? err.message
            : "Не удалось загрузить список пар",
        );
      })
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
    if (!symbol) {
      setError("Выберите торговую пару.");
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
                      MenuProps={{ slotProps: { paper: { sx: glassPopupSx } } }}
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
                    value={symbol || null}
                    onChange={(_e, v) => setSymbol(v ?? "")}
                    options={topSymbols}
                    loading={symbolsLoading}
                    disabled={busy || !selectedCred}
                    disableClearable={topSymbols.length === 0 ? undefined : undefined}
                    isOptionEqualToValue={(opt, val) => opt === val}
                    slotProps={{ paper: { sx: glassPopupSx } }}
                    noOptionsText={
                      symbolsError
                        ? symbolsError
                        : !selectedCred
                          ? "Сначала выберите биржу"
                          : "Нет доступных пар"
                    }
                    loadingText="Загружаем пары..."
                    renderInput={(p) => (
                      <TextField
                        {...p}
                        label="Торговая пара"
                        size="small"
                        required
                        helperText={
                          symbolsError
                            ? symbolsError
                            : topSymbols.length > 0
                              ? `Топ-${topSymbols.length} USDT-пар по объёму`
                              : "Выберите пару из списка"
                        }
                        error={Boolean(symbolsError)}
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
                      MenuProps={{ slotProps: { paper: { sx: glassPopupSx } } }}
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
                  MenuProps={{ slotProps: { paper: { sx: glassPopupSx } } }}
                >
                  {STRATEGIES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {STRATEGY_LABELS[s]}
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
