import type { ReactNode } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import type { DialogProps } from "@mui/material/Dialog";
import { Close } from "@mui/icons-material";

interface PerplexityDialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  maxWidth?: DialogProps["maxWidth"];
  fullWidth?: boolean;
  children: ReactNode;
  actions?: ReactNode;
  /** Запрещает закрытие через ESC / backdrop-click (нужно во время API-вызовов). */
  disableClose?: boolean;
}

/**
 * Единый стиль модалок проекта — округлые углы, glass-фон, X-иконка
 * закрытия в правом верхнем углу. Поверх глобальных MuiDialog overrides
 * из theme.ts.
 */
export function PerplexityDialog({
  open,
  onClose,
  title,
  subtitle,
  maxWidth = "sm",
  fullWidth = true,
  children,
  actions,
  disableClose,
}: PerplexityDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (disableClose && (reason === "backdropClick" || reason === "escapeKeyDown")) return;
        onClose();
      }}
      fullWidth={fullWidth}
      maxWidth={maxWidth}
    >
      <IconButton
        onClick={onClose}
        size="small"
        aria-label="Закрыть"
        disabled={disableClose}
        sx={{
          position: "absolute",
          top: 12,
          right: 12,
          color: "text.secondary",
          "&:hover": { color: "text.primary" },
        }}
      >
        <Close fontSize="small" />
      </IconButton>
      {(title || subtitle) && (
        <DialogTitle sx={{ pr: 6 }}>
          <Stack spacing={0.5}>
            {title && <span>{title}</span>}
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
                {subtitle}
              </Typography>
            )}
          </Stack>
        </DialogTitle>
      )}
      <DialogContent>{children}</DialogContent>
      {actions && <DialogActions>{actions}</DialogActions>}
    </Dialog>
  );
}
