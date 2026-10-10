import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { SkeletonTableRows } from './Skeleton';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
  /** Extra classes for this column's header and cells (e.g. 'hidden xl:table-cell'). */
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Drop the outer border/radius when the table already sits inside a Card. */
  bare?: boolean;
}

export function Table<T>({
  columns,
  rows,
  loading,
  emptyTitle = 'No records',
  emptyDescription = 'Nothing to show here yet.',
  rowKey,
  onRowClick,
  bare = false,
}: TableProps<T>) {
  return (
    <div className={['w-full overflow-x-auto', bare ? '' : 'rounded-lg border border-(--color-border) bg-white'].join(' ')}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-(--color-border) bg-(--color-bg)">
            {columns.map((col) => (
              <th
                key={col.key}
                className={[
                  'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-(--color-text-muted) whitespace-nowrap',
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                    ? 'text-center'
                    : 'text-left',
                  col.width ? `w-[${col.width}]` : '',
                  col.className ?? '',
                ].join(' ')}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonTableRows columns={columns.length} />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12">
                <EmptyState title={emptyTitle} description={emptyDescription} />
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={[
                  'group/row border-b border-(--color-border) last:border-0 transition-colors duration-100',
                  onRowClick ? 'cursor-pointer hover:bg-(--color-accent-light)/60' : 'hover:bg-(--color-bg)',
                ].join(' ')}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={[
                      'px-4 py-3 text-(--color-text)',
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left',
                      col.className ?? '',
                    ].join(' ')}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
