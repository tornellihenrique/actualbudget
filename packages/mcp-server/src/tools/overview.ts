import * as api from '@actual-app/api';

import type { ToolRegistrar } from './context';
import { addDays, currentDay, jsonResult, toAmount } from './format';
import { UNCATEGORIZED_FILTER } from './transactions';

type AccountRow = {
  id: string;
  name: string;
  offbudget: boolean;
  closed: boolean;
  account_sync_source: string | null;
  last_sync: string | null;
};

const UNCATEGORIZED_WINDOW_DAYS = 90;

async function sum(filter: Record<string, unknown>) {
  const { data } = (await api.aqlQuery(
    api.q('transactions').filter(filter).calculate({ $sum: '$amount' }),
  )) as { data: number | null };
  return data ?? 0;
}

export const registerOverviewTools: ToolRegistrar = (server, ctx) => {
  server.registerTool(
    'get_overview',
    {
      title: 'Budget overview',
      description:
        'Start here. Account balances (Actual vs. what the bank reports), when each bank account last synced, how many recent transactions lack a category, which schedules are missed, due or upcoming, and the result of the last automatic daily sync.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () =>
      ctx.session.read(async () => {
        const today = currentDay();
        const reported = new Map(
          (await api.getAccounts()).map(a => [a.id, a.balance_current]),
        );
        const { data: accounts } = (await api.aqlQuery(
          api
            .q('accounts')
            .filter({ closed: false })
            .select([
              'id',
              'name',
              'offbudget',
              'closed',
              'account_sync_source',
              'last_sync',
            ]),
        )) as { data: AccountRow[] };

        const balances = [];
        for (const account of accounts) {
          const bank = reported.get(account.id);
          balances.push({
            account: account.name,
            ...(account.offbudget ? { off_budget: true } : {}),
            balance: toAmount(
              await sum({ account: account.id, date: { $lte: today } }),
            ),
            balance_including_future: toAmount(
              await sum({ account: account.id }),
            ),
            ...(bank != null ? { bank_reported: toAmount(bank) } : {}),
            ...(account.account_sync_source
              ? {
                  bank_sync: account.account_sync_source,
                  last_bank_sync: account.last_sync
                    ? new Date(Number(account.last_sync)).toISOString()
                    : null,
                }
              : {}),
          });
        }

        const since = addDays(today, -UNCATEGORIZED_WINDOW_DAYS);
        const { data: uncategorized } = (await api.aqlQuery(
          api
            .q('transactions')
            .filter({ ...UNCATEGORIZED_FILTER, date: { $gte: since } })
            .calculate({ $count: '$id' }),
        )) as { data: number };

        const { data: overdue } = (await api.aqlQuery(
          api
            .q('schedules')
            .filter({
              completed: false,
              next_date: { $lte: addDays(today, 7) },
            })
            .select(['name', 'next_date']),
        )) as { data: { name: string; next_date: string }[] };

        return jsonResult({
          today,
          accounts: balances,
          uncategorized_since: { since, count: uncategorized },
          schedules_due_within_a_week_or_overdue: overdue,
          note: 'Use list_schedules for paid/missed status; a schedule listed here may already be paid.',
          last_daily_job: ctx.lastDailyJob(),
        });
      }),
  );
};
