import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { listOrdersPage, type Order, type OrderStatus } from './orders.api';
import { Card } from '../../components/ui/Card';
import { Table, type Column } from '../../components/ui/Table';
import { DEFAULT_PAGE_SIZE, Pagination } from '../../components/ui/Pagination';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/ErrorState';
import { PageHeader } from '../../components/ui/PageHeader';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { formatCurrency, formatDate } from '../../lib/format';
import {
  PlusIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All Orders', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'In Production', value: 'IN_PRODUCTION' },
  { label: 'In QC', value: 'QC' },
  { label: 'Ready', value: 'READY' },
  { label: 'Dispatched', value: 'DISPATCHED' },
  { label: 'Completed', value: 'COMPLETED' },
];

const STATUS_VARIANTS: Record<OrderStatus, 'neutral' | 'warning' | 'info' | 'success' | 'danger'> = {
  PENDING:       'neutral',
  IN_PRODUCTION: 'info',
  QC:            'warning',
  READY:         'success',
  DISPATCHED:    'success',
  COMPLETED:     'success',
  CANCELLED:     'danger',
};

const STAGE_LABELS: Record<string, string> = {
  SPINNING:  '1. Spinning',
  WEAVING:   '2. Weaving',
  DYEING:    '3. Dyeing',
  QC:        '4. QC Check',
  COMPLETED: '✓ Finished',
};

export function OrdersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [page, setPage] = useState(0);
  const pageSize = DEFAULT_PAGE_SIZE;

  const { data, loading, error, reload } = useApi(
    () => listOrdersPage({
      ...(selectedStatus === 'ALL' ? {} : { status: selectedStatus }),
      limit: pageSize,
      offset: page * pageSize,
    }),
    [selectedStatus, page]
  );

  const orders = data?.items ?? [];
  const totalOrders = data?.meta.total ?? 0;
  const canCreate = user?.role === 'OWNER' || user?.role === 'OFFICE';

  const columns: Column<Order>[] = [
    {
      key: 'orderNumber',
      header: 'Order #',
      render: (row) => (
        <div>
          <span className="font-semibold text-(--color-text) hover:text-(--color-accent) transition-colors">
            {row.orderNumber}
          </span>
          <p className="text-xs text-(--color-text-muted) mt-0.5">{formatDate(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'buyerName',
      header: 'Buyer',
      render: (row) => (
        <div>
          <span className="font-medium text-(--color-text)">{row.buyerName}</span>
          {row.buyerPhone && <p className="text-xs text-(--color-text-muted)">{row.buyerPhone}</p>}
        </div>
      ),
    },
    {
      key: 'fabric',
      header: 'Fabric Specification',
      render: (row) => (
        <div>
          <span className="text-sm font-medium text-(--color-text)">{row.fabricType}</span>
          <p className="text-xs text-(--color-text-muted)">Colour: {row.colour}</p>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity & Value',
      render: (row) => (
        <div>
          <span className="font-semibold text-(--color-text)">{row.metres.toLocaleString('en-IN')} m</span>
          <p className="text-xs text-(--color-text-muted)">
            {formatCurrency(row.totalAmount)} (@ {formatCurrency(row.ratePerMetre)}/m)
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge
          variant={STATUS_VARIANTS[row.status] ?? 'neutral'}
          label={row.status.replace('_', ' ')}
          dot
        />
      ),
    },
    {
      key: 'currentStage',
      header: 'Current Stage',
      render: (row) => (
        <Badge variant="neutral" label={STAGE_LABELS[row.currentStage] ?? row.currentStage} />
      ),
    },
    {
      key: 'deadline',
      header: 'Deadline',
      render: (row) => {
        const isUrgent = new Date(row.deadline).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
        return (
          <span className={`text-xs font-medium ${isUrgent ? 'text-(--color-danger)' : 'text-(--color-text-muted)'}`}>
            {formatDate(row.deadline)}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/orders/${row.id}`);
          }}
          className="text-xs text-(--color-text-muted) hover:text-(--color-accent)"
        >
          View Details
          <ChevronRightIcon className="w-3.5 h-3.5 ml-1" />
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 page-content">
      <PageHeader
        title="Orders"
        description="Track buyer orders, feasibility, stage progress, and roll production."
        actions={
          canCreate ? (
            <Button variant="primary" size="md" onClick={() => navigate('/orders/new')} className="shadow-xs">
              <PlusIcon className="w-4 h-4 mr-1.5 stroke-2" />
              New Order
            </Button>
          ) : undefined
        }
      />

      {/* Filter Chips */}
      <div className="overflow-x-auto pb-1">
        <SegmentedControl
          value={selectedStatus}
          onChange={(status) => {
            setSelectedStatus(status);
            setPage(0);
          }}
          options={STATUS_FILTERS}
          size="sm"
        />
      </div>

      {/* Error state */}
      {error && (
        <ErrorState code={error.code} message={error.message} onRetry={reload} />
      )}

      {/* Table */}
      {!error && (
        <Card className="overflow-hidden p-0">
          <Table<Order>
            columns={columns}
            rows={orders ?? []}
            loading={loading}
            rowKey={(r) => r.id}
            onRowClick={(row) => navigate(`/orders/${row.id}`)}
            emptyTitle={selectedStatus === 'ALL' ? 'No orders recorded' : `No ${selectedStatus.toLowerCase()} orders`}
            emptyDescription={
              canCreate
                ? 'Create a new order to schedule yarn requirements and production.'
                : 'No orders match the selected filter.'
            }
          />
          <Pagination
            page={page}
            pageSize={pageSize}
            totalCount={totalOrders}
            itemLabel="orders"
            onPageChange={setPage}
          />
        </Card>
      )}
    </div>
  );
}
