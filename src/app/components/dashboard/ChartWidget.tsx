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
} from "@mui/material";

// Без бэк-эндпоинта /api/candles виджет показывает только UI-скелет.
// Селект пары/таймфрейма оставлен как заглушка, disabled.
export function ChartWidget() {
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
            <FormControl size="small" disabled>
              <Select defaultValue="BTC/USDT" sx={{ minWidth: 120 }}>
                <MenuItem value="BTC/USDT">BTC/USDT</MenuItem>
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
              {["1m", "5m", "15m", "1h"].map((tf) => (
                <Button
                  key={tf}
                  size="small"
                  variant={tf === "15m" ? "contained" : "text"}
                  color={tf === "15m" ? "primary" : "inherit"}
                  sx={{ minWidth: 0, px: 1.5, py: 0.5 }}
                  disabled
                >
                  {tf}
                </Button>
              ))}
            </Stack>
          </Stack>
        </Stack>

        <Box
          sx={{
            flex: 1,
            minHeight: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "background.default",
            borderRadius: 2,
            border: 1,
            borderColor: "divider",
          }}
        >
          <Stack alignItems="center" spacing={1}>
            <Typography variant="body1" color="text.secondary">
              График появится позже
            </Typography>
            <Typography variant="caption" color="text.disabled" maxWidth={360} textAlign="center">
              Нужен бэк-эндпоинт `/api/candles/{`{exchange}/{symbol}/{timeframe}`}` —
              добавим в следующей фазе.
            </Typography>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
