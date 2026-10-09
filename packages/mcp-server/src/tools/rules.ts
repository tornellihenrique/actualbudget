import * as api from '@actual-app/api';
import { z } from 'zod';

import type { ToolRegistrar } from './context';
import { jsonResult, toAmount, toCents } from './format';
import { loadLookups } from './lookups';
import type { Lookups } from './lookups';
import { patchTransaction, UNCATEGORIZED_FILTER } from './transactions';

type RuleValue = unknown;
type RulePart = {
  op: string;
  field?: string;
  value?: RuleValue;
  options?: Record<string, unknown>;
  type?: string;
};
type Rule = Awaited<ReturnType<typeof api.getRules>>[number];

const ID_FIELDS = new Set(['payee', 'account', 'category']);

type Codec = {
  id(field: string, value: string): string;
  amount(value: number): number;
};

function mapValue(field: string | undefined, value: RuleValue, codec: Codec) {
  if (field && ID_FIELDS.has(field)) {
    if (typeof value === 'string') return codec.id(field, value);
    if (Array.isArray(value)) {
      return value.map(v => (typeof v === 'string' ? codec.id(field, v) : v));
    }
  }
  if (field === 'amount') {
    if (typeof value === 'number') return codec.amount(value);
    if (value && typeof value === 'object' && 'num1' in value) {
      const range = value as { num1: number; num2: number };
      return { num1: codec.amount(range.num1), num2: codec.amount(range.num2) };
    }
  }
  return value;
}

function mapPart(part: RulePart, codec: Codec): RulePart {
  const { type: _type, ...rest } = part;
  if (part.op === 'set-split-amount' && typeof part.value === 'number') {
    const method = part.options?.method;
    return {
      ...rest,
      value: method === 'fixed-amount' ? codec.amount(part.value) : part.value,
    };
  }
  return { ...rest, value: mapValue(part.field, part.value, codec) };
}

function readableCodec(lookups: Lookups): Codec {
  return {
    id(field, id) {
      const name =
        field === 'payee'
          ? lookups.payeeName(id)
          : field === 'account'
            ? lookups.accountName(id)
            : lookups.categoryName(id);
      return name ?? id;
    },
    amount: toAmount,
  };
}

function storageCodec(lookups: Lookups): Codec {
  return {
    id(field, ref) {
      if (field === 'account') return lookups.accountId(ref);
      if (field === 'category') return lookups.categoryId(ref);
      const id = lookups.payeeId(ref);
      if (!id) throw new Error(`No payee matches "${ref}".`);
      return id;
    },
    amount: toCents,
  };
}

export function describeRule(rule: Rule, lookups: Lookups) {
  const codec = readableCodec(lookups);
  return {
    id: rule.id,
    stage: rule.stage ?? 'default',
    conditions_op: rule.conditionsOp,
    conditions: rule.conditions.map(c => mapPart(c as RulePart, codec)),
    actions: rule.actions.map(a => mapPart(a as RulePart, codec)),
  };
}

const partSchema = z.object({
  field: z.string().optional(),
  op: z.string(),
  value: z.any().optional(),
  options: z.record(z.string(), z.any()).optional(),
});

