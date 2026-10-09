import { createHash, timingSafeEqual } from 'crypto';

import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import {
  InvalidClientMetadataError,
  InvalidGrantError,
  InvalidTokenError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type { Request, Response } from 'express';

import { renderLoginPage } from './login-page';
import { generateSecret } from './store';
import type { AuthStore, StoredGrant } from './store';
import type { LoginThrottle } from './throttle';

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const PENDING_TTL_MS = 10 * 60 * 1000;
const CODE_TTL_MS = 5 * 60 * 1000;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

type PendingAuthorization = {
  clientId: string;
  params: AuthorizationParams;
  expiresAt: number;
};

export type PasswordAuthProviderOptions = {
  store: AuthStore;
  password: string;
  allowedRedirectUris: string[];
  throttle: LoginThrottle;
};

export type PasswordAuthProvider = OAuthServerProvider & {
  handleLogin(req: Request, res: Response): void;
};

function sha256(value: string) {
  return createHash('sha256').update(value).digest();
}

/**
 * Entries match exactly, except ones ending in `/*`, which match any URI under
 * that path. Requiring the slash keeps a prefix from spilling into other hosts.
 */
export function isRedirectUriAllowed(uri: string, allowed: string[]) {
  const listed = allowed.some(entry =>
    entry.endsWith('/*') ? uri.startsWith(entry.slice(0, -1)) : entry === uri,
  );
  if (listed) return true;
  try {
    const url = new URL(uri);
    return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function takeUnexpired<T extends { expiresAt: number }>(
  map: Map<string, T>,
  key: string,
): T | undefined {
  const value = map.get(key);
  map.delete(key);
  if (!value || value.expiresAt <= Date.now()) return undefined;
  return value;
}

// A single-user authorization server: the only credential is the password
// configured for the deployment, entered on a page this server renders.
export function createPasswordAuthProvider({
  store,
  password,
  allowedRedirectUris,
  throttle,
}: PasswordAuthProviderOptions): PasswordAuthProvider {
  const pending = new Map<string, PendingAuthorization>();
  const codes = new Map<string, PendingAuthorization>();
  const expectedDigest = sha256(password);

  const clientsStore: OAuthRegisteredClientsStore = {
    getClient: id => store.getClient(id),
    registerClient(client) {
      const rejected = client.redirect_uris.filter(
        uri => !isRedirectUriAllowed(uri, allowedRedirectUris),
      );
      if (rejected.length > 0) {
        throw new InvalidClientMetadataError(
          `redirect_uri not allowed: ${rejected.join(', ')}`,
        );
      }
      const full = client as OAuthClientInformationFull;
      store.saveClient(full);
      return full;
    },
  };

  function issueTokens(
    clientId: string,
    scopes: string[],
    resource?: URL,
  ): OAuthTokens {
    const now = Date.now();
    const grant = (ttl: number): StoredGrant => ({
      clientId,
      scopes,
      expiresAt: now + ttl,
      resource: resource?.href,
    });
    return {
      access_token: store.issueToken('access', grant(ACCESS_TOKEN_TTL_MS)),
      token_type: 'bearer',
      expires_in: ACCESS_TOKEN_TTL_MS / 1000,
      refresh_token: store.issueToken('refresh', grant(REFRESH_TOKEN_TTL_MS)),
      scope: scopes.join(' '),
    };
  }

  function respondWithLogin(
    res: Response,
    requestId: string,
    request: PendingAuthorization,
    error?: string,
  ) {
    const client = store.getClient(request.clientId);
    res
      .status(error ? 401 : 200)
      .type('html')
      .send(
        renderLoginPage({
          requestId,
          clientName: client?.client_name ?? 'An application',
          redirectHost: new URL(request.params.redirectUri).host,
          error,
        }),
      );
  }

  return {
    clientsStore,

    async authorize(client, params, res) {
      const requestId = generateSecret();
      const request = {
        clientId: client.client_id,
        params,
        expiresAt: Date.now() + PENDING_TTL_MS,
      };
      pending.set(requestId, request);
      respondWithLogin(res, requestId, request);
    },

    handleLogin(req, res) {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const requestId = String(body.request_id ?? '');
      const request = takeUnexpired(pending, requestId);
      if (!request) {
        res
          .status(400)
          .type('text')
          .send('This sign-in link expired. Start connecting again.');
        return;
      }

      if (!throttle.allow()) {
        pending.set(requestId, request);
        respondWithLogin(
          res,
          requestId,
          request,
          'Too many failed attempts. Try again in a few minutes.',
        );
        return;
      }

      const attempt = sha256(String(body.password ?? ''));
      if (!timingSafeEqual(attempt, expectedDigest)) {
        throttle.recordFailure();
        pending.set(requestId, request);
        respondWithLogin(res, requestId, request, 'Wrong password.');
        return;
      }

      throttle.reset();
      const code = generateSecret();
      codes.set(code, { ...request, expiresAt: Date.now() + CODE_TTL_MS });
      const target = new URL(request.params.redirectUri);
      target.searchParams.set('code', code);
      if (request.params.state) {
        target.searchParams.set('state', request.params.state);
      }
      res.redirect(302, target.href);
    },

    async challengeForAuthorizationCode(client, authorizationCode) {
      const code = codes.get(authorizationCode);
      if (!code || code.clientId !== client.client_id) {
        throw new InvalidGrantError('Invalid authorization code');
      }
      return code.params.codeChallenge;
    },

    async exchangeAuthorizationCode(
      client,
      authorizationCode,
      _codeVerifier,
      redirectUri,
      resource,
    ) {
      const code = takeUnexpired(codes, authorizationCode);
      if (!code || code.clientId !== client.client_id) {
        throw new InvalidGrantError('Invalid authorization code');
      }
      if (redirectUri && redirectUri !== code.params.redirectUri) {
        throw new InvalidGrantError('redirect_uri does not match');
      }
      return issueTokens(
        client.client_id,
        code.params.scopes ?? [],
        resource ?? code.params.resource,
      );
    },

    async exchangeRefreshToken(client, refreshToken, scopes, resource) {
      const grant = store.findToken('refresh', refreshToken);
      if (!grant || grant.clientId !== client.client_id) {
        throw new InvalidGrantError('Invalid refresh token');
      }
      store.revokeToken('refresh', refreshToken);
      return issueTokens(
        client.client_id,
        scopes ?? grant.scopes,
        resource ?? (grant.resource ? new URL(grant.resource) : undefined),
      );
    },

    async verifyAccessToken(token): Promise<AuthInfo> {
      const grant = store.findToken('access', token);
      if (!grant) {
        throw new InvalidTokenError('Invalid or expired token');
      }
      return {
        token,
        clientId: grant.clientId,
        scopes: grant.scopes,
        expiresAt: Math.floor(grant.expiresAt / 1000),
        resource: grant.resource ? new URL(grant.resource) : undefined,
      };
    },

    async revokeToken(
      _client: OAuthClientInformationFull,
      { token }: OAuthTokenRevocationRequest,
    ) {
      store.revokeToken('access', token);
      store.revokeToken('refresh', token);
    },
  };
}
