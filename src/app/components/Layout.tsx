import { useState, useCallback } from "react";
import { Outlet } from "react-router";
import { Box, Drawer, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Toaster } from "sonner";

import { Sidebar } from "./layout/Sidebar";
import { Header } from "./layout/Header";
import { ResizeHandle } from "./layout/ResizeHandle";
import { LogsProvider } from "../LogsContext";
import { MockDataProvider } from "../MockDataContext";

const mobileDrawerWidth = 260;
const minDrawerWidth = 80;
const snapThreshold = 160;
const maxDrawerWidth = 400;

export function Layout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const [drawerWidth, setDrawerWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    let newWidth = e.clientX;
    if (newWidth < snapThreshold) {
      newWidth = minDrawerWidth;
    } else if (newWidth > maxDrawerWidth) {
      newWidth = maxDrawerWidth;
    }
    setDrawerWidth(newWidth);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "default";
  }, [handleMouseMove]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
    },
    [handleMouseMove, handleMouseUp],
  );

  const isMini = drawerWidth <= minDrawerWidth;

  return (
    <LogsProvider>
    <MockDataProvider>
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Header
        drawerWidth={drawerWidth}
        isResizing={isResizing}
        handleDrawerToggle={handleDrawerToggle}
      />

      <Box
        component="nav"
        sx={{
          width: { md: drawerWidth },
          flexShrink: { md: 0 },
          transition: isResizing
            ? "none"
            : theme.transitions.create("width", {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
        }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: mobileDrawerWidth,
            },
          }}
        >
          <Sidebar
            isMini={false}
            isMobile={true}
            setMobileOpen={setMobileOpen}
          />
        </Drawer>

        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              transition: isResizing
                ? "none"
                : theme.transitions.create("width", {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.enteringScreen,
                  }),
              overflowX: "hidden",
            },
          }}
          open
        >
          <Sidebar
            isMini={isMini}
            isMobile={false}
            setMobileOpen={setMobileOpen}
          />
          <ResizeHandle onMouseDown={handleMouseDown} />
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1, sm: 2, md: 2 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: "64px",
          overflowX: "hidden",
          transition: isResizing
            ? "none"
            : theme.transitions.create(["width", "margin"], {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
        }}
      >
        <Outlet />
      </Box>
      <Toaster richColors position="bottom-right" theme="dark" />
    </Box>
    </MockDataProvider>
    </LogsProvider>
  );
}