export const registerRuleTools: ToolRegistrar = (server, ctx) => {
  server.registerTool(
    'list_rules',
    {
      title: 'List rules',
      description:
        'Transaction rules in readable form: payees, accounts and categories by name, amounts as decimals. The output shape is exactly what upsert_rule accepts.',
      inputSchema: {
        search: z
          .string()
          .optional()
          .describe('Only rules whose text mentions this, case-insensitive'),
        include_schedule_rules: z
          .boolean()
          .optional()
          .describe('Rules generated for schedules are hidden by default'),
      },
      annotations: { readOnlyHint: true },
    },
    ({ search, include_schedule_rules }) =>
      ctx.session.read(async () => {
        const lookups = await loadLookups();
        const rules = (await api.getRules())
          .filter(
            r =>
              include_schedule_rules ||
              !r.actions.some(a => a.op === 'link-schedule'),
          )
          .map(r => describeRule(r, lookups))
          .filter(
            r =>
              !search ||
              JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
          );
        return jsonResult({ count: rules.length, rules });
      }),
  );

  server.registerTool(
    'upsert_rule',
    {
      title: 'Create or update a rule',
      description: [
        'Create a rule, or replace an existing one when id is given. Use the same shape list_rules returns; names are resolved to ids and amounts are decimals.',
        'Condition fields: notes, imported_payee, payee, account, category, amount, date. Ops include is, isNot, contains, doesNotContain, matches, oneOf, notOneOf, gt, gte, lt, lte, isapprox, isbetween ({num1, num2}).',
        'Action ops: set (field + value), append-notes, prepend-notes, set-split-amount.',
        'conditions_op "or" matches when any condition holds. Stage "pre" runs first, "post" last.',
      ].join(' '),
      inputSchema: {
        id: z.string().optional(),
        stage: z.enum(['pre', 'default', 'post']).optional(),
        conditions_op: z.enum(['and', 'or']).optional(),
        conditions: z.array(partSchema).min(1),
        actions: z.array(partSchema).min(1),
      },
    },
    args =>
      ctx.session.write(async () => {
        const lookups = await loadLookups();
        const codec = storageCodec(lookups);
        const rule = {
          stage: args.stage === 'default' || !args.stage ? null : args.stage,
          conditionsOp: args.conditions_op ?? 'and',
          conditions: args.conditions.map(c => mapPart(c, codec)),
          actions: args.actions.map(a => mapPart(a, codec)),
        };
        const before = args.id
          ? (await api.getRules()).find(r => r.id === args.id)
          : undefined;
        if (args.id && !before) throw new Error(`Rule ${args.id} not found.`);

        const saved = args.id
          ? await api.updateRule({ ...rule, id: args.id } as Rule)
          : await api.createRule(rule as Omit<Rule, 'id'>);
        ctx.audit.record({
          tool: 'upsert_rule',
          summary: `${args.id ? 'Updated' : 'Created'} rule ${saved.id}`,
          details: {
            before: before ? describeRule(before, lookups) : null,
            after: describeRule(saved as Rule, lookups),
          },
        });
        return jsonResult(describeRule(saved as Rule, lookups));
      }),
  );

  server.registerTool(
    'delete_rule',
    {
      title: 'Delete a rule',
      description: 'Delete a rule by id.',
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true },
    },
    ({ id }) =>
      ctx.session.write(async () => {
        const lookups = await loadLookups();
        const rule = (await api.getRules()).find(r => r.id === id);
        if (!rule) throw new Error(`Rule ${id} not found.`);
        await api.deleteRule(id);
        ctx.audit.record({
          tool: 'delete_rule',
          summary: `Deleted rule ${id}`,
          details: { before: describeRule(rule, lookups) },
        });
        return jsonResult({ deleted: id });
      }),
  );

  server.registerTool(
    'apply_rules',
    {
      title: 'Apply rules to existing transactions',
      description:
        'Run the rules over existing transactions and report what would change. Nothing is written unless apply is true. Targets the given ids, or every uncategorized transaction since a date.',
      inputSchema: {
        transaction_ids: z.array(z.string()).max(500).optional(),
        uncategorized_since: z.string().optional().describe('YYYY-MM-DD'),
        apply: z.boolean().optional(),
      },
    },
    args => {
      const run = args.apply
        ? ctx.session.write.bind(ctx.session)
        : ctx.session.read.bind(ctx.session);
      return run(async lib => {
        const lookups = await loadLookups();
        let ids = args.transaction_ids ?? [];
        if (args.uncategorized_since) {
          const { data } = (await api.aqlQuery(
            api
              .q('transactions')
              .filter({
                ...UNCATEGORIZED_FILTER,
                date: { $gte: args.uncategorized_since },
              })
              .select(['id']),
          )) as { data: { id: string }[] };
          ids = [...ids, ...data.map(t => t.id)];
        }
        if (ids.length === 0) {
          throw new Error('Give transaction_ids or uncategorized_since.');
        }

        const changes = [];
        for (const id of ids) {
          const { data } = (await api.aqlQuery(
            api.q('transactions').filter({ id }).select('*'),
          )) as { data: Record<string, unknown>[] };
          const original = data[0];
          if (!original) continue;
          const result = (await lib.send('rules-run', {
            transaction: original as never,
          })) as Record<string, unknown>;
          const changed: Record<string, unknown> = {};
          for (const field of ['category', 'payee', 'notes', 'schedule']) {
            if (
              result[field] !== undefined &&
              result[field] !== original[field]
            ) {
              changed[field] = result[field];
            }
          }
          if (Object.keys(changed).length === 0) continue;
          const splits = Array.isArray(result.subtransactions);
          changes.push({
            id,
            date: original.date,
            amount: toAmount(original.amount as number),
            notes: original.notes,
            category: [
              lookups.categoryName(original.category as string | null),
              lookups.categoryName(
                (changed.category ?? original.category) as string | null,
              ),
            ],
            payee: [
              lookups.payeeName(original.payee as string | null),
              lookups.payeeName(
                (changed.payee ?? original.payee) as string | null,
              ),
            ],
            ...(splits ? { note: 'rule splits this; apply it in Actual' } : {}),
          });
          if (args.apply && !splits) {
            await patchTransaction(lib, id, changed);
          }
        }
        if (args.apply) {
          ctx.audit.record({
            tool: 'apply_rules',
            summary: `Applied rules to ${changes.length} transactions`,
            details: changes,
          });
        }
        return jsonResult({
          applied: Boolean(args.apply),
          checked: ids.length,
          changing: changes.length,
          changes,
        });
      });
    },
  );
};
