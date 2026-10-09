import type { IntegerAmount } from '@actual-app/core/shared/util';
import type { MonthFigureMetric } from '@actual-app/core/types/models';

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

export function getProjectedIncome({
  incomeReceived,
  incomeBudgeted,
}: Pick<TrackingMonthTotals, 'incomeReceived' | 'incomeBudgeted'>) {
  return Math.max(incomeReceived, incomeBudgeted);
}

export function getProjectedExpenses({
  expensesBudgeted,
  overspent,
}: Pick<TrackingMonthTotals, 'expensesBudgeted' | 'overspent'>) {
  return expensesBudgeted + Math.abs(overspent);
}

export function getProjectedSavings(
  totals: Omit<TrackingMonthTotals, 'expensesSpent'>,
) {
  return getProjectedIncome(totals) - getProjectedExpenses(totals);
}

export type MonthFigureDetail =
  | 'received-so-far'
  | 'spent-so-far'
  | 'saved-so-far'
  | 'of-budgeted'
  | 'projected';

export type MonthFigure = {
  /** Signed like a transaction: spending is negative. */
  value: IntegerAmount;
  detail: { kind: MonthFigureDetail; amount: IntegerAmount };
};

export function getMonthFigure(
  metric: MonthFigureMetric,
  totals: TrackingMonthTotals,
): MonthFigure {
  switch (metric) {
    case 'projected-income':
      return {
        value: getProjectedIncome(totals),
        detail: { kind: 'received-so-far', amount: totals.incomeReceived },
      };
    case 'projected-expenses':
      return {
        value: -getProjectedExpenses(totals),
        detail: { kind: 'spent-so-far', amount: -totals.expensesSpent },
      };
    case 'projected-savings':
      return {
        value: getProjectedSavings(totals),
        detail: { kind: 'saved-so-far', amount: getSavedSoFar(totals) },
      };
    case 'income-received':
      return {
        value: totals.incomeReceived,
        detail: { kind: 'of-budgeted', amount: totals.incomeBudgeted },
      };
    case 'spent':
      return {
        value: totals.expensesSpent,
        detail: { kind: 'of-budgeted', amount: totals.expensesBudgeted },
      };
    case 'saved-so-far':
      return {
        value: getSavedSoFar(totals),
        detail: { kind: 'projected', amount: getProjectedSavings(totals) },
      };
    default:
      throw new Error(
        `Unknown month figure: ${String(metric satisfies never)}`,
      );
  }
}

export function getProgress(value: IntegerAmount, target: IntegerAmount) {
  if (target <= 0) {
    return value !== 0 ? 1 : 0;
  }
  return Math.abs(value) / target;
}
