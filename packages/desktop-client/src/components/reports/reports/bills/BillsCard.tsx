import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Block } from '@actual-app/components/block';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type { BillsWidget } from '@actual-app/core/types/models';

import { LoadingIndicator } from '#components/reports/LoadingIndicator';
import { ReportCard } from '#components/reports/ReportCard';
import { ReportCardName } from '#components/reports/ReportCardName';
import { useLocale } from '#hooks/useLocale';

import { BillList } from './BillList';
import { BillTotalsSummary } from './BillTotalsSummary';
import { useMonthBills } from './useMonthBills';

type BillsCardProps = {
  widgetId: string;
  isEditing?: boolean;
  meta?: BillsWidget['meta'];
  onMetaChange: (newMeta: BillsWidget['meta']) => void;
};

export function BillsCard({
  widgetId,
  isEditing,
  meta = {},
  onMetaChange,
}: BillsCardProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [nameMenuOpen, setNameMenuOpen] = useState(false);

  const month = monthUtils.currentMonth();
  const { occurrences, totals, isLoading } = useMonthBills(month);

  return (
    <ReportCard
      widgetId={widgetId}
      isEditing={isEditing}
      disableClick={nameMenuOpen}
      to="/schedules"
      onRename={() => setNameMenuOpen(true)}
    >
      <View style={{ flex: 1, overflow: 'hidden', padding: 20, gap: 10 }}>
        <View>
          <ReportCardName
            name={meta?.name || t('Bills this month')}
            isEditing={nameMenuOpen}
            onChange={newName => {
              onMetaChange({ ...meta, name: newName });
              setNameMenuOpen(false);
            }}
            onClose={() => setNameMenuOpen(false)}
          />
          <Block style={{ color: theme.pageTextSubdued }}>
            {monthUtils.format(month, 'MMMM yyyy', locale)}
          </Block>
        </View>
        {isLoading ? (
          <LoadingIndicator />
        ) : (
          <>
            <BillTotalsSummary totals={totals} />
            <BillList occurrences={occurrences} />
          </>
        )}
      </View>
    </ReportCard>
  );
}
