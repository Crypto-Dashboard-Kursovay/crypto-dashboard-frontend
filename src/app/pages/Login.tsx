import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  TextField,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import { getOAuthStartUrl, requestEmailCode, verifyEmailCode } from "../../api/auth";
import { useAuth } from "../../auth/AuthContext";
import { EmailCodeForm } from "../components/auth/EmailCodeForm";
import { TelegramButton } from "../components/auth/TelegramButton";
import {
  GitHubIcon,
  GoogleIcon,
  YandexIcon,
} from "../components/auth/SocialIcons";

const IS_DEV_LOGIN = import.meta.env.VITE_DEV_LOGIN === "true";

interface LocationState {
  from?: string;
}

// Общий стиль всех 4 социальных кнопок (ghost-button в стиле grok.com).
const socialBtnSx = {
  width: 52,
  height: 52,
  borderRadius: 3,
  bgcolor: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  transition: "all 0.15s ease-out",
  "&:hover": {
    bgcolor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.2)",
    transform: "translateY(-1px)",
  },
} as const;

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from ?? "/";

  const { isAuthenticated, isReady } = useAuth();

  const [oauthError, setOauthError] = useState<string | null>(null);

  // Dev login state
  const [devEmail, setDevEmail] = useState("");
  const [devBusy, setDevBusy] = useState(false);
  const [devMsg, setDevMsg] = useState<string | null>(null);

  const devLogin = async () => {
    if (!devEmail.trim()) return;
    setDevBusy(true);
    setDevMsg(null);
    try {
      await requestEmailCode(devEmail.trim(), "dev-mode");
      await verifyEmailCode(devEmail.trim(), "000000");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ошибка";
      setDevMsg(msg);
    } finally {
      setDevBusy(false);
    }
  };

  // Единая точка редиректа после успешного логина любым способом
  // (Telegram, OAuth callback, email-код). Раньше Telegram оставлял
  // юзера на /login потому что TelegramButton сам не звал navigate.
  useEffect(() => {
    if (isReady && isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isReady, isAuthenticated, from, navigate]);

  const goOAuth = (provider: "google" | "yandex" | "github") => {
    window.location.href = getOAuthStartUrl(provider);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        bgcolor: "background.default",
        backgroundImage:
          "radial-gradient(ellipse at top, rgba(59, 130, 246, 0.06), transparent 50%), radial-gradient(ellipse at bottom right, rgba(139, 92, 246, 0.04), transparent 50%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Card
        sx={{
          maxWidth: 400,
          width: "100%",
          animation: "loginFadeIn 350ms cubic-bezier(0.16, 1, 0.3, 1)",
          "@keyframes loginFadeIn": {
            from: { opacity: 0, transform: "scale(0.97) translateY(8px)" },
            to: { opacity: 1, transform: "scale(1) translateY(0)" },
          },
        }}
      >
        <CardContent sx={{ p: 4, pt: 3.5 }}>
          {IS_DEV_LOGIN ? (
            /* === Dev login: email + код 000000, без капчи и соц-кнопок === */
            <>
              <Typography variant="h6" fontWeight="medium" mb={1}>
                Dev-вход
              </Typography>
              <Typography variant="caption" color="text.secondary" mb={2.5} display="block">
                Код всегда <Box component="code" sx={{ bgcolor: "action.hover", px: 0.5, borderRadius: 0.5 }}>000000</Box>.
                Введи любой email и жми войти.
              </Typography>
              <Stack spacing={1.5}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="test@example.com"
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") devLogin(); }}
                />
                {devMsg && (
                  <Alert severity="error" variant="outlined" onClose={() => setDevMsg(null)}>
                    {devMsg}
                  </Alert>
                )}
                <Button
                  fullWidth
                  variant="contained"
                  disabled={devBusy || !devEmail.trim()}
                  onClick={devLogin}
                >
                  {devBusy ? "Вход..." : "Войти"}
                </Button>
              </Stack>
            </>
          ) : (
            /* === Production login: соц-кнопки + email + капча === */
            <>
              {/* 4 социальные кнопки */}
              <Stack
                direction="row"
                justifyContent="space-between"
                spacing={1.25}
                mb={2.5}
              >
                <Tooltip title="Войти через Google">
                  <IconButton
                    onClick={() => goOAuth("google")}
                    aria-label="Google"
                    sx={{
                      ...socialBtnSx,
                      bgcolor: "rgba(255, 255, 255, 0.96)",
                      "&:hover": {
                        ...socialBtnSx["&:hover"],
                        bgcolor: "rgba(255, 255, 255, 1)",
                      },
                    }}
                  >
                    <GoogleIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Войти через Яндекс">
                  <IconButton
                    onClick={() => goOAuth("yandex")}
                    aria-label="Яндекс"
                    sx={{
                      ...socialBtnSx,
                      bgcolor: "#FC3F1D",
                      borderColor: "rgba(255,255,255,0.05)",
                      "&:hover": {
                        ...socialBtnSx["&:hover"],
                        bgcolor: "#e0361a",
                      },
                    }}
                  >
                    <YandexIcon />
                  </IconButton>
                </Tooltip>
                <TelegramButton
                  onError={setOauthError}
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: 3,
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    transition: "all 0.15s ease-out",
                    "&:hover": { transform: "translateY(-1px)" },
                  }}
                />
                <Tooltip title="Войти через GitHub">
                  <IconButton
                    onClick={() => goOAuth("github")}
                    aria-label="GitHub"
                    sx={socialBtnSx}
                  >
                    <GitHubIcon />
                  </IconButton>
                </Tooltip>
              </Stack>

              {oauthError && (
                <Alert
                  severity="error"
                  variant="outlined"
                  sx={{ mb: 2, borderColor: "rgba(239, 68, 68, 0.3)" }}
                  onClose={() => setOauthError(null)}
                >
                  {oauthError}
                </Alert>
              )}

              <Divider sx={{ mb: 2.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ px: 1.5 }}>
                  или email
                </Typography>
              </Divider>

              <EmailCodeForm onSuccess={() => navigate(from, { replace: true })} />
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
