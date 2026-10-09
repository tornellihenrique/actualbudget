import * as api from '@actual-app/api';

import type { Lib } from '#budget';

export type BankSyncResult = {
  account: string;
  added: number;
  matched: number;
  error?: string;
};

type SyncError = { message?: string; category?: string; code?: string };

/** Syncs linked accounts one at a time so one failing bank does not hide the others. */
export async function syncBankAccounts(
  lib: Lib,
  accountIds?: string[],
): Promise<BankSyncResult[]> {
  const { data: linked } = (await api.aqlQuery(
    api
      .q('accounts')
      .filter({ closed: false, account_sync_source: { $ne: null } })
      .select(['id', 'name']),
  )) as { data: { id: string; name: string }[] };

  const targets = accountIds
    ? linked.filter(a => accountIds.includes(a.id))
    : linked;

  const results: BankSyncResult[] = [];
  for (const account of targets) {
    try {
      const response = await lib.send('accounts-bank-sync', {
        ids: [account.id],
      });
      const errors = (response.errors ?? []).filter(Boolean) as SyncError[];
      results.push({
        account: account.name,
        added: response.newTransactions?.length ?? 0,
        matched: response.matchedTransactions?.length ?? 0,
        ...(errors.length > 0
          ? {
              error: errors
                .map(e =>
                  [e.category, e.code, e.message].filter(Boolean).join(': '),
                )
                .join('; '),
            }
          : {}),
      });
    } catch (error) {
      results.push({
        account: account.name,
        added: 0,
        matched: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
