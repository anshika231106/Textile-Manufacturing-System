import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRightIcon,
  ArrowDownTrayIcon,
  BanknotesIcon,
  BeakerIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import { Badge } from '../../../components/ui/Badge';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { formatCurrency, formatDate, formatRelative } from '../../../lib/format';
import { staggerItem } from '../../../lib/motion';
import type {
  ActivityType,
  DashboardActivity,
  DashboardData,
  MachineStatus,
  OrderClientStatus,
} from '../reports.api';
import { STAGE_META, STAGE_ORDER } from './ProductionTrendChart';

// ─── Shared shell ─────────────────────────────────────────────────────────────

interface PanelProps {
  title: string;
  icon?: React.ElementType;
  subtitle?: ReactNode;
  action?: { label: string; to: string } | null;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, icon: Icon, subtitle, action, headerRight, children, className = '' }: PanelProps) {
  return (
    <motion.section
      variants={staggerItem}
      className={['flex flex-col rounded-xl border border-(--color-border) bg-white shadow-2xs', className].join(' ')}
    >
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-(--color-text)">
            {Icon && <Icon className="h-4.5 w-4.5 text-(--color-text-muted)" />}
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-xs text-(--color-text-muted)">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerRight}
          {action && (
            <Link
              to={action.to}
              className="group inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-(--color-accent) hover:bg-(--color-accent-light)"
            >
              {action.label}
              <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </header>
      <div className="flex-1 px-5 pb-5">{children}</div>
    </motion.section>
  );
}

// ─── Status vocab ─────────────────────────────────────────────────────────────

export const ORDER_STATUS_META: Record<OrderClientStatus, { label: string; variant: 'neutral' | 'warning' | 'info' | 'success' | 'danger' }> = {
  PENDING:       { label: 'Pending',           variant: 'neutral' },
  IN_PRODUCTION: { label: 'In production',     variant: 'info' },
  QC:            { label: 'In QC',             variant: 'warning' },
  READY:         { label: 'Ready to dispatch', variant: 'success' },
  DISPATCHED:    { label: 'Part dispatched',   variant: 'success' },
  COMPLETED:     { label: 'Completed',         variant: 'neutral' },
};

const MACHINE_STATUS_META: Record<MachineStatus, { label: string; dot: string; chip: string }> = {
  RUNNING:   { label: 'Running',   dot: 'bg-(--color-success)', chip: 'border-(--color-success-border) bg-(--color-success-light)' },
  IDLE:      { label: 'Idle',      dot: 'bg-(--color-text-subtle)', chip: 'border-(--color-border) bg-(--color-surface-alt)' },
  BREAKDOWN: { label: 'Breakdown', dot: 'bg-(--color-danger)', chip: 'border-(--color-danger-border) bg-(--color-danger-light)' },
};

// ─── Needs attention ──────────────────────────────────────────────────────────

export interface AttentionItem {
  key: string;
  tone: 'danger' | 'warning' | 'info' | 'success';
  icon: React.ElementType;
  title: string;
  detail: string;
  to?: string;
}

const ATTENTION_TONE: Record<AttentionItem['tone'], string> = {
  danger:  'border-(--color-danger-border) bg-(--color-danger-light) text-(--color-danger)',
  warning: 'border-(--color-warning-border) bg-(--color-warning-light) text-(--color-warning)',
  info:    'border-(--color-info-border) bg-(--color-info-light) text-(--color-info)',
  success: 'border-(--color-success-border) bg-(--color-success-light) text-(--color-success)',
};

export function buildAttentionItems(d: DashboardData, canAccess: (path: string) => boolean): AttentionItem[] {
  const items: AttentionItem[] = [];
  const link = (path: string) => (canAccess(path) ? path : undefined);

  if (d.machines.breakdown > 0) {
    items.push({
      key: 'breakdown',
      tone: 'danger',
      icon: WrenchScrewdriverIcon,
      title: `${d.machines.breakdown} machine${d.machines.breakdown === 1 ? '' : 's'} down`,
      detail: d.machines.breakdowns.map((m) => m.code).join(', '),
      to: link('/floor'),
    });
  }
  if (d.orders.overdue > 0) {
    items.push({
      key: 'overdue',
      tone: 'danger',
      icon: ExclamationTriangleIcon,
      title: `${d.orders.overdue} order${d.orders.overdue === 1 ? '' : 's'} past deadline`,
      detail: d.orders.upcoming.filter((o) => o.daysLeft < 0).map((o) => o.orderNo).join(', ') || 'See orders',
      to: link('/orders'),
    });
  }
  if (d.stock.lowStock.length > 0) {
    const short = d.stock.lowStock.filter((y) => y.shortfallKg > 0).length;
    items.push({
      key: 'stock',
      tone: short > 0 ? 'danger' : 'warning',
      icon: CubeIcon,
      title: `${d.stock.lowStock.length} yarn${d.stock.lowStock.length === 1 ? '' : 's'} below reorder level`,
      detail: short > 0 ? `${short} short for booked orders` : d.stock.lowStock.slice(0, 3).map((y) => y.code).join(', '),
      to: link('/stock'),
    });
  }
  if (d.quality.awaitingRolls > 0) {
    items.push({
      key: 'qc',
      tone: 'warning',
      icon: BeakerIcon,
      title: `${d.quality.awaitingRolls} roll${d.quality.awaitingRolls === 1 ? '' : 's'} awaiting QC`,
      detail: `${d.quality.awaitingMetres.toLocaleString('en-IN')} m to inspect`,
      to: link('/qc'),
    });
  }
  if (d.orders.dueThisWeek > 0) {
    items.push({
      key: 'due',
      tone: 'info',
      icon: ClipboardDocumentCheckIcon,
      title: `${d.orders.dueThisWeek} order${d.orders.dueThisWeek === 1 ? '' : 's'} due within 7 days`,
      detail: `${d.orders.activeMetres.toLocaleString('en-IN')} m in the active book`,
      to: link('/orders'),
    });
  }
  if (d.finishedGoods.readyRolls > 0) {
    items.push({
      key: 'ready',
      tone: 'success',
      icon: TruckIcon,
      title: `${d.finishedGoods.readyRolls} roll${d.finishedGoods.readyRolls === 1 ? '' : 's'} ready to dispatch`,
      detail: `${d.finishedGoods.readyMetres.toLocaleString('en-IN')} m passed QC`,
      to: link('/dispatch'),
    });
  }
  return items;
}

export function AttentionStrip({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <motion.div
        variants={staggerItem}
        className="flex items-center gap-3 rounded-xl border border-(--color-success-border) bg-(--color-success-light) px-4 py-3"
      >
        <CheckCircleIcon className="h-5 w-5 text-(--color-success)" />
        <p className="text-sm text-(--color-text)">
          <span className="font-semibold">All clear.</span>{' '}
          <span className="text-(--color-text-muted)">No breakdowns, overdue orders, stock shortages or pending inspections.</span>
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div variants={staggerItem} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const body = (
          <>
            <span className={['flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', ATTENTION_TONE[item.tone]].join(' ')}>
              <item.icon className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-(--color-text)">{item.title}</span>
              <span className="block truncate text-xs text-(--color-text-muted)">{item.detail}</span>
            </span>
            {item.to && <ArrowRightIcon className="h-4 w-4 shrink-0 text-(--color-text-subtle) transition-transform group-hover:translate-x-0.5 group-hover:text-(--color-text-muted)" />}
          </>
        );
        const cls = 'group flex items-center gap-3 rounded-xl border border-(--color-border) bg-white px-3.5 py-3 shadow-2xs';
        return item.to ? (
          <Link key={item.key} to={item.to} className={[cls, 'transition-shadow hover:shadow-sm'].join(' ')}>
            {body}
          </Link>
        ) : (
          <div key={item.key} className={cls}>{body}</div>
        );
      })}
    </motion.div>
  );
}

