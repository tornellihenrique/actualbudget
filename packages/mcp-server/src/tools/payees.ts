import * as api from '@actual-app/api';
import { z } from 'zod';

import type { ToolRegistrar } from './context';
import { jsonResult } from './format';
import { loadLookups } from './lookups';

const operation = z.discriminatedUnion('op', [
  z.object({ op: z.literal('create'), name: z.string() }),
  z.object({
    op: z.literal('rename'),
    payee: z.string().describe('Payee name or id'),
    name: z.string(),
  }),
  z.object({
    op: z.literal('merge'),
    into: z.string().describe('Payee that remains'),
    merge: z.array(z.string()).min(1).describe('Payees folded into it'),
  }),
]);

export const registerPayeeTools: ToolRegistrar = (server, ctx) => {
  server.registerTool(
    'list_payees',
    {
      title: 'List payees',
      description:
        'Payees with ids and how many transactions use each. Transfer payees are named "Transfer: <account>".',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () =>
      ctx.session.read(async () => {
        const lookups = await loadLookups();
        const payees = await api.getPayees();
        const { data: counts } = (await api.aqlQuery(
          api
            .q('transactions')
            .groupBy('payee')
            .select(['payee', { count: { $count: '$id' } }]),
        )) as { data: { payee: string | null; count: number }[] };
        const usage = new Map(counts.map(c => [c.payee, c.count]));
        return jsonResult(
          payees
            .map(p => ({
              id: p.id,
              name: lookups.payeeName(p.id),
              transactions: usage.get(p.id) ?? 0,
            }))
            .sort((a, b) => b.transactions - a.transactions),
        );
      }),
  );

  server.registerTool(
    'manage_payees',
    {
      title: 'Manage payees',
      description: 'Create, rename or merge payees. Operations run in order.',
      inputSchema: { operations: z.array(operation).min(1).max(50) },
    },
    ({ operations }) =>
      ctx.session.write(async () => {
        const done: string[] = [];
        for (const operation of operations) {
          const lookups = await loadLookups();
          const payeeId = (ref: string) => {
            const id = lookups.payeeId(ref);
            if (!id) throw new Error(`No payee matches "${ref}".`);
            return id;
          };
          switch (operation.op) {
            case 'create': {
              const id = await api.createPayee({ name: operation.name });
              done.push(`created ${operation.name} (${id})`);
              break;
            }
            case 'rename':
              await api.updatePayee(payeeId(operation.payee), {
                name: operation.name,
              });
              done.push(`renamed ${operation.payee} to ${operation.name}`);
              break;
            case 'merge':
              await api.mergePayees(
                payeeId(operation.into),
                operation.merge.map(payeeId),
              );
              done.push(
                `merged ${operation.merge.join(', ')} into ${operation.into}`,
              );
              break;
            default:
              throw new Error('Unknown operation');
          }
        }
        ctx.audit.record({
          tool: 'manage_payees',
          summary: done.join('; '),
          details: operations,
        });
        return jsonResult({ done });
      }),
  );
};
