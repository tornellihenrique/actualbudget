import path from 'path';

export type ServerConfig = {
  port: number;
  publicUrl: URL;
  dataDir: string;
  actual: {
    serverUrl: string;
    password: string;
    syncId?: string;
  };
  auth: {
    password: string;
    allowedRedirectUris: string[];
  };
  syncTtlMs: number;
  backupRetention: number;
  dailyJob: {
    enabled: boolean;
    hour: number;
    bankSync: boolean;
  };
};

const DEFAULT_REDIRECT_URIS = [
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
];

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function integer(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  { min, max }: { min: number; max: number },
): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function boolean(env: NodeJS.ProcessEnv, name: string, fallback: boolean) {
  const raw = env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function list(env: NodeJS.ProcessEnv, name: string): string[] | undefined {
  const raw = env[name]?.trim();
  if (!raw) return undefined;
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = integer(env, 'PORT', 5007, { min: 1, max: 65535 });
  const actualPassword = required(env, 'ACTUAL_PASSWORD');

  return {
    port,
    publicUrl: new URL(
      env.MCP_PUBLIC_URL?.trim() || `http://localhost:${port}`,
    ),
    dataDir: path.resolve(env.MCP_DATA_DIR?.trim() || './data'),
    actual: {
      serverUrl: required(env, 'ACTUAL_SERVER_URL').replace(/\/+$/, ''),
      password: actualPassword,
      syncId: env.ACTUAL_SYNC_ID?.trim() || undefined,
    },
    auth: {
      password: env.MCP_AUTH_PASSWORD?.trim() || actualPassword,
      allowedRedirectUris:
        list(env, 'MCP_ALLOWED_REDIRECT_URIS') ?? DEFAULT_REDIRECT_URIS,
    },
    syncTtlMs:
      integer(env, 'MCP_SYNC_TTL_SECONDS', 30, { min: 0, max: 3600 }) * 1000,
    backupRetention: integer(env, 'MCP_BACKUP_RETENTION', 14, {
      min: 1,
      max: 365,
    }),
    dailyJob: {
      enabled: boolean(env, 'MCP_DAILY_JOB', true),
      hour: integer(env, 'MCP_DAILY_JOB_HOUR', 6, { min: 0, max: 23 }),
      bankSync: boolean(env, 'MCP_DAILY_BANK_SYNC', true),
    },
  };
}
