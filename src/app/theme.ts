import { createTheme } from '@mui/material/styles';

// Grok-style dark theme: near-black background, glass card, soft radius,
// тонкие borders с alpha. Primary — белый (как у grok.com), оставляем синий
// как secondary для возможного будущего accent.

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#ffffff', contrastText: '#0a0a0a' },
    secondary: { main: '#3b82f6' },
    success: { main: '#22c55e' },
    error: { main: '#ef4444' },
    warning: { main: '#f97316' },
    info: { main: '#0ea5e9' },
    background: { default: '#0a0a0a', paper: '#141416' },
    divider: 'rgba(255, 255, 255, 0.08)',
    text: { primary: '#f8fafc', secondary: '#94a3b8' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '1.625rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2 },
    h2: { fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h3: { fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.01em' },
    body1: { letterSpacing: '-0.005em' },
    button: { textTransform: 'none', fontWeight: 500, letterSpacing: '-0.005em' },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: 'none',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          backgroundColor: 'rgba(20, 20, 22, 0.6)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 12, textTransform: 'none', fontWeight: 500 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.12)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.25)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.45)',
            borderWidth: 1,
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(15, 15, 17, 0.85)',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(15, 15, 17, 0.6)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          backgroundImage: 'none',
          boxShadow: 'none',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: '1px solid rgba(255, 255, 255, 0.06)', padding: '12px 16px' },
        head: { color: '#94a3b8', fontWeight: 600, backgroundColor: 'rgba(20, 20, 22, 0.5)' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: 'rgba(20, 20, 22, 0.95)', border: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.75rem' },
      },
    },
  },
});
