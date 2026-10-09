import type { ReactNode } from 'react';

import { Block } from '@actual-app/components/block';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useFormat } from '#hooks/useFormat';

type MonthSummaryAmountProps = {
  label: ReactNode;
  amount: number;
};

export function MonthSummaryAmount({ label, amount }: MonthSummaryAmountProps) {
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
          color:
            amount < 0
              ? theme.reportsNumberNegative
              : amount > 0
                ? theme.reportsNumberPositive
                : theme.reportsNumberNeutral,
        }}
      >
        <PrivacyFilter>
          <FinancialText>{format(amount, 'financial')}</FinancialText>
        </PrivacyFilter>
      </Block>
    </View>
  );
}
