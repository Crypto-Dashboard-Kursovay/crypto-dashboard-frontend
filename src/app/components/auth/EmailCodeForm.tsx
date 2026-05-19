import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

import { useAuth } from "../../../auth/AuthContext";
import { ApiHttpError } from "../../../api/client";

const SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITEKEY as string | undefined) ??
  (import.meta.env.VITE_HCAPTCHA_SITEKEY as string | undefined) ??
  "";
const RESEND_COOLDOWN_SEC = 60;

interface Props {
  onSuccess: () => void;
}

export function EmailCodeForm({ onSuccess }: Props) {
  const { requestCode, verifyCode } = useAuth();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileInstance | null>(null);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!captchaToken && SITE_KEY) {
      setError("Подтвердите, что вы не робот");
      return;
    }
    setBusy(true);
    try {
      await requestCode(email, captchaToken ?? "dev-bypass");
      setStep("code");
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      setError(err instanceof ApiHttpError ? err.message : "Не удалось отправить код");
      captchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) {
      setError("Код должен состоять из 6 цифр");
      return;
    }
    setBusy(true);
    try {
      await verifyCode(email, code);
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiHttpError ? err.message : "Неверный код");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resendCooldown > 0 || busy) return;
    if (!captchaToken && SITE_KEY) {
      setStep("email");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestCode(email, captchaToken ?? "dev-bypass");
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      setError(err instanceof ApiHttpError ? err.message : "Не удалось отправить код");
    } finally {
      setBusy(false);
    }
  };

  if (step === "email") {
    return (
      <form onSubmit={submitEmail}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            autoComplete="email"
            placeholder="you@example.com"
          />
          {SITE_KEY ? (
            <Box display="flex" justifyContent="center">
              <Box
                sx={{
                  borderRadius: 3,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.08)",
                  "& iframe": { display: "block" },
                }}
              >
                <Turnstile
                  ref={captchaRef}
                  siteKey={SITE_KEY}
                  options={{ theme: "dark", size: "flexible" }}
                  onSuccess={(token: string) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  onError={() => setCaptchaToken(null)}
                />
              </Box>
            </Box>
          ) : (
            <Alert severity="info" variant="outlined">
              Cloudflare Turnstile не настроена (VITE_TURNSTILE_SITEKEY пустой). На проде обязательна.
            </Alert>
          )}
          <Button
            type="submit"
            variant="contained"
            color="primary"
            size="large"
            disabled={busy || !email}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Отправить код
          </Button>
        </Stack>
      </form>
    );
  }

  return (
    <form onSubmit={submitCode}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton
            size="small"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            aria-label="Назад"
          >
            <ArrowBack fontSize="small" />
          </IconButton>
          <Typography variant="body2" color="text.secondary">
            Код отправлен на <strong>{email}</strong>
          </Typography>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Код из письма"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          required
          fullWidth
          autoFocus
          inputProps={{
            inputMode: "numeric",
            maxLength: 6,
            style: {
              fontSize: "1.5rem",
              letterSpacing: "0.5rem",
              textAlign: "center",
            },
          }}
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          disabled={busy || code.length !== 6}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Войти
        </Button>
        <Box textAlign="center">
          <Typography variant="caption" color="text.secondary">
            Код не пришёл?{" "}
            {resendCooldown > 0 ? (
              <span>Повторная отправка через {resendCooldown} сек</span>
            ) : (
              <Box
                component="button"
                type="button"
                onClick={resend}
                sx={{
                  background: "none",
                  border: "none",
                  color: "primary.main",
                  cursor: "pointer",
                  p: 0,
                  fontSize: "inherit",
                  textDecoration: "underline",
                }}
              >
                Отправить ещё раз
              </Box>
            )}
          </Typography>
        </Box>
      </Stack>
    </form>
  );
}
