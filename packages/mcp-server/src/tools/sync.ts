import { z } from 'zod';

import { syncBankAccounts } from '#bank-sync';

import type { ToolRegistrar } from './context';
import { jsonResult } from './format';
import { loadLookups } from './lookups';

export const registerSyncTools: ToolRegistrar = (server, ctx) => {
  server.registerTool(
    'bank_sync',
    {
      title: 'Sync with the bank',
      description:
        'Pull new transactions from the bank for every linked account, or just one. Imported transactions go through the rules and get matched to schedules automatically. An account whose bank connection expired reports an error; the person has to reconnect it with the bank before it syncs again.',
      inputSchema: {
        account: z.string().optional().describe('Account name or id'),
      },
    },
    ({ account }) =>
      ctx.session.write(async lib => {
        const ids = account
          ? [(await loadLookups()).accountId(account)]
          : undefined;
        const results = await syncBankAccounts(lib, ids);
        ctx.audit.record({
          tool: 'bank_sync',
          summary: results
            .map(r => `${r.account}: +${r.added}${r.error ? ' (error)' : ''}`)
            .join(', '),
          details: results,
        });
        return jsonResult(results);
      }),
  );
};
