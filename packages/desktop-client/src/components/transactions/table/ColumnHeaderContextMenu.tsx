import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';

import { useTransactionTableColumnLabels } from '#components/transactions/table/columns';
import type { TransactionTableColumnId } from '#components/transactions/table/columns';

type ColumnHeaderContextMenuProps = {
  columnId: TransactionTableColumnId;
  canHide: boolean;
  isOpen: boolean;
  triggerRef: RefObject<HTMLDivElement | null>;
  position: { crossOffset: number; offset: number };
  hasCustomWidth: boolean;
  onClose: () => void;
  onHideColumn: (id: TransactionTableColumnId) => void;
  onResetWidth: (id: TransactionTableColumnId) => void;
  onResetAllWidths: () => void;
  onManageColumns: () => void;
};

/**
 * Right-click menu for a transaction table header. Deliberately a shortcut
 * layer rather than a second column manager: the actions people reach for
 * mid-task live here, and anything involving reordering defers to the modal.
 */
export function ColumnHeaderContextMenu({
  columnId,
  canHide,
  isOpen,
  triggerRef,
  position,
  hasCustomWidth,
  onClose,
  onHideColumn,
  onResetWidth,
  onResetAllWidths,
  onManageColumns,
}: ColumnHeaderContextMenuProps) {
  const { t } = useTranslation();
  const columnLabels = useTransactionTableColumnLabels();

  return (
    <Popover
      triggerRef={triggerRef}
      isOpen={isOpen}
      onOpenChange={onClose}
      placement="bottom start"
      crossOffset={position.crossOffset}
      offset={position.offset}
      isNonModal
    >
      <Menu
        onMenuSelect={name => {
          switch (name) {
            case 'hide':
              onHideColumn(columnId);
              break;
            case 'reset-width':
              onResetWidth(columnId);
              break;
            case 'reset-all-widths':
              onResetAllWidths();
              break;
            case 'manage':
              onManageColumns();
              break;
            default:
              break;
          }
          onClose();
        }}
        items={[
          {
            name: 'hide',
            text: t('Hide {{name}}', { name: columnLabels[columnId] }),
            disabled: !canHide,
          },
          {
            name: 'reset-width',
            text: t('Reset width'),
            disabled: !hasCustomWidth,
          },
          { name: 'reset-all-widths', text: t('Reset all widths') },
          Menu.line,
          { name: 'manage', text: t('Manage columns…') },
        ]}
      />
    </Popover>
  );
}
