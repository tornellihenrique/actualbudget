import { createHash, randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';

export type StoredGrant = {
  clientId: string;
  scopes: string[];
  expiresAt: number;
  resource?: string;
};

type AuthState = {
  clients: Record<string, OAuthClientInformationFull>;
  accessTokens: Record<string, StoredGrant>;
  refreshTokens: Record<string, StoredGrant>;
};

export type AuthStore = {
  getClient(id: string): OAuthClientInformationFull | undefined;
  saveClient(client: OAuthClientInformationFull): void;
  issueToken(kind: 'access' | 'refresh', grant: StoredGrant): string;
  findToken(kind: 'access' | 'refresh', token: string): StoredGrant | undefined;
  revokeToken(kind: 'access' | 'refresh', token: string): void;
};

export function generateSecret() {
  return randomBytes(32).toString('base64url');
}

// Only digests are persisted, so a leaked state file grants nothing.
function digest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

const tables = {
  access: 'accessTokens',
  refresh: 'refreshTokens',
} as const;

export function createAuthStore(file: string): AuthStore {
  fs.mkdirSync(path.dirname(file), { recursive: true });

  let state: AuthState = fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, 'utf8')) as AuthState)
    : { clients: {}, accessTokens: {}, refreshTokens: {} };

  function persist() {
    const now = Date.now();
    for (const table of Object.values(tables)) {
      for (const [key, grant] of Object.entries(state[table])) {
        if (grant.expiresAt <= now) delete state[table][key];
      }
    }
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 });
    fs.renameSync(tmp, file);
  }

  return {
    getClient(id) {
      return state.clients[id];
    },
    saveClient(client) {
      state = {
        ...state,
        clients: { ...state.clients, [client.client_id]: client },
      };
      persist();
    },
    issueToken(kind, grant) {
      const token = generateSecret();
      state[tables[kind]][digest(token)] = grant;
      persist();
      return token;
    },
    findToken(kind, token) {
      const grant = state[tables[kind]][digest(token)];
      if (!grant || grant.expiresAt <= Date.now()) return undefined;
      return grant;
    },
    revokeToken(kind, token) {
      delete state[tables[kind]][digest(token)];
      persist();
    },
  };
}
