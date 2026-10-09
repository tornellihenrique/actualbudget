import * as api from '@actual-app/api';

import type { ToolRegistrar } from './context';
import { currentDay, jsonResult, toAmount } from './format';

export type CardBill = {
  id: string;
  dueDate: string;
  totalAmount: number;
  minimumPaymentAmount: number | null;
  paidAmount: number;
};

/**
 * The current bill is the one due this month, otherwise the next one still
 * unpaid; the next bill is the one after it. Bills come oldest first.
 */
export function selectCardBills(bills: readonly CardBill[], today: string) {
  const month = today.slice(0, 7);
  const current =
    bills.find(bill => bill.dueDate.startsWith(month)) ??
    bills.find(
      bill =>
        bill.dueDate >= `${month}-01` && bill.paidAmount < bill.totalAmount,
    );
  const next = current
    ? bills.find(bill => bill.dueDate > current.dueDate)
    : undefined;
  return { current, next };
}

export function describeCardBill(bill: CardBill | undefined) {
  if (!bill) return null;
  return {
    due_date: bill.dueDate,
    total: toAmount(bill.totalAmount),
    minimum:
      bill.minimumPaymentAmount == null
        ? null
        : toAmount(bill.minimumPaymentAmount),
    paid: toAmount(bill.paidAmount),
    remaining: toAmount(Math.max(bill.totalAmount - bill.paidAmount, 0)),
  };
}

export const registerCardBillTools: ToolRegistrar = (server, ctx) => {
  server.registerTool(
    'get_card_bills',
    {
      title: 'Credit card bills',
      description:
        'The closed bills (faturas) of every credit card synced through Pluggy, as the bank reports them: the current bill (due this month, otherwise the next unpaid one) and the one after it, with due date, total, minimum payment, amount paid and amount remaining. A bill only appears once the card closes it.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () =>
      ctx.session.read(async lib => {
        const today = currentDay();
        const { data: accounts } = (await api.aqlQuery(
          api
            .q('accounts')
            .filter({ closed: false, account_sync_source: 'pluggyai' })
            .select(['id', 'name']),
        )) as { data: { id: string; name: string }[] };

        const cards = [];
        const errors = [];
        for (const account of accounts) {
          try {
            const bills = await lib.send('pluggyai-bills', { id: account.id });
            if (bills.length === 0) continue;
            const { current, next } = selectCardBills(bills, today);
            cards.push({
              account: account.name,
              current: describeCardBill(current),
              next: describeCardBill(next),
            });
          } catch (error) {
            errors.push({
              account: account.name,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        return jsonResult({
          today,
          cards,
          ...(errors.length > 0 ? { errors } : {}),
        });
      }),
  );
};
