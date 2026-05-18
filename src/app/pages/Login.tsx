import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import { getOAuthStartUrl } from "../../api/auth";
import { EmailCodeForm } from "../components/auth/EmailCodeForm";
import { TelegramButton } from "../components/auth/TelegramButton";
import {
  GitHubIcon,
  GoogleIcon,
  YandexIcon,
} from "../components/auth/SocialIcons";

interface LocationState {
  from?: string;
}

// Общий стиль всех 4 социальных кнопок (ghost-button в стиле grok.com).
const socialBtnSx = {
  width: 44,
  height: 44,
  borderRadius: 12,
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

  const [oauthError, setOauthError] = useState<string | null>(null);

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
        // Тонкий radial gradient в стиле grok — почти незаметный, добавляет глубину.
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
        <CardContent sx={{ p: 4 }}>
          <Box mb={3.5}>
            <Typography variant="h1" mb={0.75}>
              Crypto Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Войдите, чтобы начать торговать
            </Typography>
          </Box>

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
                sx={{ ...socialBtnSx, bgcolor: "rgba(255, 255, 255, 0.96)", "&:hover": { ...socialBtnSx["&:hover"], bgcolor: "rgba(255, 255, 255, 1)" } }}
              >
                <GoogleIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Войти через Яндекс">
              <IconButton
                onClick={() => goOAuth("yandex")}
                aria-label="Яндекс"
                sx={{ ...socialBtnSx, bgcolor: "#FC3F1D", borderColor: "rgba(255,255,255,0.05)", "&:hover": { ...socialBtnSx["&:hover"], bgcolor: "#e0361a" } }}
              >
                <YandexIcon />
              </IconButton>
            </Tooltip>
            <TelegramButton
              onError={setOauthError}
              sx={{
                width: 44,
                height: 44,
                borderRadius: 12,
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

          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            textAlign="center"
            mt={3}
            sx={{ opacity: 0.6 }}
          >
            Аккаунт создастся автоматически при первом входе.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
