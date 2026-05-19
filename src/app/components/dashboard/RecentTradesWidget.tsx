import { useEffect, useState } from "react";
import {
  Card,
  Box,
  Typography,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  CircularProgress,
} from "@mui/material";
import { PlayCircleOutline } from "@mui/icons-material";

import { ApiHttpError } from "../../../api/client";
import { listTrades, type TradeOut } from "../../../api/trades";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function RecentTradesWidget() {
  const [trades, setTrades] = useState<TradeOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      listTrades({ limit: 10 })
        .then((list) => {
          if (cancelled) return;
          setTrades(list);
          setError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(
            err instanceof ApiHttpError ? err.message : "Не удалось загрузить сделки",
          );
          setTrades([]);
        });
    };
    load();
    const t = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <Card sx={{ height: "100%" }}>
      <Box
        p={2}
        borderBottom={1}
        borderColor="divider"
        display="flex"
        justifyContent="space-between"
        alignItems="center"
      >
        <Typography variant="subtitle2" color="text.secondary">
          История последних сделок
        </Typography>
        <Chip
          size="small"
          icon={<PlayCircleOutline />}
          label="Автообновление"
          color="success"
          variant="outlined"
          sx={{ border: "none" }}
        />
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Время</TableCell>
              <TableCell>Пара</TableCell>
              <TableCell>Сторона</TableCell>
              <TableCell align="right">Цена</TableCell>
              <TableCell align="right">Объём</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {trades === null ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Box py={2} display="flex" justifyContent="center">
                    <CircularProgress size={20} />
                  </Box>
                </TableCell>
              </TableRow>
            ) : trades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.disabled" py={2}>
                    {error ?? "Нет сделок"}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              trades.map((trade) => (
                <TableRow key={trade.id} hover>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {formatTime(trade.created_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium" noWrap>
                      {trade.symbol}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color={trade.side === "buy" ? "success.main" : "error.main"}
                    >
                      {trade.side === "buy" ? "Buy" : "Sell"}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" noWrap>
                      {trade.price}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" noWrap>
                      {trade.size}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}
