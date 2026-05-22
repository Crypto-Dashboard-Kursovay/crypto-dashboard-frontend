import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { PlayArrow } from "@mui/icons-material";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ApiHttpError } from "../../api/client";
import {
  getBacktest,
  runBacktest,
  type BacktestJobOut,
  type BacktestRunIn,
} from "../../api/backtest";
import { listSupportedExchanges, listExchangeSymbols } from "../../api/exchanges";
import type { ExchangeMeta } from "../../api/types";
import { glassPopupSx } from "../styles/glassDropdown";
import { BacktestRunningIndicator } from "../components/BacktestRunningIndicator";

const STRATEGIES = [
  "SmaCross",
  "RsiThreshold",
  "AdaptiveRsi",
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
  AdaptiveRsi: "Адаптивный RSI",
  MacdCross: "MACD Cross",
  BollingerBands: "Bollinger Bands",
  BollingerRsi: "BB + RSI",
  DcaStrategy: "DCA",
  SpotGridStrategy: "Спотовый Grid",
};

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"] as const;

function defaultParams(s: StrategyName): Record<string, string> {
  switch (s) {
    case "SmaCross":
      return { fast_period: "5", slow_period: "20", order_size: "0.001" };
    case "RsiThreshold":
      return {
        rsi_period: "14",
        oversold: "30",
        overbought: "70",
        order_size: "0.001",
      };
    case "AdaptiveRsi":
      return {
        optimization_candles: "500",
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

function coerceParams(raw: Record<string, string>): Record<string, unknown> {
  const intKeys = new Set([
    "fast_period",
    "slow_period",
    "signal_period",
    "rsi_period",
    "bb_period",
    "period",
    "interval_candles",
    "num_levels",
    "optimization_candles",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = intKeys.has(k) ? Number(v) : v;
  }
  return out;
}

function toIsoStartOfDay(d: string): string {
  // d = "YYYY-MM-DD"
  return new Date(`${d}T00:00:00Z`).toISOString();
}

function toIsoEndOfDay(d: string): string {
  return new Date(`${d}T23:59:59Z`).toISOString();
}

export function Backtesting() {
  const [strategy, setStrategy] = useState<StrategyName>("SmaCross");
  const [exchanges, setExchanges] = useState<ExchangeMeta[]>([]);
  const [exchange, setExchange] = useState("binance");
  const [symbol, setSymbol] = useState("");
  const [topSymbols, setTopSymbols] = useState<string[]>([]);
  const [symbolsLoading, setSymbolsLoading] = useState(false);
  const [symbolsError, setSymbolsError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState("1h");
  const [dateFrom, setDateFrom] = useState("2024-01-01");
  const [dateTo, setDateTo] = useState("2024-06-30");
  const [initialBalance, setInitialBalance] = useState("10000");
  const [params, setParams] = useState<Record<string, string>>(defaultParams("SmaCross"));

  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<BacktestJobOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tradesVisible, setTradesVisible] = useState(100);

  // Автозагрузка сделок: каждые 200мс +100 пока не покажем все
  useEffect(() => {
    if (!job?.result) return;
    const total = job.result.trades.length;
    if (tradesVisible >= total) return;
    const timer = setTimeout(() => {
      setTradesVisible(prev => Math.min(prev + 100, total));
    }, 200);
    return () => clearTimeout(timer);
  }, [tradesVisible, job?.result]);

  const onStrategyChange = (name: StrategyName) => {
    setStrategy(name);
    setParams(defaultParams(name));
  };

  // Список поддерживаемых бирж (для селекта).
  useEffect(() => {
    listSupportedExchanges()
      .then((list) => {
        setExchanges(list);
        if (list.length > 0) {
          setExchange((cur) =>
            list.some((e) => e.name === cur) ? cur : list[0].name,
          );
        }
      })
      .catch(() => setExchanges([]));
  }, []);

  // Разрешённые пары выбранной биржи (BTC/SOL/XRP/BNB/ETH к USDT). Кэш на бэке.
  useEffect(() => {
    if (!exchange) return;
    setSymbolsLoading(true);
    setSymbolsError(null);
    listExchangeSymbols(exchange)
      .then((list) => {
        setTopSymbols(list);
        setSymbol((cur) => (cur && list.includes(cur) ? cur : (list[0] ?? "")));
      })
      .catch((err) => {
        setTopSymbols([]);
        setSymbolsError(
          err instanceof ApiHttpError ? err.message : "Не удалось загрузить пары",
        );
      })
      .finally(() => setSymbolsLoading(false));
  }, [exchange]);

  // Polling result while running
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const j = await getBacktest(jobId);
        if (cancelled) return;
        setJob(j);
        if (j.status === "completed" || j.status === "failed") {
          return; // stop polling
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiHttpError ? err.message : "Не удалось получить статус",
        );
      }
    };
    void tick();
    const interval = setInterval(() => {
      if (job?.status === "completed" || job?.status === "failed") return;
      void tick();
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobId, job?.status]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setTradesVisible(100);
    try {
      const body: BacktestRunIn = {
        strategy_class: strategy,
        exchange,
        symbol: symbol.trim().toUpperCase(),
        timeframe,
        params: coerceParams(params),
        date_from: toIsoStartOfDay(dateFrom),
        date_to: toIsoEndOfDay(dateTo),
        initial_balance: { USDT: initialBalance.trim() || "10000" },
      };
      const j = await runBacktest(body);
      setJobId(j.id);
      setJob(j);
    } catch (err) {
      setError(
        err instanceof ApiHttpError ? err.message : "Не удалось запустить backtest",
      );
    } finally {
      setBusy(false);
    }
  };

  const result = job?.result ?? null;
  const equityChart = useMemo(() => {
    if (!result) return [];
    return result.equity_curve.map((p) => ({
      time: new Date(p.timestamp).getTime(),
      equity: Number(p.equity),
    }));
  }, [result]);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        mb={3}
      >
        <Typography variant="h1">Бэктестинг стратегий</Typography>
      </Stack>

      <Grid container spacing={2} sx={{ flex: 1, minHeight: 0 }}>
        {/* Левая колонка — форма */}
        <Grid size={{ xs: 12, md: 4, lg: 3 }}>
          <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <CardContent
              sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}
            >
              <Typography variant="h3">Параметры теста</Typography>
              <form onSubmit={onSubmit}>
                <Stack spacing={2}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Стратегия</InputLabel>
                    <Select
                      value={strategy}
                      label="Стратегия"
                      onChange={(e) => onStrategyChange(e.target.value as StrategyName)}
                      MenuProps={{ slotProps: { paper: { sx: glassPopupSx } } }}
                    >
                      {STRATEGIES.map((s) => (
                        <MenuItem key={s} value={s}>
                          {STRATEGY_LABELS[s]}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" fullWidth>
                    <InputLabel>Биржа</InputLabel>
                    <Select
                      value={exchange}
                      label="Биржа"
                      onChange={(e) => setExchange(String(e.target.value))}
                      MenuProps={{ slotProps: { paper: { sx: glassPopupSx } } }}
                    >
                      {exchanges.map((ex) => (
                        <MenuItem key={ex.name} value={ex.name}>
                          {ex.display_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Autocomplete
                    value={symbol || null}
                    onChange={(_e, v) => setSymbol(v ?? "")}
                    options={topSymbols}
                    loading={symbolsLoading}
                    isOptionEqualToValue={(opt, val) => opt === val}
                    slotProps={{ paper: { sx: glassPopupSx } }}
                    noOptionsText={symbolsError ?? "Нет доступных пар"}
                    loadingText="Загружаем пары..."
                    renderInput={(p) => (
                      <TextField
                        {...p}
                        label="Пара"
                        size="small"
                        required
                        error={Boolean(symbolsError)}
                        helperText={symbolsError ?? "Выберите пару из списка"}
                      />
                    )}
                  />

                  <FormControl size="small" fullWidth>
                    <InputLabel>Таймфрейм</InputLabel>
                    <Select
                      value={timeframe}
                      label="Таймфрейм"
                      onChange={(e) => setTimeframe(String(e.target.value))}
                      MenuProps={{ slotProps: { paper: { sx: glassPopupSx } } }}
                    >
                      {TIMEFRAMES.map((tf) => (
                        <MenuItem key={tf} value={tf}>
                          {tf}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Stack direction="row" spacing={1}>
                    <TextField
                      label="С"
                      type="date"
                      size="small"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                    <TextField
                      label="По"
                      type="date"
                      size="small"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                  </Stack>

                  <TextField
                    label="Депозит USDT"
                    size="small"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    fullWidth
                  />

                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: "background.default",
                      borderRadius: 2,
                      border: 1,
                      borderColor: "divider",
                    }}
                  >
                    <Typography
                      variant="caption"
                      fontWeight="bold"
                      color="text.secondary"
                      display="block"
                      mb={1.5}
                    >
                      Параметры стратегии
                    </Typography>
                    <Stack spacing={1.5}>
                      {Object.entries(params).map(([k, v]) => (
                        <TextField
                          key={k}
                          label={k}
                          size="small"
                          value={v}
                          onChange={(e) =>
                            setParams((p) => ({ ...p, [k]: e.target.value }))
                          }
                          fullWidth
                        />
                      ))}
                    </Stack>
                  </Box>

                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    startIcon={
                      busy ? <CircularProgress size={14} color="inherit" /> : <PlayArrow />
                    }
                    disabled={busy || !symbol}
                    size="large"
                  >
                    {busy ? "Запускаем..." : "Запустить бэктест"}
                  </Button>
                </Stack>
              </form>
              {error && (
                <Alert severity="error" onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Правая колонка — результаты */}
        <Grid
          size={{ xs: 12, md: 8, lg: 9 }}
          sx={{ display: "flex", flexDirection: "column", gap: 3 }}
        >
          {!job ? (
            <Card sx={{ flex: 1, display: "flex" }}>
              <CardContent
                sx={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Stack alignItems="center" spacing={1}>
                  <Typography variant="body1" color="text.secondary">
                    Заполните форму слева и нажмите «Запустить бэктест»
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    Результаты появятся здесь
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          ) : job.status === "queued" || job.status === "running" ? (
            <Card sx={{ flex: 1, display: "flex" }}>
              <CardContent
                sx={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BacktestRunningIndicator />
              </CardContent>
            </Card>
          ) : job.status === "failed" ? (
            <Alert severity="error">
              <Typography variant="body2" fontWeight="bold">
                Backtest упал:
              </Typography>
              <Typography variant="body2">{job.error_message}</Typography>
            </Alert>
          ) : (
            result && (
              <>
                {/* Метрики */}
                <Card>
                  <CardContent sx={{ py: 2.5, "&:last-child": { pb: 2.5 } }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={2}
                      justifyContent="space-between"
                      divider={
                        <Divider
                          orientation="vertical"
                          flexItem
                          sx={{ display: { xs: "none", sm: "block" } }}
                        />
                      }
                    >
                      <MetricCell
                        label="Доходность"
                        value={`${Number(result.total_return_pct).toFixed(2)}%`}
                        color={Number(result.total_return_pct) >= 0 ? "success.main" : "error.main"}
                      />
                      <MetricCell
                        label="Profit Factor"
                        value={
                          result.profit_factor
                            ? Number(result.profit_factor).toFixed(2)
                            : "—"
                        }
                      />
                      <MetricCell
                        label="Sharpe"
                        value={
                          result.sharpe_ratio
                            ? Number(result.sharpe_ratio).toFixed(2)
                            : "—"
                        }
                      />
                      <MetricCell
                        label="Max DD"
                        value={`${Number(result.max_drawdown_pct).toFixed(2)}%`}
                        color="error.main"
                      />
                      <MetricCell
                        label="Win rate"
                        value={`${Number(result.win_rate).toFixed(0)}%`}
                      />
                      <MetricCell label="Сделок" value={String(result.trades_count)} />
                    </Stack>
                  </CardContent>
                </Card>

                {/* Equity curve */}
                <Card sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <CardContent
                    sx={{ flex: 1, display: "flex", flexDirection: "column" }}
                  >
                    <Typography variant="subtitle2" color="text.secondary" mb={2}>
                      Кривая доходности (Equity)
                    </Typography>
                    <Box sx={{ flex: 1, width: "100%", minHeight: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={equityChart}
                          margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#2a2e39"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="time"
                            stroke="#64748b"
                            fontSize={12}
                            tickFormatter={(t) =>
                              new Date(t).toLocaleDateString("ru-RU", {
                                month: "short",
                                day: "numeric",
                              })
                            }
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            domain={["auto", "auto"]}
                            stroke="#64748b"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1e222d",
                              borderColor: "#2a2e39",
                              color: "#fff",
                            }}
                            labelFormatter={(t) =>
                              new Date(Number(t)).toLocaleString("ru-RU")
                            }
                          />
                          <Line
                            type="monotone"
                            dataKey="equity"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>

                {/* Trades table */}
                <Card>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Сделки ({result.trades.length})
                      </Typography>
                      {tradesVisible < result.trades.length && (
                        <Typography variant="caption" color="text.secondary">
                          Загрузка... {tradesVisible}/{result.trades.length}
                        </Typography>
                      )}
                    </Stack>
                    <Box sx={{ maxHeight: 280, overflowY: "auto" }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Время</TableCell>
                            <TableCell>Сторона</TableCell>
                            <TableCell align="right">Цена</TableCell>
                            <TableCell align="right">Объём</TableCell>
                            <TableCell align="right">PnL</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {result.trades.slice(0, tradesVisible).map((t, i) => (
                            <TableRow key={i} hover>
                              <TableCell>
                                {new Date(t.timestamp).toLocaleString("ru-RU")}
                              </TableCell>
                              <TableCell>
                                <Typography
                                  variant="body2"
                                  color={
                                    t.side === "buy" ? "success.main" : "error.main"
                                  }
                                >
                                  {t.side === "buy" ? "Buy" : "Sell"}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                {Number(t.price).toFixed(2)}
                              </TableCell>
                              <TableCell align="right">{t.size}</TableCell>
                              <TableCell
                                align="right"
                                sx={{
                                  color:
                                    t.pnl === null
                                      ? "text.secondary"
                                      : Number(t.pnl) >= 0
                                        ? "success.main"
                                        : "error.main",
                                }}
                              >
                                {t.pnl === null ? "—" : Number(t.pnl).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  </CardContent>
                </Card>
              </>
            )
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

function MetricCell({
  label,
  value,
  color = "text.primary",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Box sx={{ textAlign: "center", flex: 1 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        mb={0.5}
        noWrap
      >
        {label}
      </Typography>
      <Typography variant="h5" fontWeight="bold" sx={{ color }}>
        {value}
      </Typography>
    </Box>
  );
}
