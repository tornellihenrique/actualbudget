import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Block } from '@actual-app/components/block';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type { MonthSummaryWidget } from '@actual-app/core/types/models';

import { ReportCard } from '#components/reports/ReportCard';
import { ReportCardName } from '#components/reports/ReportCardName';
import { useLocale } from '#hooks/useLocale';
import { SheetNameProvider } from '#hooks/useSheetName';
import { useSyncedPref } from '#hooks/useSyncedPref';

import { TrackingMonthSummary } from './TrackingMonthSummary';

type MonthSummaryCardProps = {
  widgetId: string;
  isEditing?: boolean;
  meta?: MonthSummaryWidget['meta'];
  onMetaChange: (newMeta: MonthSummaryWidget['meta']) => void;
};

export function MonthSummaryCard({
  widgetId,
  isEditing,
  meta = {},
  onMetaChange,
}: MonthSummaryCardProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [nameMenuOpen, setNameMenuOpen] = useState(false);
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');

  const month = monthUtils.currentMonth();

  return (
    <ReportCard
      widgetId={widgetId}
      isEditing={isEditing}
      disableClick={nameMenuOpen}
      to="/budget"
      onRename={() => setNameMenuOpen(true)}
    >
      <View style={{ flex: 1, overflow: 'hidden', padding: 20, gap: 15 }}>
        <View>
          <ReportCardName
            name={meta?.name || t('Month summary')}
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
        {budgetType === 'tracking' ? (
          <SheetNameProvider name={monthUtils.sheetForMonth(month)}>
            <TrackingMonthSummary month={month} />
          </SheetNameProvider>
        ) : (
          <Block style={{ color: theme.pageTextSubdued }}>
            <Trans>The month summary is available for tracking budgets.</Trans>
          </Block>
        )}
      </View>
    </ReportCard>
  );
}
