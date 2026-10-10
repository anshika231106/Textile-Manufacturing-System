import { useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { useToast } from '../../components/ui/Toast';
import {
  getOrder,
  startProduction,
  deleteOrder,
  type Order,
  type OrderStatus,
  type StageProgress,
} from './orders.api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { Dialog } from '../../components/ui/Dialog';
import { Callout } from '../../components/ui/Callout';
import { formatCurrency, formatDate } from '../../lib/format';
import { transitionSmooth } from '../../lib/motion';
import {
  ArrowLeftIcon,
  PlayIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  PhoneIcon,
  CheckIcon,
  LockClosedIcon,
  InboxIcon,
} from '@heroicons/react/24/outline';

type Tone = 'neutral' | 'warning' | 'info' | 'success' | 'danger';

const STATUS_VARIANTS: Record<OrderStatus, Tone> = {
  PENDING:       'neutral',
  IN_PRODUCTION: 'info',
  QC:            'warning',
  READY:         'success',
  DISPATCHED:    'success',
  COMPLETED:     'success',
  CANCELLED:     'danger',
};

const QC_STATUS_VARIANTS: Record<string, Tone> = {
  PENDING: 'warning',
  PASS:    'success',
  REWORK:  'warning',
  REJECT:  'danger',
};

// How far along the order lifecycle each status is; drives the QC and Dispatch steps of the thread.
const STATUS_RANK: Record<OrderStatus, number> = {
  CANCELLED: -1,
  PENDING: 0,
  IN_PRODUCTION: 1,
  QC: 2,
  READY: 3,
  DISPATCHED: 4,
  COMPLETED: 5,
};

// Common mill shade names → swatch colour. Anything unknown gets a stable hue hashed from its name.
const SHADE_HEX: Record<string, string> = {
  white: '#F4F1EA', 'bleached white': '#F7F6F2', ivory: '#EFE6D2', 'raw ivory': '#E9DFC6', cream: '#F1E6C8',
  natural: '#DCCFB4', beige: '#D9C6A5', khaki: '#BFA77A', sand: '#D4BC8E', brown: '#7A5235',
  black: '#26221F', charcoal: '#3E3B39', grey: '#9A9792', gray: '#9A9792', silver: '#C3C2BE',
  navy: '#1F2E55', 'navy blue': '#1F2E55', blue: '#2F5FA8', 'sky blue': '#7FB3DE', indigo: '#33366E', teal: '#2D7A78',
  green: '#3E7D4F', olive: '#6F7140', sage: '#9CAF88', mint: '#A9D8C0', emerald: '#2E8B62',
  red: '#B4372F', maroon: '#6E2230', burgundy: '#6B1F2E', pink: '#E39AAE', rose: '#D27C8C',
  orange: '#E07A2F', rust: '#A7502A', yellow: '#E5C14A', mustard: '#C9A13A', gold: '#C9A44C',
  purple: '#6B4A8E', lavender: '#B7A6D6', violet: '#7C4FA0',
};

function shadeToColour(name: string): string {
  const key = name.trim().toLowerCase();
  if (SHADE_HEX[key]) return SHADE_HEX[key];
  const word = key.split(/\s+/).reverse().find((w) => SHADE_HEX[w]);
  if (word) return SHADE_HEX[word];
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 38% 58%)`;
}

const DAY_MS = 86_400_000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function deadlineInfo(order: Order) {
  const [y, m, d] = order.deadline.slice(0, 10).split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const created = startOfDay(new Date(order.createdAt));
  const today = startOfDay(new Date());
  const daysLeft = Math.round((due.getTime() - today.getTime()) / DAY_MS);
  const span = Math.max(1, Math.round((due.getTime() - created.getTime()) / DAY_MS));
  const elapsed = Math.min(1, Math.max(0, (span - Math.max(daysLeft, 0)) / span));
  const delivered = order.status === 'COMPLETED' || order.status === 'DISPATCHED';
  const tone: Tone = delivered ? 'success' : daysLeft < 0 ? 'danger' : daysLeft <= 3 ? 'warning' : 'info';
  return { daysLeft, elapsed, delivered, tone };
}

type StepState = 'done' | 'active' | 'todo';

interface ThreadStep {
  key: string;
  label: string;
  state: StepState;
  detail: string;
  pct?: number;
}

function stagePct(stage: StageProgress) {
  return stage.targetMetres > 0
    ? Math.min(100, Math.round((stage.producedMetres / stage.targetMetres) * 100))
    : 0;
}

function buildThread(order: Order): ThreadStep[] {
  const rank = STATUS_RANK[order.status] ?? 0;

  const production: ThreadStep[] = (order.stageProgress ?? []).map((stage) => ({
    key: stage.stage,
    label: stage.stage.charAt(0) + stage.stage.slice(1).toLowerCase(),
    state: stage.status === 'COMPLETED' ? 'done' : stage.status === 'IN_PROGRESS' ? 'active' : 'todo',
    detail: stage.machineName ?? 'Awaiting machine',
    pct: stagePct(stage),
  }));

  return [
    { key: 'RECEIVED', label: 'Received', state: 'done', detail: formatDate(order.createdAt) },
    ...production,
    {
      key: 'QC',
      label: 'Quality check',
      state: rank >= 3 ? 'done' : rank === 2 ? 'active' : 'todo',
      detail: `${order.rollSummary?.passedRolls ?? 0}/${order.rollSummary?.totalRolls ?? 0} rolls passed`,
    },
    {
      key: 'DISPATCH',
      label: 'Dispatch',
      state: rank >= 5 ? 'done' : rank >= 3 ? 'active' : 'todo',
      detail: rank >= 5 ? 'Delivered' : rank === 4 ? 'Partially shipped' : rank === 3 ? 'Ready to ship' : 'Not yet',
    },
  ];
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [starting, setStarting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const { data: order, loading, error, reload } = useApi<Order>(
    () => getOrder(id!),
    [id]
  );

  const isManager = user?.role === 'OWNER' || user?.role === 'OFFICE';
  const canStartProduction =
    (isManager || user?.role === 'SUPERVISOR') && order?.status === 'PENDING';
  // Mirrors the server rule: only orders that never entered production can be deleted.
  const canDelete = order?.status === 'PENDING';

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

  function openDelete() {
    setConfirmText('');
    setDeleteError('');
    setDeleteOpen(true);
  }

  async function handleConfirmDelete() {
    if (!order) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteOrder(order.id);
      showToast(`Order ${order.orderNumber} deleted.`, 'success');
      setDeleteOpen(false);
      navigate('/orders');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete order.');
    } finally {
      setDeleting(false);
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

  const swatch = shadeToColour(order.colour);
  const due = deadlineInfo(order);
  const thread = buildThread(order);
  const reachedIdx = thread.reduce((acc, step, idx) => (step.state !== 'todo' ? idx : acc), 0);
  const threadPct = thread.length > 1 ? (reachedIdx / (thread.length - 1)) * 100 : 0;
  const rolls = order.rollSummary;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto page-content pb-16">
      <button
        type="button"
        onClick={() => navigate('/orders')}
        className="self-start inline-flex items-center gap-1.5 text-xs font-medium text-(--color-text-muted) hover:text-(--color-accent) transition-colors"
      >
        <ArrowLeftIcon className="w-3.5 h-3.5" />
        Back to Orders
      </button>

      {/* Hero: fabric swatch + identity + actions */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitionSmooth}
        className="relative overflow-hidden rounded-2xl border border-(--color-border) bg-(--color-surface) shadow-sm"
      >
        {/* Shade wash bleeding in from the swatch side */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.10]"
          style={{ background: `radial-gradient(120% 140% at 0% 0%, ${swatch} 0%, transparent 55%)` }}
        />

        <div className="relative p-5 sm:p-7 flex flex-col lg:flex-row lg:items-center gap-6">
          <FabricSwatch colour={swatch} label={order.colour} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-(--color-text) tracking-tight font-mono">
                {order.orderNumber}
              </h1>
              <Badge
                variant={STATUS_VARIANTS[order.status] ?? 'neutral'}
                label={order.status.replace('_', ' ')}
                dot
              />
            </div>
            <p className="mt-1.5 text-sm text-(--color-text-muted)">
              <span className="font-semibold text-(--color-text)">{order.fabricType}</span>
              {' in '}
              <span className="font-semibold text-(--color-text)">{order.colour}</span>
              {' for '}
              <span className="font-semibold text-(--color-text)">{order.buyerName}</span>
            </p>
            <p className="mt-0.5 text-xs text-(--color-text-subtle)">Created on {formatDate(order.createdAt)}</p>
          </div>

          {(canStartProduction || isManager) && (
            <div className="flex flex-col items-stretch sm:items-end gap-2">
              <div className="flex items-center gap-2">
                {isManager && (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={openDelete}
                    className="hover:border-(--color-danger)/50! hover:bg-(--color-danger-light)! hover:text-(--color-danger)!"
                    aria-label="Delete order"
                  >
                    <TrashIcon className="w-4 h-4" />
                    Delete
                  </Button>
                )}
                {canStartProduction && (
                  <Button
                    variant="primary"
                    size="md"
                    disabled={hasShortfall}
                    onClick={() => setConfirmOpen(true)}
                    className="font-semibold"
                  >
                    <PlayIcon className="w-4 h-4 fill-current" />
                    Start Production
                  </Button>
                )}
              </div>
              {canStartProduction && hasShortfall && (
                <span className="text-xs text-(--color-warning) font-medium flex items-center gap-1">
                  <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                  Blocked: yarn shortfall in inventory
                </span>
              )}
            </div>
          )}
        </div>

        {/* Key figures strip */}
        <dl className="relative grid grid-cols-2 sm:grid-cols-4 gap-px border-t border-(--color-border) bg-(--color-border)">
          <Figure label="Ordered" value={`${order.metres.toLocaleString('en-IN')} m`} />
          <Figure label="Rate / metre" value={formatCurrency(order.ratePerMetre)} />
          <Figure label="Order value" value={formatCurrency(order.totalAmount)} emphasis />
          <Figure label="Deadline" value={formatDate(order.deadline)} />
        </dl>
      </motion.div>

      {/* Production thread */}
      <Card className="p-5 sm:p-6">
        <SectionTitle
          title="Production thread"
          aside={
            <span className="text-xs text-(--color-text-muted)">
              Now at <span className="font-semibold text-(--color-accent)">{order.currentStage}</span>
            </span>
          }
        />
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <ol className="relative grid min-w-[640px] pt-2" style={{ gridTemplateColumns: `repeat(${thread.length}, minmax(0, 1fr))` }}>
            {/* The thread: dashed base with a solid run that fills to the furthest reached step */}
            <div
              aria-hidden
              className="absolute top-[22px] h-0.5 border-t-2 border-dashed border-(--color-border)"
              style={{ left: `${50 / thread.length}%`, right: `${50 / thread.length}%` }}
            />
            <div
              aria-hidden
              className="absolute top-[22px] h-0.5"
              style={{ left: `${50 / thread.length}%`, right: `${50 / thread.length}%` }}
            >
              <motion.div
                className="h-full rounded-full bg-(--color-accent)"
                initial={{ width: 0 }}
                animate={{ width: `${threadPct}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
              />
            </div>

            {thread.map((step, idx) => (
              <li key={step.key} className="relative flex flex-col items-center text-center px-1.5">
                <ThreadKnot state={step.state} index={idx} />
                <p
                  className={[
                    'mt-3 text-xs font-semibold',
                    step.state === 'todo' ? 'text-(--color-text-muted)' : 'text-(--color-text)',
                  ].join(' ')}
                >
                  {step.label}
                </p>
                <p className="mt-0.5 text-[11px] text-(--color-text-subtle) truncate max-w-full">{step.detail}</p>
                {step.pct !== undefined && step.state !== 'todo' && (
                  <div className="mt-2 w-full max-w-[96px]">
                    <div className="h-1 rounded-full bg-(--color-surface-sunken) overflow-hidden">
                      <motion.div
                        className={[
                          'h-full rounded-full',
                          step.state === 'done' ? 'bg-(--color-success)' : 'bg-(--color-accent)',
                        ].join(' ')}
                        initial={{ width: 0 }}
                        animate={{ width: `${step.pct}%` }}
                        transition={{ duration: 0.6, delay: 0.3 + idx * 0.05 }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] font-medium text-(--color-text-muted)">{step.pct}%</p>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Yarn requirements */}
        <Card className="lg:col-span-2 p-5 sm:p-6 flex flex-col">
          <SectionTitle
            title="Yarn requirements"
            aside={
              order.yarnRequirements.length === 0 ? null : hasShortfall ? (
                <Badge variant="warning" label="Shortfall detected" dot />
              ) : (
                <Badge variant="success" label="Materials available" dot />
              )
            }
          />

          {order.yarnRequirements.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10 rounded-xl border border-dashed border-(--color-border) bg-(--color-surface-alt)">
              <InboxIcon className="w-6 h-6 text-(--color-text-subtle)" />
              <p className="text-sm font-medium text-(--color-text)">No yarn recorded</p>
              <p className="text-xs text-(--color-text-muted)">This order has no yarn requirements on file.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {order.yarnRequirements.map((y) => {
                const short = (y.shortfallKg ?? 0) > 0;
                const coverage =
                  y.availableKg !== undefined && y.requiredKg > 0
                    ? Math.min(100, Math.round((y.availableKg / y.requiredKg) * 100))
                    : undefined;
                return (
                  <li
                    key={y.yarnTypeId}
                    className="p-3.5 rounded-xl border border-(--color-border) bg-(--color-surface-alt)"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-(--color-text) truncate">
                          {y.yarnTypeName ?? y.yarnTypeId}
                        </p>
                        <p className="text-[11px] font-mono text-(--color-text-muted)">{y.yarnTypeCode ?? '—'}</p>
                      </div>
                      {short ? (
                        <Badge variant="danger" label={`${y.shortfallKg} kg short`} dot />
                      ) : (
                        <Badge variant="success" label="Covered" dot />
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-(--color-surface-sunken) overflow-hidden">
                        <div
                          className={[
                            'h-full rounded-full transition-[width] duration-500',
                            short ? 'bg-(--color-danger)' : 'bg-(--color-success)',
                          ].join(' ')}
                          style={{ width: `${coverage ?? 0}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-(--color-text-muted) whitespace-nowrap">
                        <span className="font-semibold text-(--color-text)">{y.requiredKg} kg</span> needed
                        {y.availableKg !== undefined && <> · {y.availableKg} kg in stock</>}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Delivery */}
        <Card className="p-5 sm:p-6 flex flex-col">
          <SectionTitle title="Delivery" />
          <div className="flex items-center gap-4">
            <DeadlineRing elapsed={due.delivered ? 1 : due.elapsed} tone={due.tone}>
              {due.delivered ? (
                <CheckIcon className="w-6 h-6" />
              ) : (
                <>
                  <span className="text-xl font-bold leading-none tabular-nums">{Math.abs(due.daysLeft)}</span>
                  <span className="text-[10px] font-medium uppercase tracking-wide mt-0.5">days</span>
                </>
              )}
            </DeadlineRing>
            <div>
              <p className="text-sm font-semibold text-(--color-text)">
                {due.delivered
                  ? 'Delivered'
                  : due.daysLeft < 0
                  ? 'Overdue'
                  : due.daysLeft === 0
                  ? 'Due today'
                  : 'Until deadline'}
              </p>
              <p className="text-xs text-(--color-text-muted) mt-0.5">Due {formatDate(order.deadline)}</p>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-(--color-border) flex flex-col gap-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-(--color-text-muted)">Buyer</span>
              <span className="font-medium text-(--color-text) text-right">{order.buyerName}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-(--color-text-muted)">Contact</span>
              {order.buyerPhone ? (
                <a
                  href={`tel:${order.buyerPhone}`}
                  className="inline-flex items-center gap-1 font-medium text-(--color-text) hover:text-(--color-accent) transition-colors"
                >
                  <PhoneIcon className="w-3.5 h-3.5" />
                  {order.buyerPhone}
                </a>
              ) : (
                <span className="text-(--color-text-subtle)">—</span>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Rolls & QC */}
      <Card className="p-5 sm:p-6">
        <SectionTitle
          title="Finished rolls & QC"
          aside={
            <span className="text-xs font-semibold text-(--color-text-muted)">
              {rolls?.totalRolls ?? 0} {rolls?.totalRolls === 1 ? 'roll' : 'rolls'}
            </span>
          }
        />

        <QcBreakdown summary={rolls} />

        {rolls && rolls.rolls.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
            {rolls.rolls.map((roll) => (
              <div
                key={roll.id}
                className="flex items-center justify-between gap-2 p-3 rounded-lg bg-(--color-surface-alt) border border-(--color-border) text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold font-mono text-(--color-text) truncate">{roll.rollNumber}</p>
                  <p className="text-(--color-text-muted)">
                    {roll.metres} m{roll.defectType ? ` · ${roll.defectType}` : ''}
                  </p>
                </div>
                <Badge variant={QC_STATUS_VARIANTS[roll.qcStatus] ?? 'neutral'} label={roll.qcStatus} />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-xs text-(--color-text-muted) text-center py-4">
            Rolls will appear here once created from dyeing output.
          </p>
        )}
      </Card>

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

      {/* Delete Order Dialog */}
      <Dialog
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        title={canDelete ? 'Delete order' : 'Order can’t be deleted'}
      >
        {canDelete ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (confirmText.trim() === order.orderNumber) handleConfirmDelete();
            }}
          >
            <p className="text-sm text-(--color-text-muted)">
              This permanently removes <strong className="text-(--color-text)">{order.orderNumber}</strong> for{' '}
              {order.buyerName}, along with its yarn requirements. This can’t be undone.
            </p>

            <label className="flex flex-col gap-1.5 text-xs text-(--color-text-muted)">
              <span>
                Type <span className="font-mono font-semibold text-(--color-text)">{order.orderNumber}</span> to confirm
              </span>
              <input
                autoFocus
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={order.orderNumber}
                className="w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm font-mono text-(--color-text) placeholder:text-(--color-text-subtle) focus:outline-none focus:ring-2 focus:ring-(--color-danger)/40 focus:border-(--color-danger)"
              />
            </label>

            {deleteError && <Callout tone="danger">{deleteError}</Callout>}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button type="button" variant="secondary" size="md" onClick={() => setDeleteOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                size="md"
                loading={deleting}
                disabled={confirmText.trim() !== order.orderNumber}
              >
                <TrashIcon className="w-4 h-4" />
                Delete order
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-9 h-9 rounded-full bg-(--color-surface-sunken) flex items-center justify-center">
                <LockClosedIcon className="w-4.5 h-4.5 text-(--color-text-muted)" />
              </span>
              <p className="text-sm text-(--color-text-muted)">
                <strong className="text-(--color-text)">{order.orderNumber}</strong> has already entered production.
                Yarn has been issued and production records reference it, so it’s kept for the stock ledger and
                traceability. Only orders that haven’t started production can be deleted.
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="md" onClick={() => setDeleteOpen(false)}>
                Got it
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function SectionTitle({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-(--color-text-muted)">{title}</h2>
      {aside}
    </div>
  );
}

function Figure({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="px-5 sm:px-7 py-4 bg-(--color-surface)">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-(--color-text-subtle)">{label}</dt>
      <dd
        className={[
          'mt-1 font-bold tabular-nums',
          emphasis ? 'text-lg text-(--color-accent)' : 'text-base text-(--color-text)',
        ].join(' ')}
      >
        {value}
      </dd>
    </div>
  );
}

/** A small woven-cloth tile: crossing warp/weft stripes over the order's shade. */
function FabricSwatch({ colour, label }: { colour: string; label: string }) {
  const weave = [
    'repeating-linear-gradient(0deg, rgba(255,255,255,0.16) 0 2px, transparent 2px 5px)',
    'repeating-linear-gradient(90deg, rgba(0,0,0,0.12) 0 2px, transparent 2px 5px)',
    'repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 7px)',
  ].join(', ');

  return (
    <motion.div
      initial={{ rotate: -6, scale: 0.92, opacity: 0 }}
      animate={{ rotate: -3, scale: 1, opacity: 1 }}
      whileHover={{ rotate: 0, scale: 1.04 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl shadow-md ring-1 ring-black/10 overflow-hidden"
      style={{ backgroundColor: colour, backgroundImage: weave }}
      title={`Shade: ${label}`}
      role="img"
      aria-label={`Fabric shade ${label}`}
    >
      {/* Frayed bottom edge + shade tag */}
      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-[repeating-linear-gradient(90deg,rgba(0,0,0,0.18)_0_1px,transparent_1px_3px)]" />
      <span className="absolute left-1.5 bottom-2.5 max-w-[calc(100%-12px)] truncate rounded bg-white/85 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#1A1714]">
        {label}
      </span>
    </motion.div>
  );
}

function ThreadKnot({ state, index }: { state: StepState; index: number }) {
  return (
    <motion.span
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.1 + index * 0.07, type: 'spring', stiffness: 380, damping: 22 }}
      className={[
        'relative z-10 flex items-center justify-center w-11 h-11 rounded-full border-2 text-xs font-bold',
        state === 'done'
          ? 'bg-(--color-accent) border-(--color-accent) text-white'
          : state === 'active'
          ? 'bg-(--color-surface) border-(--color-accent) text-(--color-accent)'
          : 'bg-(--color-surface) border-(--color-border) text-(--color-text-subtle)',
      ].join(' ')}
    >
      {state === 'active' && (
        <span className="absolute inset-0 rounded-full border-2 border-(--color-accent) animate-ping opacity-30" />
      )}
      {state === 'done' ? <CheckIcon className="w-5 h-5" strokeWidth={2.5} /> : index + 1}
    </motion.span>
  );
}

const RING_TONE: Record<Tone, string> = {
  success: 'text-(--color-success)',
  warning: 'text-(--color-warning)',
  danger: 'text-(--color-danger)',
  info: 'text-(--color-accent)',
  neutral: 'text-(--color-text-muted)',
};

function DeadlineRing({ elapsed, tone, children }: { elapsed: number; tone: Tone; children: ReactNode }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className={['relative w-20 h-20 shrink-0', RING_TONE[tone]].join(' ')}>
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="6" className="stroke-(--color-surface-sunken)" />
        <motion.circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - elapsed) }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function QcBreakdown({ summary }: { summary: Order['rollSummary'] | undefined }) {
  const segments = [
    { key: 'passed', label: 'Passed', value: summary?.passedRolls ?? 0, bar: 'bg-(--color-success)' },
    { key: 'inQc', label: 'In QC', value: summary?.inQcRolls ?? 0, bar: 'bg-(--color-warning)' },
    { key: 'rework', label: 'Rework', value: summary?.reworkRolls ?? 0, bar: 'bg-(--color-info)' },
    { key: 'rejected', label: 'Rejected', value: summary?.rejectedRolls ?? 0, bar: 'bg-(--color-danger)' },
  ];
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-(--color-surface-sunken) gap-0.5">
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <motion.div
                key={s.key}
                className={s.bar}
                initial={{ width: 0 }}
                animate={{ width: `${(s.value / total) * 100}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
            ))}
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-xs">
            <span className={['w-2 h-2 rounded-full shrink-0', s.bar].join(' ')} />
            <span className="text-(--color-text-muted)">{s.label}</span>
            <span className="ml-auto sm:ml-0 font-bold tabular-nums text-(--color-text)">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
