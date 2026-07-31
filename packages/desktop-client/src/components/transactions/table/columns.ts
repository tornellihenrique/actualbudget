import { useTranslation } from 'react-i18next';

// The set of columns in the transaction table, in their default order.
export const TRANSACTION_TABLE_COLUMN_IDS = [
  'date',
  'account',
  'payee',
  'notes',
  'group',
  'category',
  'payment',
  'deposit',
  'balance',
  'cleared',
] as const;

export type TransactionTableColumnId =
  (typeof TRANSACTION_TABLE_COLUMN_IDS)[number];

export type TransactionTableColumn = {
  id: TransactionTableColumnId;
  hidden: boolean;
  // Pixel width set by dragging a header edge. Absent means the column uses
  // its default sizing, which for most columns is a flex share of the row.
  width?: number;
};

// How a column is configured to size itself: a fixed pixel width, a share of
// the space left over once the fixed columns are laid out, or sized to fit its
// widest value. `auto` is resolved by the table, which is the only place the
// content is measured.
export type TransactionTableColumnWidth = number | 'flex' | 'auto';

// What a cell is finally given — the two modes `Cell`/`Field` support. Every
// `auto` has been resolved to a pixel width by this point.
export type ResolvedTransactionTableColumnWidth = number | 'flex';

export const DEFAULT_TRANSACTION_TABLE_COLUMN_WIDTHS: Record<
  TransactionTableColumnId,
  TransactionTableColumnWidth
> = {
  date: 110,
  account: 'flex',
  payee: 'flex',
  notes: 'flex',
  group: 'flex',
  category: 'flex',
  payment: 'auto',
  deposit: 'auto',
  balance: 'auto',
  cleared: 38,
};

// Floor for a dragged column. Narrow enough to be useful, wide enough that a
// column can't be collapsed to an unrecoverable sliver.
const MIN_COLUMN_WIDTHS: Partial<Record<TransactionTableColumnId, number>> = {
  cleared: 28,
};
const DEFAULT_MIN_COLUMN_WIDTH = 40;

export function getMinTransactionTableColumnWidth(
  id: TransactionTableColumnId,
): number {
  return MIN_COLUMN_WIDTHS[id] ?? DEFAULT_MIN_COLUMN_WIDTH;
}

export function getDefaultTransactionTableColumnWidth(
  id: TransactionTableColumnId,
): TransactionTableColumnWidth {
  return DEFAULT_TRANSACTION_TABLE_COLUMN_WIDTHS[id];
}

/**
 * The width each column should render at: the user's dragged width when it has
 * one, otherwise the column's default. Header cells and row cells both read
 * this, which is what keeps them aligned.
 */
export function resolveTransactionTableColumnWidths(
  columns: TransactionTableColumn[],
): Record<TransactionTableColumnId, TransactionTableColumnWidth> {
  const widths = { ...DEFAULT_TRANSACTION_TABLE_COLUMN_WIDTHS };
  for (const column of columns) {
    if (column.width != null) {
      widths[column.id] = column.width;
    }
  }
  return widths;
}

// The date column can be reordered but never hidden: it drives keyboard
// navigation (new transactions start editing on the date field) so it must
// always be visible.
export function isTransactionTableColumnLocked(
  id: TransactionTableColumnId,
): boolean {
  return id === 'date';
}

// Display-only columns render plain values with no editing, so they are
// excluded from keyboard-focusable fields.
export function isTransactionTableColumnDisplayOnly(
  id: TransactionTableColumnId,
): boolean {
  return id === 'balance' || id === 'group';
}

// Child (split) transactions render the date/account cells as blank
// placeholders, so those columns can't be focused or edited in child rows.
export function isTransactionTableColumnAvailableInChildRows(
  id: TransactionTableColumnId,
): boolean {
  return id !== 'date' && id !== 'account';
}

// User-facing column names, shared by the column manager modal and the
// table header.
export function useTransactionTableColumnLabels(): Record<
  TransactionTableColumnId,
  string
> {
  const { t } = useTranslation();

  return {
    date: t('Date'),
    account: t('Account'),
    payee: t('Payee'),
    notes: t('Notes'),
    group: t('Category group'),
    category: t('Category'),
    payment: t('Payment'),
    deposit: t('Deposit'),
    balance: t('Running balance'),
    cleared: t('Cleared'),
  };
}

function isColumnHiddenByDefault(id: TransactionTableColumnId): boolean {
  // The running balance and category group columns are opt-in, matching the
  // app's historical default of not showing them
  return id === 'balance' || id === 'group';
}

export function getDefaultTransactionTableColumns(): TransactionTableColumn[] {
  return TRANSACTION_TABLE_COLUMN_IDS.map(id => ({
    id,
    hidden: isColumnHiddenByDefault(id),
  }));
}

function isKnownColumnId(id: unknown): id is TransactionTableColumnId {
  return (
    typeof id === 'string' &&
    (TRANSACTION_TABLE_COLUMN_IDS as readonly string[]).includes(id)
  );
}

/**
 * Parse the serialized column configuration from the synced pref. Invalid or
 * unknown entries are dropped, and any columns missing from the saved value
 * (e.g. because they were added in a later version, or were not available in
 * the view when it was saved) are inserted at their default position.
 */
export function parseTransactionTableColumns(
  raw: string | undefined,
): TransactionTableColumn[] {
  let saved: TransactionTableColumn[] = [];

  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (
            entry &&
            typeof entry === 'object' &&
            'id' in entry &&
            isKnownColumnId(entry.id) &&
            !saved.some(c => c.id === entry.id)
          ) {
            const hidden =
              'hidden' in entry &&
              entry.hidden === true &&
              !isTransactionTableColumnLocked(entry.id);
            const rawWidth =
              'width' in entry && typeof entry.width === 'number'
                ? entry.width
                : undefined;
            const width =
              rawWidth != null && Number.isFinite(rawWidth)
                ? Math.max(
                    getMinTransactionTableColumnWidth(entry.id),
                    Math.round(rawWidth),
                  )
                : undefined;
            saved.push({
              id: entry.id,
              hidden,
              ...(width != null && { width }),
            });
          }
        }
      }
    } catch {
      // Malformed pref value; fall back to the defaults
      saved = [];
    }
  }

  // At least one amount column must stay visible — new transactions need an
  // amount input. Restore both when a saved config hides the whole pair.
  const payment = saved.find(c => c.id === 'payment');
  const deposit = saved.find(c => c.id === 'deposit');
  if (payment?.hidden && deposit?.hidden) {
    payment.hidden = false;
    deposit.hidden = false;
  }

  // Insert any missing columns at their default relative position
  for (const id of TRANSACTION_TABLE_COLUMN_IDS) {
    if (saved.some(c => c.id === id)) {
      continue;
    }
    const defaultIdx = TRANSACTION_TABLE_COLUMN_IDS.indexOf(id);
    const insertAt = saved.findIndex(
      c => TRANSACTION_TABLE_COLUMN_IDS.indexOf(c.id) > defaultIdx,
    );
    const column = { id, hidden: isColumnHiddenByDefault(id) };
    if (insertAt === -1) {
      saved.push(column);
    } else {
      saved.splice(insertAt, 0, column);
    }
  }

  return saved;
}
