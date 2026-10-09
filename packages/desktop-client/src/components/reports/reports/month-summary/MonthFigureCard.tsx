import { useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Block } from '@actual-app/components/block';
import { Menu } from '@actual-app/components/menu';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type {
  MonthFigureMetric,
  MonthFigureWidget,
} from '@actual-app/core/types/models';
import type { TFunction } from 'i18next';

import { ReportCard } from '#components/reports/ReportCard';
import { ReportCardName } from '#components/reports/ReportCardName';
import { useContextMenu } from '#hooks/useContextMenu';
import { useLocale } from '#hooks/useLocale';
import { SheetNameProvider } from '#hooks/useSheetName';
import { useSyncedPref } from '#hooks/useSyncedPref';

import { MonthFigureValue } from './MonthFigureValue';

const METRICS: MonthFigureMetric[] = [
  'projected-income',
  'projected-expenses',
  'projected-savings',
  'income-received',
  'spent',
  'saved-so-far',
];

const DEFAULT_METRIC: MonthFigureMetric = 'projected-savings';

function metricLabel(metric: MonthFigureMetric, t: TFunction) {
  switch (metric) {
    case 'projected-income':
      return t('Projected income');
    case 'projected-expenses':
      return t('Projected expenses');
    case 'projected-savings':
      return t('Projected savings');
    case 'income-received':
      return t('Income received');
    case 'spent':
      return t('Spent');
    case 'saved-so-far':
      return t('Saved so far');
    default:
      return metric satisfies never;
  }
}

type MonthFigureCardProps = {
  widgetId: string;
  isEditing?: boolean;
  meta?: MonthFigureWidget['meta'];
  onMetaChange: (newMeta: MonthFigureWidget['meta']) => void;
};

export function MonthFigureCard({
  widgetId,
  isEditing,
  meta,
  onMetaChange,
}: MonthFigureCardProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [nameMenuOpen, setNameMenuOpen] = useState(false);
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const contextMenuTriggerRef = useRef<HTMLDivElement>(null);

  const metric = meta?.metric ?? DEFAULT_METRIC;
  const month = monthUtils.currentMonth();

  useContextMenu({
    triggerRef: contextMenuTriggerRef,
    enabled: !nameMenuOpen,
    items: [
      { type: Menu.label, name: t('Show:'), text: '' },
      ...METRICS.map(option => ({
        name: option,
        text: metricLabel(option, t),
        disabled: option === metric,
        onClick: () => onMetaChange({ ...meta, metric: option }),
      })),
      Menu.line,
    ],
  });

  return (
    <ReportCard
      widgetId={widgetId}
      isEditing={isEditing}
      disableClick={nameMenuOpen}
      to="/budget"
      onRename={() => setNameMenuOpen(true)}
      contextMenuTriggerRef={contextMenuTriggerRef}
    >
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <View style={{ flexGrow: 0, flexShrink: 0, padding: 20 }}>
          <ReportCardName
            name={meta?.name || metricLabel(metric, t)}
            isEditing={nameMenuOpen}
            onChange={newName => {
              onMetaChange({ ...meta, metric, name: newName });
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
            <MonthFigureValue month={month} metric={metric} />
          </SheetNameProvider>
        ) : (
          <Block style={{ color: theme.pageTextSubdued, padding: 20 }}>
            <Trans>The month summary is available for tracking budgets.</Trans>
          </Block>
        )}
      </View>
    </ReportCard>
  );
}
