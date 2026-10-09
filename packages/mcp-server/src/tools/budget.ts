import * as api from '@actual-app/api';
import { z } from 'zod';

import type { ToolRegistrar } from './context';
import { jsonResult, toAmount, toCents } from './format';
import { loadLookups } from './lookups';

const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .describe('YYYY-MM');

const operation = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('set_amount'),
    category: z.string().describe('Category name or id'),
    amount: z.number().describe('Decimal amount budgeted per month'),
    start_month: monthSchema,
    end_month: monthSchema
      .optional()
      .describe('Last month to set, inclusive; defaults to start_month'),
  }),
  z.object({
    op: z.literal('set_carryover'),
    category: z.string().describe('Category name or id'),
    enabled: z.boolean(),
    start_month: monthSchema.describe(
      'First month the flag applies to; later months follow it',
    ),
  }),
]);

type BudgetRecord = Record<string, unknown> & {
  categories?: Record<string, unknown>[];
};

function numberField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'number' ? value : 0;
}

export function monthsBetween(start: string, end: string) {
  const [startYear, startMonth] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  const count = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
  if (count < 1 || count > 60) {
    throw new Error(`Invalid month range ${start}..${end} (1 to 60 months).`);
  }
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(startYear, startMonth - 1 + index, 1));
    return date.toISOString().slice(0, 7);
  });
}

function describeCategory(
  category: Record<string, unknown>,
  isIncome: boolean,
) {
  const balance = numberField(category, 'balance');
  return {
    id: category.id,
    name: category.name,
    budgeted: toAmount(numberField(category, 'budgeted')),
    [isIncome ? 'received' : 'spent']: toAmount(
      numberField(category, isIncome ? 'received' : 'spent'),
    ),
    balance: toAmount(balance),
    ...(category.carryover ? { carryover: true } : {}),
    ...(category.hidden ? { hidden: true } : {}),
  };
}

function summarizeMonth(groups: BudgetRecord[]) {
  const visible = groups.filter(group => !group.hidden);
  const income = visible.filter(group => group.is_income);
  const expenses = visible.filter(group => !group.is_income);
  const sum = (items: BudgetRecord[], key: string) =>
    items.reduce((total, group) => total + numberField(group, key), 0);

  const overspent = expenses
    .flatMap(group => group.categories ?? [])
    .filter(
      category =>
        !category.hidden &&
        !category.carryover &&
        numberField(category, 'balance') < 0,
    )
    .map(category => ({
      category: category.name,
      amount: toAmount(numberField(category, 'balance')),
    }));

  return {
    income_budgeted: toAmount(sum(income, 'budgeted')),
    income_received: toAmount(sum(income, 'received')),
    expenses_budgeted: toAmount(sum(expenses, 'budgeted')),
    spent: toAmount(sum(expenses, 'spent')),
    overspent,
  };
}

export const registerBudgetTools: ToolRegistrar = (server, ctx) => {
  server.registerTool(
    'get_budget',
    {
      title: 'Read the budget for a month',
      description:
        'Budgeted, spent (or received) and balance per category for one month, with totals and the overspent categories. Amounts are decimals; spending is negative.',
      inputSchema: { month: monthSchema },
      annotations: { readOnlyHint: true },
    },
    ({ month }) =>
      ctx.session.read(async () => {
        const budget = await api.getBudgetMonth(month);
        const groups: BudgetRecord[] = budget.categoryGroups;
        return jsonResult({
          month,
          ...summarizeMonth(groups),
          groups: groups.map(group => ({
            group: group.name,
            ...(group.is_income ? { is_income: true } : {}),
            ...(group.hidden ? { hidden: true } : {}),
            categories: (group.categories ?? []).map(category =>
              describeCategory(category, Boolean(group.is_income)),
            ),
          })),
        });
      }),
  );

  server.registerTool(
    'manage_budget',
    {
      title: 'Change budgeted amounts',
      description:
        'Set the budgeted amount of categories over a range of months, or turn carryover (rollover of the balance into the next month) on or off. Operations run in order.',
      inputSchema: { operations: z.array(operation).min(1).max(100) },
    },
    ({ operations }) =>
      ctx.session.write(async () => {
        const lookups = await loadLookups();
        const done: string[] = [];

        for (const operation of operations) {
          const categoryId = lookups.categoryId(operation.category);
          const name = lookups.categoryName(categoryId);

          switch (operation.op) {
            case 'set_amount': {
              const months = monthsBetween(
                operation.start_month,
                operation.end_month ?? operation.start_month,
              );
              for (const month of months) {
                await api.setBudgetAmount(
                  month,
                  categoryId,
                  toCents(operation.amount),
                );
              }
              done.push(
                `${name}: ${operation.amount} in ${months[0]}..${months[months.length - 1]}`,
              );
              break;
            }
            case 'set_carryover':
              await api.setBudgetCarryover(
                operation.start_month,
                categoryId,
                operation.enabled,
              );
              done.push(
                `${name}: carryover ${operation.enabled ? 'on' : 'off'} from ${operation.start_month}`,
              );
              break;
            default:
              throw new Error('Unknown operation');
          }
        }

        ctx.audit.record({
          tool: 'manage_budget',
          summary: done.join('; '),
          details: operations,
        });
        return jsonResult({ done });
      }),
  );
};
