import { Card, CardContent, Typography, Stack, Box } from "@mui/material";

// Без бэк-эндпоинта /api/balances/summary показываем placeholder.
// Подключится позже когда добавим суммарный балансовый сервис.
export function BalanceWidget() {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Баланс и P&L
        </Typography>
        <Stack direction="row" alignItems="baseline" spacing={1} mb={0.5}>
          <Typography variant="h4" fontWeight="bold" color="text.disabled">
            —
          </Typography>
          <Typography variant="body1" color="text.secondary">
            USDT
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.disabled">
          Нет данных
        </Typography>

        <Stack spacing={1.5} pt={2} mt={2} borderTop={1} borderColor="divider">
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Открытая прибыль/убыток
            </Typography>
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Количество позиций
            </Typography>
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          </Stack>
        </Stack>

        <Box mt={2}>
          <Typography variant="caption" color="text.disabled">
            Баланс подключится, когда добавим /api/balances/summary.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
