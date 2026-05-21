import { useEffect, useState } from "react";
import { Card, CardContent, Typography, Stack, Box, CircularProgress } from "@mui/material";

import { fetchBalanceSummary } from "../../../api/balances";
import type { BalanceSummaryOut } from "../../../api/types";
import { ApiHttpError } from "../../../api/client";

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

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchBalanceSummary()
        .then((summary) => {
          if (cancelled) return;
          setData(summary);
          setError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof ApiHttpError ? err.message : "Ошибка загрузки");
          setData(null);
        });
    };
    load();
    const t = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

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
                color={error ? "text.disabled" : equity === 0 && !hasBalances ? "warning.main" : "text.primary"}
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
                Свободно: {data?.free_total}{" "}
                &middot; В ордерах: {data?.used_total}
                <br />
                <Typography variant="caption" color="text.disabled">
                  Данные: {ago(lastSeen)}
                </Typography>
              </Typography>
            ) : null}

            <Stack spacing={1.5} pt={2} mt={2} borderTop={1} borderColor="divider">
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
                    ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)} USDT`
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
