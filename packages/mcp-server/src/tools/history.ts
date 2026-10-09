import { z } from 'zod';

import type { ToolRegistrar } from './context';
import { jsonResult } from './format';

export const registerHistoryTools: ToolRegistrar = (server, ctx) => {
  server.registerTool(
    'get_change_history',
    {
      title: 'Change history',
      description:
        'Recent changes made through this connector, newest first, with the previous values needed to undo them by hand.',
      inputSchema: {
        limit: z.number().int().min(1).max(200).optional(),
        include_details: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit, include_details }) =>
      jsonResult(
        ctx.audit
          .recent(limit ?? 20)
          .map(({ details, ...entry }) =>
            include_details ? { ...entry, details } : entry,
          ),
      ),
  );
};
