import { Trans } from 'react-i18next';

import { View } from '@actual-app/components/view';

import { useTrackingSheetValue } from '#components/budget/tracking/TrackingBudgetComponents';
import { useOverspentCategories } from '#hooks/useOverspentCategories';
import { trackingBudget } from '#spreadsheet/bindings';

import { getProjectedSavings, getSavedSoFar } from './monthSummary';
import { MonthSummaryAmount } from './MonthSummaryAmount';
import { MonthSummaryProgress } from './MonthSummaryProgress';
import { OverspentCategoryList } from './OverspentCategoryList';

type TrackingMonthSummaryProps = {
  month: string;
};

export function TrackingMonthSummary({ month }: TrackingMonthSummaryProps) {
  const incomeReceived = useTrackingSheetValue(trackingBudget.totalIncome) || 0;
  const incomeBudgeted =
    useTrackingSheetValue(trackingBudget.totalBudgetedIncome) || 0;
  const expensesSpent = useTrackingSheetValue(trackingBudget.totalSpent) || 0;
  const expensesBudgeted =
    useTrackingSheetValue(trackingBudget.totalBudgetedExpense) || 0;
  const overspent = useOverspentCategories({ month });

  const savedSoFar = getSavedSoFar({ incomeReceived, expensesSpent });
  const projectedSavings = getProjectedSavings({
    incomeReceived,
    incomeBudgeted,
    expensesBudgeted,
    overspent: overspent.totalAmount,
  });

  return (
    <View style={{ flex: 1, gap: 15, minHeight: 0 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
        <MonthSummaryProgress
          label={<Trans>Income received</Trans>}
          value={incomeReceived}
          target={incomeBudgeted}
          kind="income"
        />
        <MonthSummaryProgress
          label={<Trans>Spent</Trans>}
          value={-expensesSpent}
          target={expensesBudgeted}
          kind="expense"
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
        <MonthSummaryAmount
          label={<Trans>Saved so far</Trans>}
          amount={savedSoFar}
        />
        <MonthSummaryAmount
          label={<Trans>Projected for month end</Trans>}
          amount={projectedSavings}
        />
        <MonthSummaryAmount
          label={<Trans>Overspent</Trans>}
          amount={overspent.totalAmount}
        />
      </View>
      <OverspentCategoryList
        categories={overspent.categories}
        amountsByCategory={overspent.amountsByCategory}
      />
    </View>
  );
}
