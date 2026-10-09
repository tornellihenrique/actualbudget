import type { ReactNode } from 'react';
import { Trans } from 'react-i18next';

import { Block } from '@actual-app/components/block';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useFormat } from '#hooks/useFormat';

import { getProgress } from './monthSummary';

type MonthSummaryProgressProps = {
  label: ReactNode;
  value: number;
  target: number;
  kind: 'income' | 'expense';
};

export function MonthSummaryProgress({
  label,
  value,
  target,
  kind,
}: MonthSummaryProgressProps) {
  const format = useFormat();
  const progress = getProgress(value, target);
  const isOverBudget = kind === 'expense' && progress > 1;
  const fillColor =
    kind === 'income'
      ? theme.reportsGreen
      : isOverBudget
        ? theme.reportsRed
        : theme.reportsBlue;

  return (
    <View style={{ flex: 1, minWidth: 160, gap: 4 }}>
      <Block style={{ ...styles.smallText, color: theme.pageTextSubdued }}>
        {label}
      </Block>
      <Block>
        <PrivacyFilter>
          <FinancialText style={{ ...styles.mediumText, fontWeight: 500 }}>
            {format(value, 'financial')}
          </FinancialText>
          <FinancialText style={{ color: theme.pageTextSubdued }}>
            {' '}
            <Trans>of {{ target: format(target, 'financial') }}</Trans>
          </FinancialText>
        </PrivacyFilter>
      </Block>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: theme.tableBorder,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.min(progress, 1) * 100}%`,
            height: '100%',
            backgroundColor: fillColor,
          }}
        />
      </View>
    </View>
  );
}
