import { Trans, useTranslation } from 'react-i18next';

import { Block } from '@actual-app/components/block';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { titleFirst } from '@actual-app/core/shared/util';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { getStatusProps } from '#components/schedules/StatusBadge';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { getStatusLabel } from '#util/schedule';

import type { BillOccurrence } from './billOccurrences';

type BillListProps = {
  occurrences: BillOccurrence[];
};

export function BillList({ occurrences }: BillListProps) {
  if (occurrences.length === 0) {
    return (
      <Block style={{ color: theme.pageTextSubdued }}>
        <Trans>No bills scheduled this month.</Trans>
      </Block>
    );
  }

  return (
    <View style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      {occurrences.map(occurrence => (
        <BillRow key={occurrence.id} occurrence={occurrence} />
      ))}
    </View>
  );
}

type BillRowProps = {
  occurrence: BillOccurrence;
};

function BillRow({ occurrence }: BillRowProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const { isNarrowWidth } = useResponsive();
  const { color, Icon } = getStatusProps(occurrence.status);
  const isPaid = occurrence.status === 'paid';

  function getLabel() {
    if (occurrence.isIncome && isPaid) {
      return t('Received');
    }
    if (occurrence.isIncome && occurrence.status === 'missed') {
      return t('Not received');
    }
    return titleFirst(getStatusLabel(occurrence.status));
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: '6px 0',
        borderTop: '1px solid ' + theme.tableBorder,
        color: isPaid ? theme.pageTextSubdued : theme.pageText,
      }}
    >
      <View
        title={getLabel()}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          width: isNarrowWidth ? undefined : 105,
          flexShrink: 0,
          color,
        }}
      >
        <Icon style={{ width: 12, height: 12, flexShrink: 0 }} />
        {!isNarrowWidth && (
          <Text style={{ ...styles.smallText, ...styles.lineClamp(1) }}>
            {getLabel()}
          </Text>
        )}
      </View>
      <Text style={{ flex: 1, minWidth: 0, ...styles.lineClamp(1) }}>
        {occurrence.name}
      </Text>
      <Text style={{ ...styles.smallText, color: theme.pageTextSubdued }}>
        {monthUtils.format(occurrence.date, 'd MMM', locale)}
      </Text>
      <Block
        style={{
          minWidth: 90,
          textAlign: 'right',
          color: occurrence.isIncome ? theme.reportsNumberPositive : undefined,
        }}
      >
        <PrivacyFilter>
          <FinancialText>
            {(occurrence.isEstimate ? '~' : '') +
              format(Math.abs(occurrence.amount), 'financial')}
          </FinancialText>
        </PrivacyFilter>
      </Block>
    </View>
  );
}
