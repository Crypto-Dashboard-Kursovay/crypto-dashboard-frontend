import { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
  IconButton,
  Switch,
  Chip,
  Alert,
  CircularProgress,
  TextField,
  Tooltip,
} from "@mui/material";
import {
  ContentCopyOutlined,
  Add,
  DeleteOutline,
  PlayArrow,
  LockOutlined,
} from "@mui/icons-material";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

import { useAuth } from "../../auth/AuthContext";
import {
  listApiKeys,
  generateApiKey,
  deleteApiKey,
  getTwoFa,
  setupTwoFa,
  verifyTwoFa,
  disableTwoFa,
  testConnection,
} from "../../api/cabinet";
import type { ApiKeyOut, ApiKeyCreateOut } from "../../api/types";
import { ApiHttpError } from "../../api/client";
import { PerplexityDialog } from "../components/PerplexityDialog";

export function Cabinet() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKeyOut[] | null>(null);
  const [twoFa, setTwoFaState] = useState(false);
  const [twoFaDialog, setTwoFaDialog] = useState(false);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<ApiKeyCreateOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    keyId: string;
    message: string;
  } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
    void getTwoFa()
      .then(setTwoFaState)
      .catch(() => undefined);
  }, []);

  async function refresh() {
    setError(null);
    try {
      const data = await listApiKeys();
      setKeys(data);
    } catch (err) {
      setError(
        err instanceof ApiHttpError ? err.message : "Не удалось загрузить ключи",
      );
      setKeys([]);
    }
  }

  function copyToClipboard(value: string, label: string) {
    void navigator.clipboard.writeText(value);
    toast.success(`${label} скопирован${label === "Ключ" ? "" : "о"}`);
  }

  async function onToggleTwoFa(checked: boolean) {
    if (checked) {
      setOtpCode("");
      setOtpauthUri(null);
      try {
        const res = await setupTwoFa();
        setOtpauthUri(res.otpauth_uri);
        setTwoFaDialog(true);
      } catch (err) {
        toast.error(
          err instanceof ApiHttpError ? err.message : "Не удалось начать настройку 2FA",
        );
      }
      return;
    }
    try {
      await disableTwoFa();
      setTwoFaState(false);
      toast.success("2FA отключена");
    } catch (err) {
      toast.error(
        err instanceof ApiHttpError ? err.message : "Не удалось отключить 2FA",
      );
    }
  }

  async function onConfirmTwoFa() {
    if (!/^\d{6}$/.test(otpCode)) {
      toast.error("Введите 6 цифр");
      return;
    }
    setConfirming(true);
    try {
      await verifyTwoFa(otpCode);
      setTwoFaState(true);
      setTwoFaDialog(false);
      setOtpauthUri(null);
      toast.success("2FA включена");
    } catch (err) {
      toast.error(
        err instanceof ApiHttpError ? err.message : "Неверный код",
      );
    } finally {
      setConfirming(false);
    }
  }

  async function onGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const k = await generateApiKey();
      setRevealedKey(k);
      await refresh();
      toast.success("Ключ создан");
    } catch (err) {
      setError(
        err instanceof ApiHttpError ? err.message : "Не удалось создать ключ",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Удалить этот API-ключ? Действие необратимо.")) return;
    try {
      await deleteApiKey(id);
      if (revealedKey?.id === id) setRevealedKey(null);
      if (testResult?.keyId === id) setTestResult(null);
      await refresh();
      toast.success("Ключ удалён");
    } catch (err) {
      setError(
        err instanceof ApiHttpError ? err.message : "Не удалось удалить ключ",
      );
    }
  }

  async function onTest(k: ApiKeyOut) {
    if (!user) return;
    // Тест может прийти только сразу после генерации — иначе у нас нет полного
    // ключа (БД хранит только bcrypt-хеш). Поэтому тестируем именно
    // «открытый» ключ из revealedKey, если он совпадает.
    if (!revealedKey || revealedKey.id !== k.id) {
      toast.error(
        "Полный ключ доступен только при создании. Сгенерируйте новый и протестируйте сразу.",
      );
      return;
    }
    setTestingId(k.id);
    setTestResult(null);
    try {
      const res = await testConnection(revealedKey.key, user.id);
      setTestResult({ keyId: k.id, message: res.message });
    } catch (err) {
      setError(err instanceof ApiHttpError ? err.message : "Тест не удался");
    } finally {
      setTestingId(null);
    }
  }

  if (!user) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", pb: 6 }}>
      <Box mb={4}>
        <Typography variant="h1" gutterBottom>
          Личный кабинет
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Учётная запись, безопасность и ключи для программного доступа к нашему API.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack spacing={3}>
        {/* ── Профиль ─────────────────────────────────────────────────── */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  E-mail
                </Typography>
                <Typography variant="h3" sx={{ mt: 0.5 }}>
                  {user.email}
                </Typography>
              </Box>

              <Box
                sx={{
                  "& .copy-icon": { opacity: 0, transition: "opacity 0.15s" },
                  "&:hover .copy-icon": { opacity: 1 },
                  "&:focus-within .copy-icon": { opacity: 1 },
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Client ID
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: "monospace",
                      letterSpacing: 0,
                      wordBreak: "break-all",
                    }}
                  >
                    {user.id}
                  </Typography>
                  <Tooltip title="Скопировать Client ID">
                    <IconButton
                      size="small"
                      className="copy-icon"
                      onClick={() => copyToClipboard(user.id, "Client ID")}
                      aria-label="Скопировать Client ID"
                    >
                      <ContentCopyOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* ── 2FA ─────────────────────────────────────────────────────── */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              spacing={2}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <LockOutlined fontSize="small" color="primary" />
                <Box>
                  <Typography variant="h3">Двухфакторная аутентификация</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {twoFa
                      ? "Включена — нужен код из приложения при входе"
                      : "Отключена — рекомендуем включить"}
                  </Typography>
                </Box>
              </Stack>
              <Switch
                checked={twoFa}
                onChange={(e) => void onToggleTwoFa(e.target.checked)}
                color="success"
              />
            </Stack>
          </CardContent>
        </Card>

        {/* ── API ключи ───────────────────────────────────────────────── */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={2}
              mb={2}
            >
              <Box>
                <Typography variant="h3">API ключи</Typography>
                <Typography variant="caption" color="text.secondary">
                  Используйте связку «API-ключ + Client ID» для запросов к бэку
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="primary"
                startIcon={
                  generating ? <CircularProgress size={14} color="inherit" /> : <Add />
                }
                onClick={() => void onGenerate()}
                disabled={generating}
              >
                Сгенерировать API ключ
              </Button>
            </Stack>

            {revealedKey && (
              <Alert
                severity="success"
                sx={{ mb: 2 }}
                onClose={() => setRevealedKey(null)}
              >
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  Новый ключ создан — скопируйте сейчас, повторно его не показать.
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography
                    variant="body2"
                    sx={{ fontFamily: "monospace", wordBreak: "break-all" }}
                  >
                    {revealedKey.key}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => copyToClipboard(revealedKey.key, "Ключ")}
                    aria-label="Скопировать ключ"
                  >
                    <ContentCopyOutlined fontSize="small" />
                  </IconButton>
                </Stack>
              </Alert>
            )}

            {keys === null ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress size={28} />
              </Box>
            ) : keys.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Ещё нет ни одного ключа. Сгенерируйте первый — он появится здесь.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {keys.map((k) => (
                  <Box
                    key={k.id}
                    p={2}
                    border={1}
                    borderColor="divider"
                    borderRadius={2}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={2}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      justifyContent="space-between"
                    >
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Chip label="API" size="small" color="primary" />
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {k.label}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontFamily: "monospace" }}
                          >
                            {k.key_prefix}… · создан{" "}
                            {new Date(k.created_at).toLocaleString("ru-RU", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip
                          title={
                            revealedKey?.id === k.id
                              ? "Тест подключения"
                              : "Тест доступен только сразу после создания ключа"
                          }
                        >
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => void onTest(k)}
                              disabled={
                                testingId === k.id || revealedKey?.id !== k.id
                              }
                              aria-label="Тест подключения"
                            >
                              {testingId === k.id ? (
                                <CircularProgress size={16} />
                              ) : (
                                <PlayArrow fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Удалить ключ">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => void onDelete(k.id)}
                            aria-label="Удалить ключ"
                          >
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                    {testResult?.keyId === k.id && (
                      <Alert severity="info" sx={{ mt: 1.5 }}>
                        {testResult.message}
                      </Alert>
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>

      {/* ── Диалог настройки 2FA ────────────────────────────────────── */}
      <PerplexityDialog
        open={twoFaDialog}
        onClose={() => {
          setTwoFaDialog(false);
          setOtpauthUri(null);
        }}
        title="Включение 2FA"
        maxWidth="xs"
        disableClose={confirming}
        actions={
          <>
            <Button
              color="inherit"
              onClick={() => {
                setTwoFaDialog(false);
                setOtpauthUri(null);
              }}
              disabled={confirming}
            >
              Отмена
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => void onConfirmTwoFa()}
              disabled={confirming || otpCode.length !== 6}
            >
              {confirming ? "Включаем…" : "Подтвердить"}
            </Button>
          </>
        }
      >
        <Stack spacing={2.5} alignItems="center">
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Отсканируйте QR-код в приложении-аутентификаторе (Google Authenticator,
            1Password, …) и введите 6-значный код для подтверждения.
          </Typography>
          {otpauthUri ? (
            <Box
              sx={{
                p: 1.5,
                bgcolor: "#ffffff",
                borderRadius: 2,
                display: "inline-block",
              }}
            >
              <QRCodeSVG value={otpauthUri} size={200} bgColor="#ffffff" fgColor="#0a0a0a" />
            </Box>
          ) : (
            <CircularProgress size={32} />
          )}
          <TextField
            label="Код из приложения"
            size="small"
            value={otpCode}
            onChange={(e) =>
              setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputProps={{
              inputMode: "numeric",
              autoComplete: "one-time-code",
              maxLength: 6,
            }}
            fullWidth
            disabled={confirming}
          />
        </Stack>
      </PerplexityDialog>
    </Box>
  );
}
