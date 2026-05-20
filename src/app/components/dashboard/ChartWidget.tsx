import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Box,
  FormControl,
  Select,
  MenuItem,
  Button,
  CircularProgress,
} from "@mui/material";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { fetchCandles } from "../../../api/candles";
import type { CandleOut } from "../../../api/types";
import { ApiHttpError } from "../../../api/client";

const SYMBOLS = ["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT"];
const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];

interface ChartPoint {
  time: string;
  close: number;
}

function formatTimestamp(iso: string, tf: string): string {
  const d = new Date(iso);
  if (tf === "1d" || tf === "1D") {
    return d.toLocaleDateString("ru-RU", { month: "short", day: "numeric" });
  }
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function ChartWidget() {
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [timeframe, setTimeframe] = useState("15m");
  const [candles, setCandles] = useState<CandleOut[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCandles("binance", symbol, timeframe)
      .then((data) => {
        if (cancelled) return;
        setCandles(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiHttpError ? err.message : "Ошибка загрузки графика",
        );
        setCandles(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe]);

  const chartData: ChartPoint[] =
    candles?.map((c) => ({
      time: c.timestamp,
      close: parseFloat(c.close),
    })) ?? [];

  const lastPrice =
    chartData.length > 0 ? chartData[chartData.length - 1].close : null;

  return (
    <Card
      sx={{
        height: "100%",
        minHeight: 400,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <CardContent
        sx={{ flex: 1, display: "flex", flexDirection: "column", p: 3 }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={2}
          mb={3}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small">
              <Select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                sx={{ minWidth: 120 }}
              >
                {SYMBOLS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack
              direction="row"
              spacing={0.5}
              bgcolor="background.default"
              p={0.5}
              borderRadius={1}
              border={1}
              borderColor="divider"
            >
              {TIMEFRAMES.map((tf) => (
                <Button
                  key={tf}
                  size="small"
                  variant={tf === timeframe ? "contained" : "text"}
                  color={tf === timeframe ? "primary" : "inherit"}
                  onClick={() => setTimeframe(tf)}
                  sx={{ minWidth: 0, px: 1.5, py: 0.5 }}
                >
                  {tf}
                </Button>
              ))}
            </Stack>
          </Stack>
          {lastPrice !== null && (
            <Typography variant="h6" fontWeight="bold">
              ${lastPrice.toFixed(2)}
            </Typography>
          )}
        </Stack>

        <Box sx={{ flex: 1, minHeight: 300 }}>
          {loading ? (
            <Box
              sx={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CircularProgress size={32} />
            </Box>
          ) : error ? (
            <Box
              sx={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography variant="body1" color="error.main">
                {error}
              </Typography>
            </Box>
          ) : chartData.length === 0 ? (
            <Box
              sx={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "background.default",
                borderRadius: 2,
                border: 1,
                borderColor: "divider",
              }}
            >
              <Typography variant="body1" color="text.secondary">
                Нет данных
              </Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="time"
                  tickFormatter={(t: string) => formatTimestamp(t, timeframe)}
                  fontSize={11}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={["auto", "auto"]}
                  fontSize={11}
                  tickFormatter={(v: number) => v.toFixed(2)}
                />
                <Tooltip
                  labelFormatter={(t: string) => formatTimestamp(t, timeframe)}
                  formatter={(v: number) => [v.toFixed(2), "Цена"]}
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  dot={false}
                  color="#3b82f6"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
