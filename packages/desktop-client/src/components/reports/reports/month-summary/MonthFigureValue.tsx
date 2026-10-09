import { useTranslation } from 'react-i18next';

import { Block } from '@actual-app/components/block';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { MonthFigureMetric } from '@actual-app/core/types/models';
import type { TFunction } from 'i18next';

import { PrivacyFilter } from '#components/PrivacyFilter';
import { SummaryNumber } from '#components/reports/SummaryNumber';
import { useFormat } from '#hooks/useFormat';

import { getMonthFigure } from './monthSummary';
import type { MonthFigureDetail } from './monthSummary';
import { useTrackingMonthTotals } from './useTrackingMonthTotals';

function detailText(kind: MonthFigureDetail, amount: string, t: TFunction) {
  switch (kind) {
    case 'received-so-far':
      return t('{{amount}} received so far', { amount });
    case 'spent-so-far':
      return t('{{amount}} spent so far', { amount });
    case 'saved-so-far':
      return t('{{amount}} saved so far', { amount });
    case 'of-budgeted':
      return t('of {{amount}} budgeted', { amount });
    case 'projected':
      return t('{{amount}} projected for month end', { amount });
    default:
      return kind satisfies never;
  }
}

type MonthFigureValueProps = {
  month: string;
  metric: MonthFigureMetric;
};

export function MonthFigureValue({ month, metric }: MonthFigureValueProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const { totals } = useTrackingMonthTotals(month);
  const { value, detail } = getMonthFigure(metric, totals);
  const detailLine = detailText(
    detail.kind,
    format(detail.amount, 'financial'),
    t,
  );

  return (
    <>
      <View
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          flexGrow: 1,
          flexShrink: 1,
          minHeight: 0,
        }}
      >
        <SummaryNumber value={value} contentType="sum" loading={false} />
      </View>
      <Block
        style={{
          ...styles.smallText,
          ...styles.tnum,
          color: theme.pageTextSubdued,
          textAlign: 'center',
          paddingBottom: 15,
          paddingInline: 20,
        }}
      >
        <PrivacyFilter>{detailLine}</PrivacyFilter>
      </Block>
    </>
  );
}
