import type { SxProps, Theme } from "@mui/material";

// Стиль попапа для MUI Autocomplete / Menu / Select — оформление в духе grok.com
// (glass-morphism, soft-radius). Переиспользуется в CreateStrategy и Backtest формах.
export const glassPopupSx: SxProps<Theme> = {
  mt: 1,
  borderRadius: 3,
  bgcolor: "rgba(20, 20, 22, 0.92)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
  "& .MuiAutocomplete-listbox": {
    padding: 0.5,
    "& .MuiAutocomplete-option": {
      borderRadius: 2,
      padding: "10px 12px",
      fontSize: "0.875rem",
      "&[aria-selected='true']": { bgcolor: "rgba(255,255,255,0.08)" },
      "&.Mui-focused": { bgcolor: "rgba(255,255,255,0.05)" },
    },
  },
};
