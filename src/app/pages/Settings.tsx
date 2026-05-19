import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  MenuItem,
} from "@mui/material";
import { Key, CheckCircleOutline, DeleteOutline } from "@mui/icons-material";

import { ApiHttpError } from "../../api/client";
import {
  createCredential,
  deleteCredential,
  listCredentials,
} from "../../api/credentials";
import { listSupportedExchanges } from "../../api/exchanges";
import type { CredentialOut, ExchangeMeta } from "../../api/types";

export function Settings() {
  const [creds, setCreds] = useState<CredentialOut[] | null>(null);
  const [exchanges, setExchanges] = useState<ExchangeMeta[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [exchange, setExchange] = useState<string>("binance");
  const [label, setLabel] = useState("Binance Testnet");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const selectedMeta = useMemo(
    () => exchanges.find((e) => e.name === exchange),
    [exchanges, exchange],
  );

  const refresh = async () => {
    setLoadError(null);
    try {
      const data = await listCredentials();
      setCreds(data);
    } catch (err) {
      setLoadError(err instanceof ApiHttpError ? err.message : "Не удалось загрузить ключи");
      setCreds([]);
    }
  };

  useEffect(() => {
    void refresh();
    listSupportedExchanges()
      .then((list) => {
        setExchanges(list);
        if (list.length > 0 && !list.find((e) => e.name === exchange)) {
          setExchange(list[0].name);
          setLabel(`${list[0].display_name} Testnet`);
        }
      })
      .catch(() => {
        // тихо — форма поработает с дефолтным "binance"
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onExchangeChange = (name: string) => {
    setExchange(name);
    const meta = exchanges.find((e) => e.name === name);
    if (meta) setLabel(`${meta.display_name}${meta.supports_testnet ? " Testnet" : ""}`);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);
    if (selectedMeta?.requires_passphrase && !passphrase.trim()) {
      setSubmitError(`${selectedMeta.display_name} требует passphrase (третий секрет)`);
      return;
    }
    setSubmitting(true);
    try {
      await createCredential({
        exchange,
        label: label.trim() || (selectedMeta?.display_name ?? exchange),
        api_key: apiKey.trim(),
        api_secret: apiSecret.trim(),
        passphrase: passphrase.trim() || undefined,
        testnet: selectedMeta?.supports_testnet ?? true,
      });
      setApiKey("");
      setApiSecret("");
      setPassphrase("");
      setSubmitSuccess(true);
      await refresh();
    } catch (err) {
      setSubmitError(
        err instanceof ApiHttpError ? err.message : "Не удалось сохранить ключи",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Удалить эти ключи? Боты, использующие их, перестанут работать.")) return;
    try {
      await deleteCredential(id);
      await refresh();
    } catch (err) {
      setLoadError(err instanceof ApiHttpError ? err.message : "Не удалось удалить");
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", pb: 6 }}>
      <Box mb={4}>
        <Typography variant="h1" gutterBottom>
          Настройки
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Подключение API-ключей бирж. Бэк валидирует ключ через биржу (sandbox-режим
          для тех, кто поддерживает), затем шифрует и сохраняет в БД (Fernet).
        </Typography>
      </Box>

      <Stack spacing={3}>
        {/* Существующие ключи */}
        <Card>
          <Box p={3} borderBottom={1} borderColor="divider">
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Key color="primary" />
              <Typography variant="h2">Подключённые ключи</Typography>
            </Stack>
          </Box>
          <CardContent sx={{ p: 3 }}>
            {loadError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {loadError}
              </Alert>
            )}
            {creds === null ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress size={28} />
              </Box>
            ) : creds.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Ещё ничего не добавлено. Заполните форму ниже.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {creds.map((c) => (
                  <Box
                    key={c.id}
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    p={2}
                    border={1}
                    borderColor="divider"
                    borderRadius={2}
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Chip
                        label={c.exchange}
                        size="small"
                        color="primary"
                        sx={{ textTransform: "uppercase" }}
                      />
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {c.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          добавлен{" "}
                          {new Date(c.created_at).toLocaleString("ru-RU", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </Typography>
                      </Box>
                    </Stack>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onDelete(c.id)}
                      aria-label="Удалить ключи"
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* Форма добавления */}
        <Card>
          <Box p={3} borderBottom={1} borderColor="divider">
            <Typography variant="h2">Добавить ключ</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Поддерживаются {exchanges.length > 0 ? exchanges.map((e) => e.display_name).join(", ") : "Binance / Bybit / OKX / MEXC"}.
              Все используют testnet-режим — никаких реальных средств не задействуется.
            </Typography>
          </Box>
          <CardContent sx={{ p: 3 }}>
            <form onSubmit={onSubmit}>
              <Stack spacing={2.5}>
                {submitError && <Alert severity="error">{submitError}</Alert>}
                {submitSuccess && (
                  <Alert severity="success" icon={<CheckCircleOutline />}>
                    Ключ проверен и сохранён.
                  </Alert>
                )}
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      select
                      label="Биржа"
                      size="small"
                      value={exchange}
                      onChange={(e) => onExchangeChange(e.target.value)}
                      fullWidth
                      disabled={submitting || exchanges.length === 0}
                    >
                      {(exchanges.length > 0
                        ? exchanges
                        : [{ name: "binance", display_name: "Binance", requires_passphrase: false, supports_testnet: true }]
                      ).map((ex) => (
                        <MenuItem key={ex.name} value={ex.name}>
                          {ex.display_name}
                          {ex.requires_passphrase ? " (passphrase)" : ""}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      label="Название (для удобства)"
                      size="small"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      fullWidth
                      disabled={submitting}
                    />
                  </Grid>
                </Grid>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      label="API Key"
                      size="small"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      fullWidth
                      required
                      disabled={submitting}
                      autoComplete="off"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      label="Secret Key"
                      size="small"
                      type="password"
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      fullWidth
                      required
                      disabled={submitting}
                      autoComplete="off"
                    />
                  </Grid>
                  {selectedMeta?.requires_passphrase && (
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        label="Passphrase"
                        size="small"
                        type="password"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        fullWidth
                        required
                        disabled={submitting}
                        autoComplete="off"
                        helperText={`${selectedMeta.display_name} требует третий секрет (passphrase из API-настроек)`}
                      />
                    </Grid>
                  )}
                </Grid>
                <Box>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={submitting || !apiKey || !apiSecret}
                    startIcon={
                      submitting ? (
                        <CircularProgress size={14} color="inherit" />
                      ) : null
                    }
                  >
                    {submitting ? "Проверяем ключ" : "Сохранить"}
                  </Button>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    mt={1.5}
                  >
                    Проверка занимает 2–5 секунд: бэк делает fetch_balance к выбранной
                    бирже, чтобы убедиться что ключ валиден.
                  </Typography>
                </Box>
              </Stack>
            </form>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
