import * as asyncStorage from '#platform/server/asyncStorage';
import { createApp } from '#server/app';
import * as db from '#server/db';
import { post } from '#server/post';
import { getPrefs } from '#server/prefs';
import { getServer } from '#server/server-config';
import { amountToInteger } from '#shared/util';
import type { IntegerAmount } from '#shared/util';
import type { AccountEntity } from '#types/models';

export type CreditCardBill = {
  id: string;
  dueDate: string;
  totalAmount: IntegerAmount;
  minimumPaymentAmount: IntegerAmount | null;
  paidAmount: IntegerAmount;
};

type PluggyBill = {
  id: string;
  dueDate: string;
  totalAmount: number;
  minimumPaymentAmount: number | null;
  paidAmount: number;
};

export type CreditCardBillsHandlers = {
  'pluggyai-bills': typeof getPluggyAiBills;
};

/**
 * The card's closed bills (faturas), oldest due date first. Accounts not
 * synced through Pluggy, and Pluggy accounts that aren't credit cards, have
 * none. Throws when the sync server or Pluggy can't be reached.
 */
async function getPluggyAiBills({
  id,
}: {
  id: AccountEntity['id'];
}): Promise<CreditCardBill[]> {
  // DbAccount types account_sync_source without 'pluggyai'.
  const account = await db.first<{
    account_id: string | null;
    account_sync_source: string | null;
  }>(
    'SELECT account_id, account_sync_source FROM accounts WHERE id = ? AND tombstone = 0',
    [id],
  );
  if (account?.account_sync_source !== 'pluggyai' || !account.account_id) {
    return [];
  }

  const userToken = await asyncStorage.getItem('user-token');
  if (!userToken) {
    throw new Error('Not signed in to the sync server.');
  }

  const serverConfig = getServer();
  if (!serverConfig) {
    throw new Error('Failed to get server config.');
  }

  const fileId = getPrefs()?.cloudFileId;
  const data = (await post(
    serverConfig.PLUGGYAI_SERVER + '/bills',
    { accountId: account.account_id },
    {
      'X-ACTUAL-TOKEN': userToken,
      ...(fileId ? { 'X-Actual-File-Id': fileId } : {}),
    },
    60000,
  )) as { bills?: PluggyBill[]; error?: string };

  if (data.error || !data.bills) {
    throw new Error(data.error ?? 'Pluggy returned no bills.');
  }

  return data.bills.map(bill => ({
    id: bill.id,
    dueDate: bill.dueDate,
    totalAmount: amountToInteger(bill.totalAmount),
    minimumPaymentAmount:
      bill.minimumPaymentAmount == null
        ? null
        : amountToInteger(bill.minimumPaymentAmount),
    paidAmount: amountToInteger(bill.paidAmount),
  }));
}

export const app = createApp<CreditCardBillsHandlers>();
app.method('pluggyai-bills', getPluggyAiBills);
