import { Box, IconButton, Toolbar, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from "@mui/material";
import { AutoGraph, CurrencyBitcoin, Dashboard, GitHub, ShowChart, History, ReceiptLong, Settings } from "@mui/icons-material";
import { NavLink, useLocation } from "react-router";
import { useTheme } from "@mui/material/styles";

const navItems = [
  { to: "/", icon: Dashboard, label: "Dashboard" },
  { to: "/strategies", icon: AutoGraph, label: "Стратегии" },
  { to: "/trades", icon: History, label: "Сделки" },
  { to: "/backtesting", icon: ShowChart, label: "Бэктестинг" },
  { to: "/logs", icon: ReceiptLong, label: "Логи" },
  { to: "/settings", icon: Settings, label: "Настройки" },
];

interface SidebarProps {
  isMini: boolean;
  isMobile: boolean;
  setMobileOpen: (open: boolean) => void;
}

export function Sidebar({ isMini, isMobile, setMobileOpen }: SidebarProps) {
  const theme = useTheme();
  const location = useLocation();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflowX: "hidden",
      }}
    >
      <Toolbar
        sx={{
          px: 2.5,
          justifyContent: "flex-start",
          gap: 1.5,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <CurrencyBitcoin color="primary" sx={{ fontSize: 28, flexShrink: 0 }} />
        <Typography
          variant="h6"
          color="text.primary"
          fontWeight="bold"
          noWrap
          sx={{
            opacity: isMini ? 0 : 1,
            transition: "opacity 0.2s",
            letterSpacing: "-0.01em",
          }}
        >
          Crypto Dashboard
        </Typography>
      </Toolbar>
      <List
        sx={{
          px: 2,
          py: 3,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
        }}
      >
        {navItems.map((item) => {
          const active =
            location.pathname === item.to ||
            (item.to !== "/" && location.pathname.startsWith(item.to));
          return (
            <ListItem key={item.to} disablePadding>
              <ListItemButton
                component={NavLink}
                to={item.to}
                onClick={() => isMobile && setMobileOpen(false)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  justifyContent: "flex-start",
                  px: 2,
                  bgcolor: active ? "rgba(59, 130, 246, 0.1)" : "transparent",
                  color: active ? "primary.main" : "text.secondary",
                  "&:hover": {
                    bgcolor: active
                      ? "rgba(59, 130, 246, 0.15)"
                      : "action.hover",
                    color: active ? "primary.main" : "text.primary",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    justifyContent: "flex-start",
                    color: "inherit",
                  }}
                >
                  <item.icon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontWeight: 500, noWrap: true }}
                  sx={{ opacity: isMini ? 0 : 1, transition: "opacity 0.2s" }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Box
        sx={{
          p: 1.5,
          borderTop: `1px solid ${theme.palette.divider}`,
          display: "flex",
          alignItems: "center",
          justifyContent: isMini ? "center" : "space-between",
          gap: 1,
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          sx={{ opacity: isMini ? 0 : 1, transition: "opacity 0.2s" }}
          title={`Build: ${__BUILD_DATE__}`}
        >
          v{__APP_VERSION__} · {__GIT_COMMIT__}
        </Typography>
        <IconButton
          size="small"
          component="a"
          href="https://github.com/VadimDenisovich/crypto-dashboard"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="GitHub repository"
          sx={{
            color: "text.secondary",
            "&:hover": { color: "text.primary" },
          }}
        >
          <GitHub fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}