// ─── Machine floor ────────────────────────────────────────────────────────────

export function MachineFloorPanel({ machines, canOpenFloor }: { machines: DashboardData['machines']; canOpenFloor: boolean }) {
  return (
    <Panel
      title="Machine floor"
      icon={WrenchScrewdriverIcon}
      subtitle={`${machines.running} of ${machines.total} running · ${machines.utilizationRate}% utilisation`}
      action={canOpenFloor ? { label: 'Floor board', to: '/floor' } : null}
    >
      {machines.total === 0 ? (
        <p className="py-6 text-center text-sm text-(--color-text-muted)">No machines registered yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {machines.byStage.map((s) => (
            <div key={s.stage}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">
                  <span className="h-2 w-2 rounded-sm" style={{ background: STAGE_META[s.stage].color }} />
                  {STAGE_META[s.stage].label}
                </span>
                <span className="text-xs tabular-nums text-(--color-text-muted)">
                  <span className="font-semibold text-(--color-text)">{s.metresToday.toLocaleString('en-IN')} m</span> today
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {s.machines.length === 0 && <span className="text-xs text-(--color-text-subtle)">No machines</span>}
                {s.machines.map((m) => {
                  const meta = MACHINE_STATUS_META[m.status];
                  return (
                    <span
                      key={m.id}
                      title={`${m.name} — ${meta.label}`}
                      className={['inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium text-(--color-text)', meta.chip].join(' ')}
                    >
                      <span className={['h-1.5 w-1.5 rounded-full', meta.dot, m.status === 'RUNNING' ? 'animate-pulse-subtle' : ''].join(' ')} />
                      {m.code}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-3 border-t border-(--color-border) pt-3">
            {(['RUNNING', 'IDLE', 'BREAKDOWN'] as MachineStatus[]).map((st) => (
              <span key={st} className="flex items-center gap-1.5 text-xs text-(--color-text-muted)">
                <span className={['h-1.5 w-1.5 rounded-full', MACHINE_STATUS_META[st].dot].join(' ')} />
                {MACHINE_STATUS_META[st].label}
                <span className="font-semibold tabular-nums text-(--color-text)">
                  {st === 'RUNNING' ? machines.running : st === 'IDLE' ? machines.idle : machines.breakdown}
                </span>
              </span>
            ))}
          </div>

          {machines.breakdowns.length > 0 && (
            <ul className="flex flex-col gap-2">
              {machines.breakdowns.map((b) => (
                <li key={b.id} className="rounded-lg border border-(--color-danger-border) bg-(--color-danger-light) px-3 py-2">
                  <p className="text-xs font-semibold text-(--color-text)">
                    {b.code} · {b.name}
                    {b.since && <span className="font-normal text-(--color-text-muted)"> · down {formatRelative(b.since)}</span>}
                  </p>
                  {(b.note || b.assignedTo) && (
                    <p className="mt-0.5 text-xs text-(--color-text-muted)">
                      {[b.note, b.assignedTo && `Operator: ${b.assignedTo}`].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

// ─── Orders: pipeline + deadlines ─────────────────────────────────────────────

const PIPELINE: OrderClientStatus[] = ['PENDING', 'IN_PRODUCTION', 'QC', 'READY', 'DISPATCHED', 'COMPLETED'];

export function OrderPipeline({ counts }: { counts: DashboardData['ordersByStatus'] }) {
  const byStatus = new Map(counts.map((c) => [c.status, c.count]));
  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-(--color-border) bg-(--color-border) sm:grid-cols-6">
      {PIPELINE.map((status, i) => {
        const count = byStatus.get(status) ?? 0;
        const meta = ORDER_STATUS_META[status];
        return (
          <Link
            key={status}
            to="/orders"
            className="group relative flex flex-col gap-0.5 bg-white px-3 py-2.5 transition-colors hover:bg-(--color-surface-alt)"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-(--color-text-subtle)">Step {i + 1}</span>
            <span className={['text-xl font-bold tabular-nums', count ? 'text-(--color-text)' : 'text-(--color-text-subtle)'].join(' ')}>
              {count}
            </span>
            <span className="truncate text-xs text-(--color-text-muted)">{meta.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

function deadlineBadge(daysLeft: number) {
  if (daysLeft < 0) return <Badge variant="danger" dot label={`${Math.abs(daysLeft)}d overdue`} />;
  if (daysLeft === 0) return <Badge variant="danger" dot label="Due today" />;
  if (daysLeft <= 3) return <Badge variant="warning" dot label={`${daysLeft}d left`} />;
  if (daysLeft <= 7) return <Badge variant="info" label={`${daysLeft}d left`} />;
  return <Badge variant="neutral" label={`${daysLeft}d left`} />;
}

export function OrderDeadlinesPanel({ orders }: { orders: DashboardData['orders'] }) {
  const navigate = useNavigate();
  return (
    <Panel
      title="Order book"
      icon={ClipboardDocumentCheckIcon}
      subtitle={`${orders.active} active · ${orders.activeMetres.toLocaleString('en-IN')} m · sorted by deadline`}
      action={{ label: 'All orders', to: '/orders' }}
    >
      {orders.upcoming.length === 0 ? (
        <p className="py-8 text-center text-sm text-(--color-text-muted)">No open orders. New orders will appear here.</p>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-y border-(--color-border) bg-(--color-bg) text-left text-[11px] uppercase tracking-wide text-(--color-text-muted)">
                <th className="px-5 py-2 font-semibold">Order</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold w-[30%]">Progress</th>
                <th className="px-5 py-2 text-right font-semibold">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {orders.upcoming.map((o) => {
                const tone = o.daysLeft < 0 ? 'danger' : o.daysLeft <= 3 && o.progressPercent < 75 ? 'warning' : o.progressPercent >= 100 ? 'success' : 'accent';
                return (
                  <tr
                    key={o.id}
                    onClick={() => navigate(`/orders/${o.id}`)}
                    className="cursor-pointer border-b border-(--color-border) last:border-0 hover:bg-(--color-surface-alt)"
                  >
                    <td className="px-5 py-2.5">
                      <p className="font-mono text-xs font-semibold text-(--color-text)">{o.orderNo}</p>
                      <p className="max-w-[220px] truncate text-xs text-(--color-text-muted)">
                        {o.buyerName} · {o.fabricType}, {o.colour} · {o.metres.toLocaleString('en-IN')} m
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={ORDER_STATUS_META[o.status].variant} label={ORDER_STATUS_META[o.status].label} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <ProgressBar value={o.progressPercent} tone={tone} />
                        </div>
                        <span className="w-9 text-right text-xs font-semibold tabular-nums text-(--color-text)">{o.progressPercent}%</span>
                      </div>
                      <p
                        className="mt-1 text-[11px] tabular-nums text-(--color-text-subtle)"
                        title="Metres logged per stage, then dispatched"
                      >
                        {STAGE_ORDER.map((s) => `${STAGE_META[s].label[0]} ${Math.round(o.stageMetres[s])}`).join(' · ')} · Disp {Math.round(o.dispatchedMetres)}
                      </p>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <div className="flex flex-col items-end gap-1">
                        {deadlineBadge(o.daysLeft)}
                        <span className="text-[11px] text-(--color-text-subtle)">{formatDate(o.deadline)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ─── Quality ──────────────────────────────────────────────────────────────────

const DEFECT_LABEL: Record<string, string> = {
  HOLE: 'Hole',
  COLOUR_MISMATCH: 'Colour mismatch',
  UNEVEN_WEAVE: 'Uneven weave',
  OTHER: 'Other',
};

export function QualityPanel({ quality, canOpenQc }: { quality: DashboardData['quality']; canOpenQc: boolean }) {
  const { inspected, pass, rework, reject, passRate } = quality.last7Days;
  const segments = [
    { key: 'pass', label: 'Passed', value: pass, cls: 'bg-(--color-success)' },
    { key: 'rework', label: 'Rework', value: rework, cls: 'bg-(--color-warning)' },
    { key: 'reject', label: 'Rejected', value: reject, cls: 'bg-(--color-danger)' },
  ];
  const maxDefect = Math.max(1, ...quality.defects.map((d) => d.count));

  return (
    <Panel
      title="Quality"
      icon={BeakerIcon}
      subtitle="Inspections over the last 7 days"
      action={canOpenQc ? { label: 'QC queue', to: '/qc' } : null}
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-bold text-(--color-text)">{passRate == null ? '—' : `${passRate}%`}</p>
          <p className="text-xs text-(--color-text-muted)">first-pass yield · {inspected} roll{inspected === 1 ? '' : 's'} inspected</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums text-(--color-text)">{quality.awaitingRolls}</p>
          <p className="text-xs text-(--color-text-muted)">awaiting QC</p>
        </div>
      </div>

      {inspected > 0 && (
        <>
          <div className="mt-4 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
            {segments.filter((s) => s.value > 0).map((s) => (
              <div key={s.key} className={s.cls} style={{ width: `${(s.value / inspected) * 100}%` }} title={`${s.label}: ${s.value}`} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {segments.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 text-xs text-(--color-text-muted)">
                <span className={['h-2 w-2 rounded-full', s.cls].join(' ')} />
                {s.label} <span className="font-semibold tabular-nums text-(--color-text)">{s.value}</span>
              </span>
            ))}
          </div>
        </>
      )}

      <div className="mt-4 border-t border-(--color-border) pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">Defects found</p>
        {quality.defects.length === 0 ? (
          <p className="text-xs text-(--color-text-subtle)">No defects recorded this week.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {quality.defects.map((d) => (
              <li key={d.type} className="grid grid-cols-[110px_1fr_auto] items-center gap-2 text-xs">
                <span className="truncate text-(--color-text-muted)">{DEFECT_LABEL[d.type] ?? d.type}</span>
                <span className="h-1.5 rounded-full bg-(--color-surface-sunken)">
                  <span className="block h-full rounded-full bg-(--color-text-dark)" style={{ width: `${(d.count / maxDefect) * 100}%` }} />
                </span>
                <span className="font-semibold tabular-nums text-(--color-text)">{d.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

// ─── Yarn stock ───────────────────────────────────────────────────────────────

export function StockPanel({ stock }: { stock: DashboardData['stock'] }) {
  return (
    <Panel
      title="Yarn stock"
      icon={CubeIcon}
      subtitle={`${stock.totalOnHandKg.toLocaleString('en-IN', { maximumFractionDigits: 0 })} kg on hand across ${stock.yarnTypes} yarn types`}
      action={{ label: 'Stock', to: '/stock' }}
    >
      {stock.lowStock.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg bg-(--color-success-light) px-3 py-2.5 text-xs text-(--color-text)">
          <CheckCircleIcon className="h-4 w-4 text-(--color-success)" />
          Every yarn is above its reorder level after reservations.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {stock.lowStock.slice(0, 5).map((y) => {
            const pct = y.reorderLevelKg > 0 ? Math.min(100, Math.round((y.availableKg / y.reorderLevelKg) * 100)) : 0;
            return (
              <li key={y.id}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate">
                    <span className="font-mono font-semibold text-(--color-text)">{y.code}</span>
                    <span className="text-(--color-text-muted)"> · {y.name}</span>
                  </span>
                  {y.shortfallKg > 0 ? (
                    <Badge variant="danger" dot label={`Short ${y.shortfallKg.toLocaleString('en-IN')} kg`} />
                  ) : (
                    <span className="shrink-0 tabular-nums text-(--color-text-muted)">
                      <span className="font-semibold text-(--color-text)">{y.availableKg.toLocaleString('en-IN')}</span> / {y.reorderLevelKg.toLocaleString('en-IN')} kg
                    </span>
                  )}
                </div>
                <ProgressBar value={pct} tone={y.shortfallKg > 0 ? 'danger' : 'warning'} />
              </li>
            );
          })}
          {stock.lowStock.length > 5 && (
            <li className="text-xs text-(--color-text-muted)">+{stock.lowStock.length - 5} more below reorder level</li>
          )}
        </ul>
      )}
    </Panel>
  );
}

// ─── Finance ──────────────────────────────────────────────────────────────────

export function FinancePanel({ finance }: { finance: NonNullable<DashboardData['finance']> }) {
  const collectionRate = finance.invoicedThisMonth > 0
    ? Math.min(100, Math.round((finance.collectedThisMonth / finance.invoicedThisMonth) * 100))
    : null;
  const maxRecv = Math.max(1, ...finance.topReceivables.map((r) => r.amount));
  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long' });

  return (
    <Panel title="Money" icon={BanknotesIcon} subtitle={`${monthName} to date`} action={{ label: 'Month-end', to: '/reports/month-end' }}>
      <div className="rounded-lg bg-(--color-surface-alt) p-3">
        <p className="text-xs text-(--color-text-muted)">Outstanding receivables</p>
        <p className="text-2xl font-bold text-(--color-text)">{formatCurrency(finance.outstanding)}</p>
        <p className="text-xs text-(--color-text-muted)">
          across {finance.unpaidInvoices} unpaid invoice{finance.unpaidInvoices === 1 ? '' : 's'}
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {[
          { label: 'Invoiced', value: finance.invoicedThisMonth },
          { label: 'Collected', value: finance.collectedThisMonth },
          { label: 'Yarn bought', value: finance.purchasesThisMonth },
        ].map((m) => (
          <div key={m.label} className="min-w-0">
            <dt className="text-(--color-text-muted)">{m.label}</dt>
            <dd className="truncate font-semibold tabular-nums text-(--color-text)" title={formatCurrency(m.value)}>
              {formatCurrency(m.value).replace(/\.00$/, '')}
            </dd>
          </div>
        ))}
      </dl>

      {collectionRate != null && (
        <div className="mt-3">
          <ProgressBar
            value={collectionRate}
            tone={collectionRate >= 80 ? 'success' : collectionRate >= 50 ? 'warning' : 'danger'}
            label={<span>Collected <span className="font-semibold text-(--color-text)">{collectionRate}%</span> of this month's invoices</span>}
          />
        </div>
      )}

      {finance.topReceivables.length > 0 && (
        <div className="mt-4 border-t border-(--color-border) pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">Who owes the most</p>
          <ul className="flex flex-col gap-1.5">
            {finance.topReceivables.map((r) => (
              <li key={r.buyerName} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 text-xs">
                <span className="truncate text-(--color-text)">{r.buyerName}</span>
                <span className="font-semibold tabular-nums text-(--color-text)">{formatCurrency(r.amount)}</span>
                <span className="col-span-2 h-1 rounded-full bg-(--color-surface-sunken)">
                  <span className="block h-full rounded-full bg-(--color-text-dark)" style={{ width: `${(r.amount / maxRecv) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

// ─── Activity feed ────────────────────────────────────────────────────────────

const ACTIVITY_ICON: Record<ActivityType, React.ElementType> = {
  PRODUCTION: WrenchScrewdriverIcon,
  QC: BeakerIcon,
  DISPATCH: TruckIcon,
  RECEIPT: ArrowDownTrayIcon,
  PAYMENT: BanknotesIcon,
};

const ACTIVITY_TONE: Record<DashboardActivity['tone'], string> = {
  neutral: 'bg-(--color-surface-sunken) text-(--color-text-muted)',
  info:    'bg-(--color-info-light) text-(--color-info)',
  success: 'bg-(--color-success-light) text-(--color-success)',
  warning: 'bg-(--color-warning-light) text-(--color-warning)',
  danger:  'bg-(--color-danger-light) text-(--color-danger)',
};

export function ActivityPanel({ activity, canAccess }: { activity: DashboardActivity[]; canAccess: (path: string) => boolean }) {
  return (
    <Panel title="Recent activity" subtitle="Latest events across the mill">
      {activity.length === 0 ? (
        <p className="py-6 text-center text-sm text-(--color-text-muted)">Nothing has happened yet.</p>
      ) : (
        <ol className="relative flex flex-col">
          {activity.map((a, i) => {
            const Icon = ACTIVITY_ICON[a.type];
            const content = (
              <>
                <span className={['relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-white', ACTIVITY_TONE[a.tone]].join(' ')}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 pb-3.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-(--color-text)">{a.title}</span>
                    <time className="shrink-0 text-[11px] text-(--color-text-subtle)" dateTime={a.at} title={new Date(a.at).toLocaleString('en-IN')}>
                      {formatRelative(a.at)}
                    </time>
                  </span>
                  <span className="block truncate text-xs text-(--color-text-muted)">{a.detail}</span>
                </span>
              </>
            );
            const href = a.href && canAccess(a.href.replace(/\/[0-9a-f-]{36}$/, '/:id')) ? a.href : undefined;
            return (
              <li key={`${a.type}-${a.at}-${i}`} className="relative flex gap-3">
                {i < activity.length - 1 && <span className="absolute left-3.5 top-7 bottom-0 w-px bg-(--color-border)" aria-hidden />}
                {href ? (
                  <Link to={href} className="-mx-1.5 flex min-w-0 flex-1 gap-3 rounded-md px-1.5 hover:bg-(--color-surface-alt)">{content}</Link>
                ) : (
                  <div className="flex min-w-0 flex-1 gap-3">{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
