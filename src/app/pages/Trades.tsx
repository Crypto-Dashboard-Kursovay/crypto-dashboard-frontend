import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CircularProgress,
  FormControl,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import { ApiHttpError } from "../../api/client";
import { listTrades, type TradeOut } from "../../api/trades";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      dateStyle: "short",
      timeStyle: "medium",
    });
  } catch {
    return iso;
  }
}

function sumDecimals(values: string[]): number {
  return values.reduce((acc, v) => acc + (Number(v) || 0), 0);
}

export function Trades() {
  const [trades, setTrades] = useState<TradeOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pairFilter, setPairFilter] = useState("all");
  const [strategyFilter, setStrategyFilter] = useState("all");

  useEffect(() => {
    listTrades({ limit: 200 })
      .then((list) => {
        setTrades(list);
        setError(null);
      })
      .catch((err) => {
        setError(
          err instanceof ApiHttpError ? err.message : "Не удалось загрузить сделки",
        );
        setTrades([]);
      });
  }, []);

  const pairs = useMemo(() => {
    const set = new Set<string>();
    (trades ?? []).forEach((t) => set.add(t.symbol));
    return Array.from(set).sort();
  }, [trades]);

  const strategies = useMemo(() => {
    const set = new Set<string>();
    (trades ?? []).forEach((t) => t.strategy && set.add(t.strategy));
    return Array.from(set).sort();
  }, [trades]);

  const filtered = useMemo(() => {
    return (trades ?? []).filter((t) => {
      if (pairFilter !== "all" && t.symbol !== pairFilter) return false;
      if (strategyFilter !== "all" && t.strategy !== strategyFilter) return false;
      return true;
    });
  }, [trades, pairFilter, strategyFilter]);

  const totalSize = useMemo(
    () => sumDecimals(filtered.map((t) => t.size)),
    [filtered],
  );
  const totalFee = useMemo(
    () => sumDecimals(filtered.map((t) => t.fee)),
    [filtered],
  );

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", lg: "center" }}
        spacing={2}
        mb={4}
      >
        <Typography variant="h1">История сделок</Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          width={{ xs: "100%", lg: "auto" }}
        >
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={pairFilter}
              onChange={(e) => setPairFilter(String(e.target.value))}
            >
              <MenuItem value="all">Все пары</MenuItem>
              {pairs.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={strategyFilter}
              onChange={(e) => setStrategyFilter(String(e.target.value))}
            >
              <MenuItem value="all">Все стратегии</MenuItem>
              {strategies.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card
        sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <TableContainer sx={{ flex: 1, overflowX: "auto" }}>
          <Table stickyHeader sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Время</TableCell>
                <TableCell>Пара</TableCell>
                <TableCell>Стратегия</TableCell>
                <TableCell>Сторона</TableCell>
                <TableCell align="right">Цена</TableCell>
                <TableCell align="right">Объём</TableCell>
                <TableCell align="right">Комиссия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {trades === null ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Box py={3} display="flex" justifyContent="center">
                      <CircularProgress size={28} />
                    </Box>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.disabled" py={4}>
                      Сделок пока нет
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => (
                  <TableRow key={t.id} hover>
                    <TableCell>
                      <Typography
                        variant="caption"
                        fontFamily="monospace"
                        color="text.secondary"
                      >
                        {t.id.slice(0, 8)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {formatTime(t.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium" noWrap>
                        {t.symbol}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {t.strategy || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color={t.side === "buy" ? "success.main" : "error.main"}
                      >
                        {t.side === "buy" ? "Buy" : "Sell"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" noWrap>
                        {t.price}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" noWrap>
                        {t.size}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {t.fee}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {trades !== null && (
          <Box
            sx={{
              p: 2,
              bgcolor: "rgba(19, 23, 34, 0.5)",
              borderTop: 1,
              borderColor: "divider",
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                Всего сделок:
              </Typography>{" "}
              <Typography variant="body2" component="span" fontWeight="bold">
                {filtered.length}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Сумма объёма:
              </Typography>{" "}
              <Typography variant="body2" component="span" fontWeight="bold">
                {totalSize.toFixed(6)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Комиссии:
              </Typography>{" "}
              <Typography variant="body2" component="span" fontWeight="bold">
                {totalFee.toFixed(4)}
              </Typography>
            </Box>
          </Box>
        )}
      </Card>
    </Box>
  );
}
