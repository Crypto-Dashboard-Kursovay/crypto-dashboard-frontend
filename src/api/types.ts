// TypeScript-зеркало pydantic-схем бэка из backend/src/api/schemas/.
// Decimal приходит строкой (точность) — не конвертируем в number.

export interface UserOut {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type?: string;
}

export interface CredentialOut {
  id: string;
  exchange: string;
  label: string;
  created_at: string;
}

export interface CredentialIn {
  exchange: string;
  label: string;
  api_key: string;
  api_secret: string;
  passphrase?: string;   // OKX (и старый Coinbase Pro)
  testnet?: boolean;
}

export interface ExchangeMeta {
  name: string;
  display_name: string;
  requires_passphrase: boolean;
  supports_testnet: boolean;
}

export interface BotOut {
  id: string;
  credential_id: string;
  strategy_class: string;
  symbol: string;
  timeframe: string;
  params: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BotCreateIn {
  credential_id: string;
  strategy_class: string;
  symbol: string;
  timeframe: string;
  params: Record<string, unknown>;
}

export interface BotParamsIn {
  params: Record<string, unknown>;
}

export interface ApiError {
  detail: string;
}
