import { useTrackingSheetValue } from '#components/budget/tracking/TrackingBudgetComponents';
import { useOverspentCategories } from '#hooks/useOverspentCategories';
import { trackingBudget } from '#spreadsheet/bindings';

import type { TrackingMonthTotals } from './monthSummary';

/** Reads a tracking budget's month totals. Render inside the month's SheetNameProvider. */
export function useTrackingMonthTotals(month: string) {
  const incomeReceived = useTrackingSheetValue(trackingBudget.totalIncome) || 0;
  const incomeBudgeted =
    useTrackingSheetValue(trackingBudget.totalBudgetedIncome) || 0;
  const expensesSpent = useTrackingSheetValue(trackingBudget.totalSpent) || 0;
  const expensesBudgeted =
    useTrackingSheetValue(trackingBudget.totalBudgetedExpense) || 0;
  const overspent = useOverspentCategories({ month });

  const totals: TrackingMonthTotals = {
    incomeReceived,
    incomeBudgeted,
    expensesSpent,
    expensesBudgeted,
    overspent: overspent.totalAmount,
  };

  return { totals, overspent };
}
