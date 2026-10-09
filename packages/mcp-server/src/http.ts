import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';

import type { PasswordAuthProvider } from '#auth/provider';

export type HttpAppOptions = {
  publicUrl: URL;
  provider: PasswordAuthProvider;
  createServer: () => McpServer;
  log: (message: string) => void;
};

export function createHttpApp({
  publicUrl,
  provider,
  createServer,
  log,
}: HttpAppOptions) {
  const app = express();
  // Railway terminates TLS at its proxy; trust it for client IPs in rate limits.
  app.set('trust proxy', 1);

  const mcpUrl = new URL('/mcp', publicUrl);

  app.use(
    mcpAuthRouter({
      provider,
      issuerUrl: publicUrl,
      resourceServerUrl: mcpUrl,
      resourceName: 'Actual Budget',
      // Clients are only registered for allow-listed redirect URIs, so a
      // non-expiring secret saves the client from re-registering monthly.
      clientRegistrationOptions: { clientSecretExpirySeconds: 0 },
    }),
  );

  app.post(
    '/authorize/login',
    express.urlencoded({ extended: false, limit: '8kb' }),
    (req, res) => provider.handleLogin(req, res),
  );

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  const requireAuth = requireBearerAuth({
    verifier: provider,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpUrl),
  });

  // Stateless: a fresh server and transport per request, so any replica or
  // restart can serve any request without session affinity.
  app.post(
    '/mcp',
    requireAuth,
    express.json({ limit: '4mb' }),
    async (req, res) => {
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
      try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        log(`mcp request failed: ${String(error)}`);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null,
          });
        }
      }
    },
  );

  app.all('/mcp', (_req, res) => {
    res.status(405).set('Allow', 'POST').end();
  });

  return app;
}
