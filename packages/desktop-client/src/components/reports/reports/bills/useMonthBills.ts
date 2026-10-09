import { q } from '@actual-app/core/shared/query';
import { DEFAULT_UPCOMING_SCHEDULE_DAYS } from '@actual-app/core/shared/schedules';
import type { ScheduleEntity } from '@actual-app/core/types/models';

import { useQuery } from '#hooks/useQuery';
import { getSchedulesQuery } from '#hooks/useSchedules';
import { useSyncedPref } from '#hooks/useSyncedPref';

import {
  getBillTotals,
  getBillTransactionsRange,
  getMonthBillOccurrences,
} from './billOccurrences';
import type {
  BillOccurrence,
  BillTotals,
  BillTransaction,
} from './billOccurrences';

type UseMonthBillsResult = {
  occurrences: BillOccurrence[];
  totals: BillTotals;
  isLoading: boolean;
};

export function useMonthBills(month: string): UseMonthBillsResult {
  const [upcomingLength = DEFAULT_UPCOMING_SCHEDULE_DAYS] = useSyncedPref(
    'upcomingScheduledTransactionLength',
  );

  const { data: schedules, isLoading: isSchedulesLoading } =
    useQuery<ScheduleEntity>(() => getSchedulesQuery(), []);

  const scheduleIdsKey = (schedules ?? [])
    .map(schedule => schedule.id)
    .join(',');
  const { start, end } = getBillTransactionsRange(month);

  const { data: transactions, isLoading: isTransactionsLoading } =
    useQuery<BillTransaction>(() => {
      const scheduleIds = scheduleIdsKey ? scheduleIdsKey.split(',') : [];

      return q('transactions')
        .filter(
          scheduleIds.length > 0
            ? {
                $and: [
                  { schedule: { $oneof: scheduleIds } },
                  { date: { $gte: start } },
                  { date: { $lte: end } },
                ],
              }
            : { id: null },
        )
        .options({ splits: 'none' })
        .select(['schedule', 'date', 'amount', 'account']);
    }, [scheduleIdsKey, start, end]);

  const occurrences = getMonthBillOccurrences({
    schedules: schedules ?? [],
    transactions: transactions ?? [],
    month,
    upcomingLength,
  });

  return {
    occurrences,
    totals: getBillTotals(occurrences),
    isLoading: isSchedulesLoading || isTransactionsLoading,
  };
}
