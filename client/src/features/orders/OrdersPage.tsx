import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { listOrders, type Order, type OrderStatus } from './orders.api';
import { Card } from '../../components/ui/Card';
import { Table, type Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/ErrorState';
import { formatCurrency, formatDate } from '../../lib/format';
import {
  PlusIcon,
  ChevronRightIcon,
  FunnelIcon,
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

  const { data: orders, loading, error, reload } = useApi<Order[]>(
    () => listOrders(selectedStatus === 'ALL' ? undefined : { status: selectedStatus }),
    [selectedStatus]
  );

  const canCreate = user?.role === 'OWNER' || user?.role === 'OFFICE';

  const columns: Column<Order>[] = [
    {
      key: 'orderNumber',
      header: 'Order #',
      render: (row) => (
        <div>
          <span className="font-semibold text-[#1A1714] hover:text-[#EA580C] transition-colors">
            {row.orderNumber}
          </span>
          <p className="text-xs text-[#78716C] mt-0.5">{formatDate(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'buyerName',
      header: 'Buyer',
      render: (row) => (
        <div>
          <span className="font-medium text-[#1A1714]">{row.buyerName}</span>
          {row.buyerPhone && <p className="text-xs text-[#78716C]">{row.buyerPhone}</p>}
        </div>
      ),
    },
    {
      key: 'fabric',
      header: 'Fabric Specification',
      render: (row) => (
        <div>
          <span className="text-sm font-medium text-[#1A1714]">{row.fabricType}</span>
          <p className="text-xs text-[#78716C]">Colour: {row.colour}</p>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity & Value',
      render: (row) => (
        <div>
          <span className="font-semibold text-[#1A1714]">{row.metres.toLocaleString('en-IN')} m</span>
          <p className="text-xs text-[#78716C]">
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
        <span className="inline-flex items-center text-xs font-medium text-[#78716C] bg-[#FAFAF8] border border-[#E8E4DF] px-2.5 py-1 rounded-md">
          {STAGE_LABELS[row.currentStage] ?? row.currentStage}
        </span>
      ),
    },
    {
      key: 'deadline',
      header: 'Deadline',
      render: (row) => {
        const isUrgent = new Date(row.deadline).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
        return (
          <span className={`text-xs font-medium ${isUrgent ? 'text-[#DC2626]' : 'text-[#78716C]'}`}>
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
          className="text-xs text-[#78716C] hover:text-[#EA580C]"
        >
          View Details
          <ChevronRightIcon className="w-3.5 h-3.5 ml-1" />
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 page-content">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1714] tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-[#78716C]">
            Track buyer orders, feasibility, stage progress, and roll production.
          </p>
        </div>

        {canCreate && (
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/orders/new')}
            className="self-start sm:self-auto shadow-xs"
          >
            <PlusIcon className="w-4 h-4 mr-1.5 stroke-2" />
            New Order
          </Button>
        )}
      </div>

      {/* Filter Chips */}
      <Card className="p-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <FunnelIcon className="w-4 h-4 text-[#78716C] ml-2 mr-1 shrink-0" />
          <div className="flex items-center gap-1.5 flex-nowrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setSelectedStatus(f.value)}
                className={[
                  'px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-150',
                  selectedStatus === f.value
                    ? 'bg-[#EA580C] text-white shadow-xs'
                    : 'bg-[#FAFAF8] text-[#78716C] border border-[#E8E4DF] hover:border-[#EA580C]/30 hover:bg-[#FFF7ED]/50',
                ].join(' ')}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

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
        </Card>
      )}
    </div>
  );
}
