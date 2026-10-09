import { Trans } from 'react-i18next';

import { View } from '@actual-app/components/view';

import { getProjectedSavings, getSavedSoFar } from './monthSummary';
import { MonthSummaryAmount } from './MonthSummaryAmount';
import { MonthSummaryProgress } from './MonthSummaryProgress';
import { OverspentCategoryList } from './OverspentCategoryList';
import { useTrackingMonthTotals } from './useTrackingMonthTotals';

type TrackingMonthSummaryProps = {
  month: string;
};

export function TrackingMonthSummary({ month }: TrackingMonthSummaryProps) {
  const { totals, overspent } = useTrackingMonthTotals(month);
  const { incomeReceived, incomeBudgeted, expensesSpent, expensesBudgeted } =
    totals;

  const savedSoFar = getSavedSoFar(totals);
  const projectedSavings = getProjectedSavings(totals);

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
