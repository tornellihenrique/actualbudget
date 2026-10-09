import { createHash, randomBytes } from 'crypto';
import fs from 'fs';
import http from 'http';
import type { AddressInfo } from 'net';
import os from 'os';
import path from 'path';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { createPasswordAuthProvider } from './auth/provider';
import { createAuthStore } from './auth/store';
import { createLoginThrottle } from './auth/throttle';
import { createHttpApp } from './http';

type Client = { client_id: string };
type Tokens = { access_token: string; refresh_token: string };

async function readJson<T>(res: Response | Promise<Response>): Promise<T> {
  return (await (await res).json()) as T;
}

const PASSWORD = 'correct horse';
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';

function pkce() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

describe('OAuth and MCP over HTTP', () => {
  let baseUrl: string;
  let close: () => void;

  beforeAll(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-http-'));
    const provider = createPasswordAuthProvider({
      store: createAuthStore(path.join(dir, 'auth.json')),
      password: PASSWORD,
      allowedRedirectUris: [REDIRECT],
      throttle: createLoginThrottle({ maxFailures: 3, windowMs: 60_000 }),
    });
    const server = http.createServer();
    await new Promise<void>(resolve => server.listen(0, resolve));
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
    server.on(
      'request',
      createHttpApp({
        publicUrl: new URL(baseUrl),
        provider,
        createServer: () => new McpServer({ name: 'test', version: '0' }),
        log: () => undefined,
      }),
    );
    close = () => server.close();
  });

  afterAll(() => close());

  async function register(redirectUri: string) {
    return fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Claude',
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: 'none',
      }),
    });
  }

  async function startAuthorization(clientId: string, challenge: string) {
    const url = new URL(`${baseUrl}/authorize`);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'xyz',
    }).toString();
    const page = await (await fetch(url)).text();
    const requestId = page.match(/name="request_id" value="([^"]+)"/)?.[1];
    expect(requestId).toBeTruthy();
    return requestId as string;
  }

  function login(requestId: string, password: string) {
    return fetch(`${baseUrl}/authorize/login`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ request_id: requestId, password }),
    });
  }

  it('advertises protected resource metadata for /mcp', async () => {
    const res = await fetch(
      `${baseUrl}/.well-known/oauth-protected-resource/mcp`,
    );
    const body = await readJson<{
      resource: string;
      authorization_servers: string[];
    }>(res);
    expect(body.resource).toBe(`${baseUrl}/mcp`);
    expect(body.authorization_servers[0]).toContain(baseUrl);
  });

  it('rejects unauthenticated MCP requests with a resource hint', async () => {
    const res = await fetch(`${baseUrl}/mcp`, { method: 'POST' });
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('resource_metadata');
  });

  it('refuses to register clients with foreign redirect URIs', async () => {
    const res = await register('https://evil.example/callback');
    expect(res.status).toBe(400);
  });

  it('runs the full authorization code flow and serves MCP', async () => {
    const client = await readJson<Client>(register(REDIRECT));
    const { verifier, challenge } = pkce();
    const requestId = await startAuthorization(client.client_id, challenge);

    const wrong = await login(requestId, 'nope');
    expect(wrong.status).toBe(401);

    const ok = await login(requestId, PASSWORD);
    expect(ok.status).toBe(302);
    const location = new URL(ok.headers.get('location') as string);
    expect(location.origin + location.pathname).toBe(REDIRECT);
    expect(location.searchParams.get('state')).toBe('xyz');

    const tokens = await readJson<Tokens>(
      fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: location.searchParams.get('code') as string,
          code_verifier: verifier,
          client_id: client.client_id,
          redirect_uri: REDIRECT,
        }),
      }),
    );
    expect(tokens.access_token).toBeTruthy();
    expect(tokens.refresh_token).toBeTruthy();

    const init = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${tokens.access_token}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test', version: '0' },
        },
      }),
    });
    expect(init.status).toBe(200);
    expect(
      (await readJson<{ result: { serverInfo: { name: string } } }>(init))
        .result.serverInfo.name,
    ).toBe('test');

    const refreshed = await readJson<Tokens>(
      fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
          client_id: client.client_id,
        }),
      }),
    );
    expect(refreshed.access_token).toBeTruthy();
    expect(refreshed.refresh_token).not.toBe(tokens.refresh_token);
  });

  it('locks sign-in after repeated failures', async () => {
    const client = await readJson<Client>(register(REDIRECT));
    const requestId = await startAuthorization(
      client.client_id,
      pkce().challenge,
    );
    for (let i = 0; i < 3; i++) await login(requestId, 'nope');
    const locked = await login(requestId, PASSWORD);
    expect(locked.status).toBe(401);
    expect(await locked.text()).toContain('Too many failed attempts');
  });
});
