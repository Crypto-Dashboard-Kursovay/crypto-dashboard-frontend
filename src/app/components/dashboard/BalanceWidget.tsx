import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Box,
  CircularProgress,
} from "@mui/material";

import { fetchBalanceSummary } from "../../../api/balances";
import type { BalanceSummaryOut } from "../../../api/types";
import { ApiHttpError } from "../../../api/client";
import { useLogsOptional } from "../../LogsContext";

const BALANCE_REFRESH_INTERVAL_MS = 5_000;

function ago(iso: string | null): string {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}с назад`;
  if (diff < 3600) return `${Math.round(diff / 60)}м назад`;
  return `${Math.round(diff / 3600)}ч назад`;
}

export function BalanceWidget() {
  const [data, setData] = useState<BalanceSummaryOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const logs = useLogsOptional();
  const lastBalanceUpdateAt = logs?.lastBalanceUpdateAt ?? 0;

  const load = useCallback(() => {
    fetchBalanceSummary()
      .then((summary) => {
        if (!mountedRef.current) return;
        setData(summary);
        setError(null);
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        setError(
          err instanceof ApiHttpError ? err.message : "Ошибка загрузки",
        );
        setData(null);
      });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };
    load();
    const t = setInterval(load, BALANCE_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      mountedRef.current = false;
      clearInterval(t);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [load]);

  useEffect(() => {
    if (lastBalanceUpdateAt > 0) {
      load();
    }
  }, [lastBalanceUpdateAt, load]);

  const equity = data ? parseFloat(data.total_equity) : null;
  const pnl = data ? parseFloat(data.open_pnl) : null;
  const posCount = data?.position_count ?? null;
  const hasBalances = data && data.currencies && data.currencies.length > 0;
  const lastSeen = data?.last_observed_at ?? null;

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Баланс и P&L
        </Typography>

        {data === null && error === null ? (
          <Box py={2} display="flex" justifyContent="center">
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            <Stack direction="row" alignItems="baseline" spacing={1} mb={0.5}>
              <Typography
                variant="h4"
                fontWeight="bold"
                color={
                  error
                    ? "text.disabled"
                    : equity === 0 && !hasBalances
                      ? "warning.main"
                      : "text.primary"
                }
              >
                {equity !== null ? equity.toFixed(2) : "—"}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                USDT
              </Typography>
            </Stack>
            {error ? (
              <Typography variant="body2" color="error.main">
                {error}
              </Typography>
            ) : !hasBalances ? (
              <Typography variant="body2" color="warning.main">
                Нет данных от движка — engine не отправляет balance_update
              </Typography>
            ) : lastSeen ? (
              <Typography variant="body2" color="text.disabled">
                Свободно: {Number(data?.free_total)} &middot; В ордерах:{" "}
                {data?.used_total}
                <br />
                <Typography variant="caption" color="text.disabled">
                  Данные: {ago(lastSeen)}
                </Typography>
              </Typography>
            ) : null}

            <Stack
              spacing={1.5}
              pt={2}
              mt={2}
              borderTop={1}
              borderColor="divider"
            >
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Открытая прибыль/убыток
                </Typography>
                <Typography
                  variant="body2"
                  color={
                    pnl === null || pnl === 0
                      ? "text.disabled"
                      : pnl > 0
                        ? "success.main"
                        : "error.main"
                  }
                >
                  {pnl !== null
                    ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} USDT`
                    : "—"}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Количество позиций
                </Typography>
                <Typography variant="body2" color="text.primary">
                  {posCount !== null ? posCount : "—"}
                </Typography>
              </Stack>
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  );
}
