import {
  AppBar,
  Toolbar,
  IconButton,
  Stack,
  Typography,
  Tooltip,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Logout,
  CurrencyBitcoin,
  AccountCircleOutlined,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { Link as RouterLink } from "react-router";

import { useAuth } from "../../../auth/AuthContext";

interface HeaderProps {
  drawerWidth: number;
  isResizing: boolean;
  handleDrawerToggle: () => void;
}

export function Header({ drawerWidth, isResizing, handleDrawerToggle }: HeaderProps) {
  const theme = useTheme();
  const { user, logout } = useAuth();

  return (
    <AppBar
      position="fixed"
      sx={{
        width: { md: `calc(100% - ${drawerWidth}px)` },
        ml: { md: `${drawerWidth}px` },
        transition: isResizing
          ? "none"
          : theme.transitions.create(["width", "margin"], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between" }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 1, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ display: { xs: "flex", md: "none" } }}
          >
            <CurrencyBitcoin sx={{ fontSize: 22, color: "primary.main" }} />
            <Typography
              variant="h6"
              fontWeight={600}
              sx={{ letterSpacing: "-0.01em" }}
              noWrap
            >
              Crypto Dashboard
            </Typography>
          </Stack>
        </Stack>
        {user && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Tooltip title="Личный кабинет">
              <IconButton
                component={RouterLink}
                to="/cabinet"
                color="inherit"
                aria-label="Личный кабинет"
              >
                <AccountCircleOutlined />
              </IconButton>
            </Tooltip>
            <Tooltip title="Выйти">
              <IconButton color="inherit" onClick={logout} aria-label="Выйти">
                <Logout fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Toolbar>
    </AppBar>
  );
}
