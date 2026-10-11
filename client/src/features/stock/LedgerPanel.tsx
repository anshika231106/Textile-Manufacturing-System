import { useState, useMemo } from 'react';
import { useApi } from '../../lib/useApi';
import { getStockLedger, type StockLedgerItem } from './stock.api';
import { type YarnType } from '../masters/masters.api';
import { Table, type Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { DEFAULT_PAGE_SIZE } from '../../components/ui/Pagination';
import { formatCurrency, formatTimestamp } from '../../lib/format';
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

interface LedgerPanelProps {
  yarnTypes: YarnType[];
  selectedYarnId?: string;
  onSelectYarnId?: (id: string) => void;
}

export function LedgerPanel({
  yarnTypes,
  selectedYarnId = 'ALL',
  onSelectYarnId,
}: LedgerPanelProps) {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [page, setPage] = useState<number>(0);
  const pageSize = DEFAULT_PAGE_SIZE;

  const { data, loading, error, reload } = useApi(
    () =>
      getStockLedger({
        yarnTypeId: selectedYarnId === 'ALL' ? undefined : selectedYarnId,
        limit: pageSize,
        offset: page * pageSize,
      }),
    [selectedYarnId, page]
  );

  const items = data?.items || [];
  const totalCount = data?.meta?.total || items.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Client-side filter for Movement Type (RECEIPT vs ISSUE)
  const displayRows = useMemo(() => {
    if (filterType === 'ALL') return items;
    return items.filter((item) => item.type === filterType);
  }, [items, filterType]);

  const yarnOptions = [
    { value: 'ALL', label: 'All Yarn Types' },
    ...yarnTypes.map((y) => ({
      value: y.id,
      label: `${y.code} — ${y.name} (${y.colour})`,
    })),
  ];

  const typeOptions = [
    { value: 'ALL', label: 'All Movements (Receipts & Issues)' },
    { value: 'RECEIPT', label: 'Receipts Only (+ Inward)' },
    { value: 'ISSUE', label: 'Issues Only (- Outward)' },
  ];

  const columns: Column<StockLedgerItem>[] = [
    {
      key: 'occurredAt',
      header: 'Date & Time',
      render: (row) => (
        <div>
          <span className="font-medium text-(--color-text)">
            {formatTimestamp(row.occurredAt)}
          </span>
          {row.reference && (
            <p className="text-xs text-(--color-text-muted) mt-0.5">Ref: {row.reference}</p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) =>
        row.type === 'RECEIPT' ? (
          <Badge
            variant="success"
            label="RECEIPT"
            dot
          />
        ) : (
          <Badge
            variant="neutral"
            label="ISSUE"
            dot
          />
        ),
    },
    {
      key: 'yarn',
      header: 'Yarn Material',
      render: (row) => (
        <div>
          <span className="font-semibold text-(--color-text) font-mono text-xs">
            {row.yarnCode}
          </span>
          <p className="text-xs text-(--color-text-muted)">{row.yarnName}</p>
        </div>
      ),
    },
    {
      key: 'kg',
      header: 'Quantity (kg)',
      align: 'right',
      render: (row) => {
        const isReceipt = row.type === 'RECEIPT';
        return (
          <div className="text-right">
            <span
              className={`font-semibold inline-flex items-center gap-1 ${
                isReceipt ? 'text-(--color-success)' : 'text-(--color-accent)'
              }`}
            >
              {isReceipt ? (
                <ArrowDownLeftIcon className="w-3.5 h-3.5 inline" />
              ) : (
                <ArrowUpRightIcon className="w-3.5 h-3.5 inline" />
              )}
              {isReceipt ? '+' : '-'}
              {row.kg.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg
            </span>
          </div>
        );
      },
    },
    {
      key: 'rate',
      header: 'Rate / kg',
      align: 'right',
      render: (row) => (
        <span className="text-(--color-text) font-medium text-right block">
          {formatCurrency(row.ratePerKg)}
        </span>
      ),
    },
    {
      key: 'value',
      header: 'Total Value',
      align: 'right',
      render: (row) => (
        <span className="text-(--color-text) font-semibold text-right block">
          {formatCurrency(row.kg * row.ratePerKg)}
        </span>
      ),
    },
    {
      key: 'party',
      header: 'Supplier / Order',
      render: (row) => (
        <div>
          {row.supplierName && (
            <span className="text-sm font-medium text-(--color-text)">
              {row.supplierName}
            </span>
          )}
          {row.orderNo && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-(--color-accent) bg-(--color-accent-light) px-2 py-0.5 rounded border border-(--color-accent)/20">
              Order: {row.orderNo}
            </span>
          )}
          {!row.supplierName && !row.orderNo && (
            <span className="text-xs text-(--color-text-muted)">—</span>
          )}
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <div className="py-6">
        <ErrorState message={error.message} code={error.code} onRetry={reload} />
      </div>
    );
  }

  return (
    <Card className="p-0 overflow-hidden border border-(--color-border) shadow-xs">
      {/* Panel Header & Filters */}
      <div className="p-5 border-b border-(--color-border) bg-(--color-bg) flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-(--color-text)">Yarn Movement Ledger</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-(--color-border) text-(--color-text-muted)">
              {totalCount} events
            </span>
          </div>
          <p className="text-xs text-(--color-text-muted) mt-0.5">
            Audit trail of all gate receipts from suppliers and yarn issued to production floor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-56">
            <SearchableSelect
              options={yarnOptions}
              value={selectedYarnId}
              onChange={(value) => {
                onSelectYarnId?.(value);
                setPage(0);
              }}
              aria-label="Filter ledger by yarn type"
              searchPlaceholder="Search yarn types…"
            />
          </div>

          <div className="w-48">
            <Select
              options={typeOptions}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="p-0">
        <Table
          columns={columns}
          rows={displayRows}
          loading={loading}
          rowKey={(r) => r.id}
          emptyTitle="No stock movements recorded"
          emptyDescription="When yarn is received or issued to production orders, history will appear here."
        />
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-(--color-border) bg-(--color-bg) flex items-center justify-between text-xs text-(--color-text-muted)">
          <span>
            Showing {displayRows.length > 0 ? page * pageSize + 1 : 0} to{' '}
            {Math.min((page + 1) * pageSize, totalCount)} of {totalCount} records
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeftIcon className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <span className="px-2 font-medium text-(--color-text)">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRightIcon className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
