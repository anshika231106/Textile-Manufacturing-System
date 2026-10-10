import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
import { formatCurrency, formatDate } from '../../lib/format';
import {
  ArrowLeftIcon,
  PlayIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowTopRightOnSquareIcon,
  ClockIcon,
  SparklesIcon,
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

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [copied, setCopied] = useState(false);
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

  async function handleCopyTrackingLink() {
    if (!order) return;
    const trackingUrl = `${window.location.origin}/track/${order.trackingToken}`;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      showToast('Tracking link copied to clipboard', 'info');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Failed to copy link', 'error');
    }
  }

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

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto page-content pb-16">
      {/* Top bar & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#78716C] hover:text-[#EA580C] mb-2 transition-colors"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            Back to Orders
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1714] tracking-tight">
              {order.orderNumber}
            </h1>
            <Badge
              variant={STATUS_VARIANTS[order.status] ?? 'neutral'}
              label={order.status.replace('_', ' ')}
              dot
            />
          </div>
          <p className="mt-1 text-sm text-[#78716C]">
            Buyer: <span className="font-semibold text-[#1A1714]">{order.buyerName}</span> · Created on {formatDate(order.createdAt)}
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
              <span className="text-xs text-[#D97706] font-medium flex items-center gap-1">
                <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                Blocked: Yarn shortfall exists in inventory
              </span>
            )}
          </div>
        )}
      </div>

      {/* Public Tracking Link Banner */}
      <Card className="p-4 bg-gradient-to-r from-orange-50/50 via-white to-orange-50/30 border-[#EA580C]/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <SparklesIcon className="w-5 h-5 text-[#EA580C] shrink-0" />
            <div>
              <p className="text-xs font-bold text-[#1A1714]">Buyer Public Tracking Link</p>
              <p className="text-xs text-[#78716C]">
                Share this secure tokenized link with the buyer to view live production progress without logging in.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-white border border-[#E8E4DF] rounded-lg px-3 py-1.5 text-xs text-[#78716C] font-mono select-all truncate max-w-[220px]">
              /track/{order.trackingToken}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyTrackingLink}
              className="text-xs shrink-0"
            >
              {copied ? (
                <>
                  <CheckIcon className="w-3.5 h-3.5 mr-1 text-[#16A34A]" />
                  Copied
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="w-3.5 h-3.5 mr-1" />
                  Copy Link
                </>
              )}
            </Button>
            <Link
              to={`/track/${order.trackingToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center p-2 rounded-lg border border-[#E8E4DF] bg-white text-[#78716C] hover:text-[#EA580C] hover:border-[#EA580C]/30 transition-colors"
              title="Open Public Tracking Page"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Specs + Yarn BOM + Stages */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Order Specifications */}
          <Card className="p-6 flex flex-col gap-4">
            <h2 className="text-base font-bold text-[#1A1714] border-b border-[#E8E4DF] pb-3">
              Fabric Specifications & Value
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[#78716C]">Fabric Type</span>
                <p className="font-semibold text-sm text-[#1A1714] mt-0.5">{order.fabricType}</p>
              </div>
              <div>
                <span className="text-[#78716C]">Colour / Shade</span>
                <p className="font-semibold text-sm text-[#1A1714] mt-0.5">{order.colour}</p>
              </div>
              <div>
                <span className="text-[#78716C]">Ordered Metres</span>
                <p className="font-semibold text-sm text-[#1A1714] mt-0.5">
                  {order.metres.toLocaleString('en-IN')} m
                </p>
              </div>
              <div>
                <span className="text-[#78716C]">Rate per Metre</span>
                <p className="font-semibold text-sm text-[#1A1714] mt-0.5">
                  {formatCurrency(order.ratePerMetre)}
                </p>
              </div>
            </div>

            <div className="mt-2 pt-3 border-t border-[#E8E4DF]/60 flex items-center justify-between text-xs">
              <span className="text-[#78716C]">Estimated Order Total</span>
              <span className="text-base font-bold text-[#1A1714]">
                {formatCurrency(order.totalAmount)}
              </span>
            </div>
          </Card>

          {/* Yarn BOM & Inventory Status */}
          <Card className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#E8E4DF] pb-3">
              <h2 className="text-base font-bold text-[#1A1714]">Yarn Requirements & Availability</h2>
              {hasShortfall ? (
                <Badge variant="warning" label="Shortfall Detected" dot />
              ) : (
                <Badge variant="success" label="Materials Available" dot />
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[#78716C] font-medium border-b border-[#E8E4DF]">
                  <tr>
                    <th className="pb-2">Yarn Type</th>
                    <th className="pb-2">Code</th>
                    <th className="pb-2">Required</th>
                    <th className="pb-2">Current Stock</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E4DF]/60 text-[#1A1714]">
                  {order.yarnRequirements.map((y, idx) => (
                    <tr key={idx} className="py-2.5">
                      <td className="py-2.5 font-semibold">{y.yarnTypeName ?? y.yarnTypeId}</td>
                      <td className="py-2.5 font-mono text-[#78716C]">{y.yarnTypeCode ?? '—'}</td>
                      <td className="py-2.5 font-bold">{y.requiredKg} kg</td>
                      <td className="py-2.5">{y.availableKg !== undefined ? `${y.availableKg} kg` : '—'}</td>
                      <td className="py-2.5 text-right">
                        {(y.shortfallKg ?? 0) > 0 ? (
                          <span className="text-[#DC2626] font-semibold">
                            -{y.shortfallKg} kg short
                          </span>
                        ) : (
                          <span className="text-[#16A34A] font-semibold">Available</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Stage Progress Pipeline */}
          <Card className="p-6 flex flex-col gap-4">
            <h2 className="text-base font-bold text-[#1A1714] border-b border-[#E8E4DF] pb-3">
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
                        ? 'bg-[#F0FDF4] border-[#86EFAC]'
                        : isInProgress
                        ? 'bg-[#FFF7ED] border-[#FDBA74]'
                        : 'bg-[#FAFAF8] border-[#E8E4DF]',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1A1714]">
                        {idx + 1}. {stage.stage}
                      </span>
                      <Badge
                        variant={isComplete ? 'success' : isInProgress ? 'info' : 'neutral'}
                        label={stage.status.replace('_', ' ')}
                      />
                    </div>

                    <p className="text-xs text-[#78716C]">
                      {stage.machineName ? `Assigned: ${stage.machineName}` : 'Awaiting assignment'}
                    </p>

                    <div className="mt-1">
                      <div className="flex justify-between text-xs font-medium text-[#1A1714] mb-1">
                        <span>{stage.producedMetres} m</span>
                        <span className="text-[#78716C]">{pct}%</span>
                      </div>
                      <div className="w-full bg-[#E8E4DF] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#EA580C] rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
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
            <h2 className="text-base font-bold text-[#1A1714] border-b border-[#E8E4DF] pb-3">
              Delivery Schedule
            </h2>

            <div className="flex items-start gap-3 text-xs">
              <ClockIcon className="w-5 h-5 text-[#EA580C] shrink-0 mt-0.5" />
              <div>
                <p className="text-[#78716C]">Deadline Date</p>
                <p className="text-sm font-bold text-[#1A1714] mt-0.5">
                  {formatDate(order.deadline)}
                </p>
              </div>
            </div>

            <div className="border-t border-[#E8E4DF]/60 pt-3 text-xs flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-[#78716C]">Buyer Contact:</span>
                <span className="font-medium text-[#1A1714]">{order.buyerPhone ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#78716C]">Current Stage:</span>
                <span className="font-semibold text-[#EA580C]">{order.currentStage}</span>
              </div>
            </div>
          </Card>

          {/* Roll Production & QC Summary */}
          <Card className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#E8E4DF] pb-3">
              <h2 className="text-base font-bold text-[#1A1714]">Finished Rolls & QC</h2>
              <span className="text-xs font-semibold text-[#78716C]">
                {order.rollSummary?.totalRolls ?? 0} rolls
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-[#F0FDF4] border border-[#86EFAC] text-[#16A34A]">
                <p className="font-bold text-base">{order.rollSummary?.passedRolls ?? 0}</p>
                <p className="text-[11px] font-medium">Passed</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#D97706]">
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
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAFAF8] border border-[#E8E4DF] text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#1A1714]">{roll.rollNumber}</span>
                      <span className="text-[#78716C] ml-2">{roll.metres} m</span>
                    </div>
                    <Badge
                      variant={QC_STATUS_VARIANTS[roll.qcStatus] ?? 'neutral'}
                      label={roll.qcStatus}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#78716C] text-center py-4 italic">
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
          <p className="text-sm text-[#78716C]">
            Are you sure you want to start production for order <strong className="text-[#1A1714]">{order.orderNumber}</strong>?
          </p>

          <div className="p-3.5 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] text-xs text-[#C2410C]">
            <p className="font-semibold mb-1">Automated Actions:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Raw material ({order.yarnRequirements.map((y) => `${y.requiredKg} kg`).join(', ')}) will be issued from yarn store.</li>
              <li>Order status will change to <strong>IN_PRODUCTION</strong>.</li>
              <li>Spinning stage job will become ready on the machine floor.</li>
            </ul>
          </div>

          {actionError && (
            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] text-xs text-[#DC2626]">
              {actionError}
            </div>
          )}

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
