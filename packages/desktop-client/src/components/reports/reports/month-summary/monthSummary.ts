import type { IntegerAmount } from '@actual-app/core/shared/util';

export type TrackingMonthTotals = {
  incomeReceived: IntegerAmount;
  incomeBudgeted: IntegerAmount;
  expensesSpent: IntegerAmount;
  expensesBudgeted: IntegerAmount;
  overspent: IntegerAmount;
};

export function getSavedSoFar({
  incomeReceived,
  expensesSpent,
}: Pick<TrackingMonthTotals, 'incomeReceived' | 'expensesSpent'>) {
  return incomeReceived + expensesSpent;
}

export function getProjectedSavings({
  incomeReceived,
  incomeBudgeted,
  expensesBudgeted,
  overspent,
}: Omit<TrackingMonthTotals, 'expensesSpent'>) {
  return (
    Math.max(incomeReceived, incomeBudgeted) -
    expensesBudgeted -
    Math.abs(overspent)
  );
}

export function getProgress(value: IntegerAmount, target: IntegerAmount) {
  if (target <= 0) {
    return value !== 0 ? 1 : 0;
  }
  return Math.abs(value) / target;
}
