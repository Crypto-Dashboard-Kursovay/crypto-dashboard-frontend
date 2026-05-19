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
} from "@mui/material";

// Источника данных по открытым позициям пока нет (ExchangeAdapter.get_positions
// добавится в Phase 5). Заглушка с placeholder-строкой.
export function PositionsWidget() {
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
              <TableCell align="right"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell colSpan={3} align="center">
                <Typography variant="body2" color="text.disabled" py={2}>
                  Нет открытых позиций
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}
