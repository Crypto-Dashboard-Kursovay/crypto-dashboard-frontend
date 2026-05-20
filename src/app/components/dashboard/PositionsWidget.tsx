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
  CircularProgress,
} from "@mui/material";

import { apiFetch } from "../../../api/client";
import type { PositionOut } from "../../../api/types";

export function PositionsWidget() {
  const [positions, setPositions] = useState<PositionOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // Gather positions across all credentials.
        const creds = await apiFetch<{ id: string }[]>(
          "/api/exchange-credentials",
        );
        const all: PositionOut[] = [];
        for (const c of creds) {
          try {
            const p = await apiFetch<PositionOut[]>(
              `/api/positions?credential_id=${c.id}`,
            );
            all.push(...p);
          } catch {
            // skip credentials that fail
          }
        }
        if (cancelled) return;
        setPositions(all);
        setError(null);
      } catch {
        if (cancelled) return;
        setError("Не удалось загрузить позиции");
        setPositions([]);
      }
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
      <Box p={2} borderBottom={1} borderColor="divider">
        <Typography variant="subtitle2" color="text.secondary">
          Открытые позиции
        </Typography>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Пара / Тип</TableCell>
              <TableCell align="right">Объём / P&L</TableCell>
              <TableCell align="right">Цена входа</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {positions === null ? (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  <Box py={2} display="flex" justifyContent="center">
                    <CircularProgress size={20} />
                  </Box>
                </TableCell>
              </TableRow>
            ) : positions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  <Typography variant="body2" color="text.disabled" py={2}>
                    {error ?? "Нет открытых позиций"}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              positions.map((pos) => (
                <TableRow key={pos.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {pos.symbol}
                    </Typography>
                    <Typography
                      variant="caption"
                      color={
                        pos.side === "buy" ? "success.main" : "error.main"
                      }
                    >
                      {pos.side === "buy" ? "Long" : "Short"}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{pos.size}</Typography>
                    <Typography
                      variant="caption"
                      color={
                        parseFloat(pos.current_pnl) >= 0
                          ? "success.main"
                          : "error.main"
                      }
                    >
                      {parseFloat(pos.current_pnl) >= 0 ? "+" : ""}
                      {pos.current_pnl}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{pos.entry_price}</Typography>
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
