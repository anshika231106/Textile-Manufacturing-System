import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { useToast } from '../../components/ui/Toast';
import { getOrder, startProduction, type Order, type OrderStatus } from './orders.api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { Dialog } from '../../components/ui/Dialog';
import { Callout } from '../../components/ui/Callout';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Table, type Column } from '../../components/ui/Table';
import { formatCurrency, formatDate } from '../../lib/format';
import {
  ArrowLeftIcon,
  PlayIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const STATUS_VARIANTS: Record<OrderStatus, 'neutral' | 'warning' | 'info' | 'success' | 'danger'> = {
  PENDING:       'neutral',
  IN_PRODUCTION: 'info',
  QC:            'warning',
  READY:         'success',
  DISPATCHED:    'success',
  COMPLETED:     'success',
  CANCELLED:     'danger',
};

const QC_STATUS_VARIANTS: Record<string, 'neutral' | 'warning' | 'info' | 'success' | 'danger'> = {
  PENDING: 'warning',
  PASS:    'success',
  REWORK:  'warning',
  REJECT:  'danger',
};

type YarnRequirement = Order['yarnRequirements'][number];

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [starting, setStarting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  const { data: order, loading, error, reload } = useApi<Order>(
    () => getOrder(id!),
    [id]
  );

  const canStartProduction =
    (user?.role === 'OWNER' || user?.role === 'OFFICE' || user?.role === 'SUPERVISOR') &&
    order?.status === 'PENDING';

  const hasShortfall = order?.yarnRequirements.some((y) => (y.shortfallKg ?? 0) > 0);

  async function handleConfirmStartProduction() {
    if (!order) return;
    setStarting(true);
    setActionError('');
    try {
      await startProduction(order.id);
      showToast('Production started! Yarn successfully issued to Spinning.', 'success');
      setConfirmOpen(false);
      reload();
    } catch (err: any) {
      setActionError(err.message || 'Failed to start production.');
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <ErrorState
          code={error?.code ?? 'NOT_FOUND'}
          message={error?.message ?? 'Order details could not be found.'}
          onRetry={reload}
        />
      </div>
    );
  }

  const yarnColumns: Column<YarnRequirement>[] = [
    {
      key: 'yarnType',
      header: 'Yarn Type',
      render: (y) => <span className="font-semibold">{y.yarnTypeName ?? y.yarnTypeId}</span>,
    },
    {
      key: 'code',
      header: 'Code',
      render: (y) => <span className="font-mono text-(--color-text-muted)">{y.yarnTypeCode ?? '—'}</span>,
    },
    {
      key: 'required',
      header: 'Required',
      render: (y) => <span className="font-bold">{y.requiredKg} kg</span>,
    },
    {
      key: 'stock',
      header: 'Current Stock',
      render: (y) => <span>{y.availableKg !== undefined ? `${y.availableKg} kg` : '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      render: (y) =>
        (y.shortfallKg ?? 0) > 0 ? (
          <Badge variant="danger" label={`-${y.shortfallKg} kg short`} dot />
        ) : (
          <Badge variant="success" label="Available" dot />
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto page-content pb-16">
      {/* Top bar & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-(--color-text-muted) hover:text-(--color-accent) mb-2 transition-colors"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            Back to Orders
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-(--color-text) tracking-tight">
              {order.orderNumber}
            </h1>
            <Badge
              variant={STATUS_VARIANTS[order.status] ?? 'neutral'}
              label={order.status.replace('_', ' ')}
              dot
            />
          </div>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            Buyer: <span className="font-semibold text-(--color-text)">{order.buyerName}</span> · Created on {formatDate(order.createdAt)}
          </p>
        </div>

        {/* Start Production CTA */}
        {canStartProduction && (
          <div className="flex flex-col items-start sm:items-end gap-1.5">
            <Button
              variant="primary"
              size="lg"
              disabled={hasShortfall}
              onClick={() => setConfirmOpen(true)}
              className="shadow-xs font-semibold"
            >
              <PlayIcon className="w-4 h-4 mr-1.5 fill-current" />
              Start Production
            </Button>
            {hasShortfall && (
              <span className="text-xs text-(--color-warning) font-medium flex items-center gap-1">
                <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                Blocked: Yarn shortfall exists in inventory
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Specs + Yarn BOM + Stages */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Order Specifications */}
          <Card className="p-6 flex flex-col gap-4">
            <h2 className="text-base font-bold text-(--color-text) border-b border-(--color-border) pb-3">
              Fabric Specifications & Value
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-(--color-text-muted)">Fabric Type</span>
                <p className="font-semibold text-sm text-(--color-text) mt-0.5">{order.fabricType}</p>
              </div>
              <div>
                <span className="text-(--color-text-muted)">Colour / Shade</span>
                <p className="font-semibold text-sm text-(--color-text) mt-0.5">{order.colour}</p>
              </div>
              <div>
                <span className="text-(--color-text-muted)">Ordered Metres</span>
                <p className="font-semibold text-sm text-(--color-text) mt-0.5">
                  {order.metres.toLocaleString('en-IN')} m
                </p>
              </div>
              <div>
                <span className="text-(--color-text-muted)">Rate per Metre</span>
                <p className="font-semibold text-sm text-(--color-text) mt-0.5">
                  {formatCurrency(order.ratePerMetre)}
                </p>
              </div>
            </div>

            <div className="mt-2 pt-3 border-t border-(--color-border)/60 flex items-center justify-between text-xs">
              <span className="text-(--color-text-muted)">Estimated Order Total</span>
              <span className="text-base font-bold text-(--color-text)">
                {formatCurrency(order.totalAmount)}
              </span>
            </div>
          </Card>

          {/* Yarn BOM & Inventory Status */}
          <Card className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-(--color-border) pb-3">
              <h2 className="text-base font-bold text-(--color-text)">Yarn Requirements & Availability</h2>
              {hasShortfall ? (
                <Badge variant="warning" label="Shortfall Detected" dot />
              ) : (
                <Badge variant="success" label="Materials Available" dot />
              )}
            </div>

            <Table columns={yarnColumns} rows={order.yarnRequirements} rowKey={(y) => y.yarnTypeId} />
          </Card>

          {/* Stage Progress Pipeline */}
          <Card className="p-6 flex flex-col gap-4">
            <h2 className="text-base font-bold text-(--color-text) border-b border-(--color-border) pb-3">
              Production Stage Progress
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {order.stageProgress?.map((stage, idx) => {
                const isComplete = stage.status === 'COMPLETED';
                const isInProgress = stage.status === 'IN_PROGRESS';
                const pct = stage.targetMetres > 0
                  ? Math.min(100, Math.round((stage.producedMetres / stage.targetMetres) * 100))
                  : 0;

                return (
                  <div
                    key={stage.stage}
                    className={[
                      'p-4 rounded-xl border flex flex-col gap-2',
                      isComplete
                        ? 'bg-(--color-success-light) border-(--color-success-border)'
                        : isInProgress
                        ? 'bg-(--color-accent-light) border-[#FDBA74]'
                        : 'bg-(--color-bg) border-(--color-border)',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-(--color-text)">
                        {idx + 1}. {stage.stage}
                      </span>
                      <Badge
                        variant={isComplete ? 'success' : isInProgress ? 'info' : 'neutral'}
                        label={stage.status.replace('_', ' ')}
                      />
                    </div>

                    <p className="text-xs text-(--color-text-muted)">
                      {stage.machineName ? `Assigned: ${stage.machineName}` : 'Awaiting assignment'}
                    </p>

                    <div className="mt-1">
                      <div className="flex justify-between text-xs font-medium text-(--color-text) mb-1">
                        <span>{stage.producedMetres} m</span>
                        <span className="text-(--color-text-muted)">{pct}%</span>
                      </div>
                      <ProgressBar value={pct} tone={isComplete ? 'success' : 'accent'} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Col: Commercials, Rolls & Delivery Info */}
        <div className="flex flex-col gap-6">
          {/* Delivery & Timeline Card */}
          <Card className="p-6 flex flex-col gap-4">
            <h2 className="text-base font-bold text-(--color-text) border-b border-(--color-border) pb-3">
              Delivery Schedule
            </h2>

            <div className="flex items-start gap-3 text-xs">
              <ClockIcon className="w-5 h-5 text-(--color-accent) shrink-0 mt-0.5" />
              <div>
                <p className="text-(--color-text-muted)">Deadline Date</p>
                <p className="text-sm font-bold text-(--color-text) mt-0.5">
                  {formatDate(order.deadline)}
                </p>
              </div>
            </div>

            <div className="border-t border-(--color-border)/60 pt-3 text-xs flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-(--color-text-muted)">Buyer Contact:</span>
                <span className="font-medium text-(--color-text)">{order.buyerPhone ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-(--color-text-muted)">Current Stage:</span>
                <span className="font-semibold text-(--color-accent)">{order.currentStage}</span>
              </div>
            </div>
          </Card>

          {/* Roll Production & QC Summary */}
          <Card className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-(--color-border) pb-3">
              <h2 className="text-base font-bold text-(--color-text)">Finished Rolls & QC</h2>
              <span className="text-xs font-semibold text-(--color-text-muted)">
                {order.rollSummary?.totalRolls ?? 0} rolls
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-(--color-success-light) border border-(--color-success-border) text-(--color-success)">
                <p className="font-bold text-base">{order.rollSummary?.passedRolls ?? 0}</p>
                <p className="text-[11px] font-medium">Passed</p>
              </div>
              <div className="p-2.5 rounded-lg bg-(--color-warning-light) border border-[#FDE68A] text-(--color-warning)">
                <p className="font-bold text-base">{order.rollSummary?.inQcRolls ?? 0}</p>
                <p className="text-[11px] font-medium">In QC</p>
              </div>
            </div>

            {/* Rolls List */}
            {order.rollSummary && order.rollSummary.rolls.length > 0 ? (
              <div className="flex flex-col gap-2 mt-2 max-h-60 overflow-y-auto">
                {order.rollSummary.rolls.map((roll) => (
                  <div
                    key={roll.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-(--color-bg) border border-(--color-border) text-xs"
                  >
                    <div>
                      <span className="font-semibold text-(--color-text)">{roll.rollNumber}</span>
                      <span className="text-(--color-text-muted) ml-2">{roll.metres} m</span>
                    </div>
                    <Badge
                      variant={QC_STATUS_VARIANTS[roll.qcStatus] ?? 'neutral'}
                      label={roll.qcStatus}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-(--color-text-muted) text-center py-4 italic">
                Rolls will appear here once created from dyeing output.
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Start Production Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Start Production"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-(--color-text-muted)">
            Are you sure you want to start production for order <strong className="text-(--color-text)">{order.orderNumber}</strong>?
          </p>

          <Callout tone="accent" title="Automated Actions:">
            <ul className="list-disc list-inside space-y-0.5">
              <li>Raw material ({order.yarnRequirements.map((y) => `${y.requiredKg} kg`).join(', ')}) will be issued from yarn store.</li>
              <li>Order status will change to <strong>IN_PRODUCTION</strong>.</li>
              <li>Spinning stage job will become ready on the machine floor.</li>
            </ul>
          </Callout>

          {actionError && <Callout tone="danger">{actionError}</Callout>}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setConfirmOpen(false)}
              disabled={starting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={starting}
              onClick={handleConfirmStartProduction}
            >
              Confirm & Issue Yarn
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
