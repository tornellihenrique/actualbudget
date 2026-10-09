import type { ReactNode } from 'react';
import { Trans } from 'react-i18next';

import { Block } from '@actual-app/components/block';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useFormat } from '#hooks/useFormat';

import type { BillTotals } from './billOccurrences';

type BillTotalsSummaryProps = {
  totals: BillTotals;
};

export function BillTotalsSummary({ totals }: BillTotalsSummaryProps) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
      <BillTotal
        label={<Trans>To pay</Trans>}
        amount={totals.expensesPending}
        color={totals.missedCount > 0 ? theme.errorText : theme.pageText}
      />
      <BillTotal
        label={<Trans>Paid</Trans>}
        amount={totals.expensesPaid}
        color={theme.pageText}
      />
      <BillTotal
        label={<Trans>To receive</Trans>}
        amount={totals.incomePending}
        color={theme.pageText}
      />
      <BillTotal
        label={<Trans>Received</Trans>}
        amount={totals.incomePaid}
        color={theme.reportsNumberPositive}
      />
    </View>
  );
}

type BillTotalProps = {
  label: ReactNode;
  amount: number;
  color: string;
};

function BillTotal({ label, amount, color }: BillTotalProps) {
  const format = useFormat();

  return (
    <View>
      <Block style={{ ...styles.smallText, color: theme.pageTextSubdued }}>
        {label}
      </Block>
      <Block
        style={{
          ...styles.mediumText,
          fontWeight: 500,
          color: amount === 0 ? theme.reportsNumberNeutral : color,
        }}
      >
        <PrivacyFilter>
          <FinancialText>{format(amount, 'financial')}</FinancialText>
        </PrivacyFilter>
      </Block>
    </View>
  );
}
