import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  BanknotesIcon,
  BeakerIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  CpuChipIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ShoppingBagIcon,
  SwatchIcon,
  TruckIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import { useAuth, type Role } from '../../lib/auth';
import { ApiError } from '../../lib/api';
import { usePolling } from '../../lib/usePolling';
import { formatCompact, formatCurrency, formatDate, formatRelative } from '../../lib/format';
import { staggerContainer, staggerItem } from '../../lib/motion';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/ErrorState';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/Skeleton';
import { StatCard, StatGrid } from '../../components/ui/StatCard';
import { getBoard, type FloorBoardResponse } from '../floor/floor.api';
import {
  getDashboard,
  type ActivityType,
  type DashboardActivity,
  type DashboardData,
  type MachineStatus,
  type OrderClientStatus,
  type Stage,
} from './reports.api';

// ═════════════════════════════════════════════════════════════════════════════
// Config
// ═════════════════════════════════════════════════════════════════════════════

const REFRESH_MS = 60_000;

// Chart colours. Recharts paints SVG presentation attributes, so these are plain
// hex: stage colours are the validated categorical palette, status colours mirror index.css.
const C = {
  spinning: '#2a78d6',
  weaving: '#eb6834',
  dyeing: '#1baf7a',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  idle: '#C9C3BC',
  ink: '#44403C',
  muted: '#A8A29E',
  grid: '#EDEAE6',
  axis: '#D6D1CB',
  hover: '#F5F4F2',
};

const STAGE_ORDER: Stage[] = ['SPINNING', 'WEAVING', 'DYEING'];
const STAGE_META: Record<Stage, { label: string; color: string }> = {
  SPINNING: { label: 'Spinning', color: C.spinning },
  WEAVING: { label: 'Weaving', color: C.weaving },
  DYEING: { label: 'Dyeing', color: C.dyeing },
};

const MACHINE_STATUS_META: Record<MachineStatus, { label: string; color: string; chip: string }> = {
  RUNNING: { label: 'Running', color: C.success, chip: 'border-(--color-success-border) bg-(--color-success-light)' },
  IDLE: { label: 'Idle', color: C.idle, chip: 'border-(--color-border) bg-(--color-surface-alt)' },
  BREAKDOWN: { label: 'Breakdown', color: C.danger, chip: 'border-(--color-danger-border) bg-(--color-danger-light)' },
};

const ORDER_STATUS_META: Record<OrderClientStatus, { label: string; variant: 'neutral' | 'warning' | 'info' | 'success' | 'danger' }> = {
  PENDING: { label: 'Pending', variant: 'neutral' },
  IN_PRODUCTION: { label: 'In production', variant: 'info' },
  QC: { label: 'In QC', variant: 'warning' },
  READY: { label: 'Ready to dispatch', variant: 'success' },
  DISPATCHED: { label: 'Part dispatched', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'neutral' },
};
const PIPELINE: OrderClientStatus[] = ['PENDING', 'IN_PRODUCTION', 'QC', 'READY', 'DISPATCHED', 'COMPLETED'];

const DEFECT_LABEL: Record<string, string> = {
  HOLE: 'Hole',
  COLOUR_MISMATCH: 'Colour mismatch',
  UNEVEN_WEAVE: 'Uneven weave',
  OTHER: 'Other',
};

// Mirrors the role lists in routes.tsx for the pages the dashboard links to
// (routes.tsx imports this page, so importing ROUTES here would be circular).
const PAGE_ROLES: Record<string, Role[] | 'all'> = {
  '/orders': 'all',
  '/orders/new': 'all',
  '/orders/:id': 'all',
  '/stock': 'all',
  '/floor': ['OWNER', 'SUPERVISOR', 'STAFF'],
  '/floor/log': ['OWNER', 'SUPERVISOR'],
  '/qc': ['OWNER', 'SUPERVISOR'],
  '/dispatch': ['OWNER', 'SUPERVISOR'],
  '/invoices/:id': ['OWNER', 'OFFICE', 'SUPERVISOR'],
  '/attendance': ['OWNER', 'OFFICE', 'SUPERVISOR'],
  '/reports/month-end': ['OWNER'],
};

const QUICK_ACTIONS = [
  { label: 'New order', to: '/orders/new', icon: PlusIcon, primary: true },
  { label: 'Log production', to: '/floor/log', icon: ClipboardDocumentListIcon },
  { label: 'Inspect rolls', to: '/qc', icon: BeakerIcon },
  { label: 'Dispatch', to: '/dispatch', icon: TruckIcon },
];

type CanAccess = (path: string) => boolean;

// ═════════════════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════════════════

type Snapshot = { kind: 'manager'; data: DashboardData } | { kind: 'staff'; board: FloorBoardResponse };

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role as Role | undefined;
  const isStaff = role === 'STAFF';

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const canAccess = useCallback<CanAccess>(
    (path) => {
      const roles = PAGE_ROLES[path];
      return roles === 'all' || (!!role && !!roles && roles.includes(role));
    },
    [role]
  );

  const load = useCallback(
    async (force = false) => {
      // Skip background refreshes while the tab is hidden; always honour a manual refresh.
      if (inFlight.current || (!force && document.hidden && snapshot)) return;
      inFlight.current = true;
      setRefreshing(true);
      try {
        setSnapshot(isStaff ? { kind: 'staff', board: await getBoard() } : { kind: 'manager', data: await getDashboard() });
        setError(null);
      } catch (err) {
        setError(err instanceof ApiError ? err : new ApiError('UNKNOWN_ERROR', String(err)));
      } finally {
        inFlight.current = false;
        setRefreshing(false);
      }
    },
    [isStaff, snapshot]
  );

  usePolling(() => void load(), REFRESH_MS);

  const data = snapshot?.kind === 'manager' ? snapshot.data : null;
  const updatedAt = data?.generatedAt ?? (snapshot ? new Date().toISOString() : null);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex flex-col gap-6 page-content">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-(--color-accent)">{today}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-(--color-text)">
            Good {getGreeting()}, {user?.name?.split(' ')[0]}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-(--color-text-muted)">
            {isStaff ? 'Your machines at a glance.' : "Here's what's happening at the mill right now."}
            {updatedAt && (
              <span className="inline-flex items-center gap-1.5 text-xs text-(--color-text-subtle)">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-(--color-success) opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-(--color-success)" />
                </span>
                Live · updated {new Date(updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isStaff &&
            QUICK_ACTIONS.filter((a) => canAccess(a.to)).map((a) => (
              <Button key={a.to} size="sm" variant={a.primary ? 'primary' : 'secondary'} onClick={() => navigate(a.to)}>
                <a.icon className="h-4 w-4" />
                {a.label}
              </Button>
            ))}
          <Button size="sm" variant="ghost" onClick={() => void load(true)} disabled={refreshing} aria-label="Refresh dashboard">
            <ArrowPathIcon className={['h-4 w-4', refreshing ? 'animate-spin' : ''].join(' ')} />
          </Button>
        </div>
      </div>

      {error && !snapshot && <ErrorState code={error.code} message={error.message} onRetry={() => void load(true)} />}
      {error && snapshot && (
        <p className="rounded-lg border border-(--color-warning-border) bg-(--color-warning-light) px-3 py-2 text-xs text-(--color-text)">
          Couldn't refresh just now ({error.message}). Showing the last snapshot.
        </p>
      )}
      {!snapshot && !error && <DashboardSkeleton />}
      {snapshot?.kind === 'staff' && <StaffHome board={snapshot.board} />}
      {data && <ManagerDashboard data={data} canAccess={canAccess} />}
    </div>
  );
}

function ManagerDashboard({ data, canAccess }: { data: DashboardData; canAccess: CanAccess }) {
  const attention = useMemo(() => buildAttentionItems(data, canAccess), [data, canAccess]);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col gap-6">
      <AttentionStrip items={attention} />
      <KpiRow data={data} />

      <div className="grid gap-6 xl:grid-cols-3">
        <ProductionPanel production={data.production} className="xl:col-span-2" />
        <MachineFloorPanel machines={data.machines} canOpenFloor={canAccess('/floor')} />
      </div>

      <div className="flex flex-col gap-3">
        <OrderPipeline counts={data.ordersByStatus} />
        <OrderBookPanel orders={data.orders} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <QualityPanel quality={data.quality} canOpenQc={canAccess('/qc')} />
        <StockPanel stock={data.stock} />
        {data.finance ? <FinancePanel finance={data.finance} canAccess={canAccess} /> : <ActivityPanel activity={data.activity} canAccess={canAccess} />}
      </div>
      {data.finance && <ActivityPanel activity={data.activity} canAccess={canAccess} />}
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Shared building blocks
// ═════════════════════════════════════════════════════════════════════════════

interface PanelProps {
  title: string;
  icon?: React.ElementType;
  subtitle?: ReactNode;
  action?: { label: string; to: string } | null;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
}

function Panel({ title, icon: Icon, subtitle, action, headerRight, children, className = '' }: PanelProps) {
  return (
    <motion.section
      variants={staggerItem}
      className={['flex min-w-0 flex-col rounded-xl border border-(--color-border) bg-white shadow-2xs', className].join(' ')}
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

/** Tooltip card shared by every Recharts chart on the page. */
function ChartTooltipCard({ title, rows, total }: { title: string; rows: { label: string; value: string; color?: string }[]; total?: string }) {
  return (
    <div className="min-w-40 rounded-lg border border-(--color-border) bg-white p-2.5 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-(--color-text)">{title}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-(--color-text-muted)">
            {r.color && <span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="tabular-nums text-(--color-text)">{r.value}</span>
        </div>
      ))}
      {total && (
        <div className="mt-1 flex items-center justify-between border-t border-(--color-border) pt-1">
          <span className="font-medium text-(--color-text-muted)">Total</span>
          <span className="font-semibold tabular-nums text-(--color-text)">{total}</span>
        </div>
      )}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string; value?: ReactNode }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-xs text-(--color-text-muted)">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
          {i.value != null && <span className="font-semibold tabular-nums text-(--color-text)">{i.value}</span>}
        </span>
      ))}
    </div>
  );
}

/** Donut with a headline figure in the hole. */
function Donut({
  data,
  center,
  caption,
  size = 132,
  tooltipTitle,
  unit = '',
}: {
  data: { name: string; value: number; color: string }[];
  center: string;
  caption: string;
  size?: number;
  tooltipTitle: string;
  unit?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const slices = total > 0 ? data.filter((d) => d.value > 0) : [{ name: 'None', value: 1, color: C.grid }];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius="70%"
            outerRadius="100%"
            paddingAngle={slices.length > 1 ? 2 : 0}
            stroke="none"
            startAngle={90}
            endAngle={-270}
            isAnimationActive
          >
            {slices.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
          {total > 0 && (
            <Tooltip
              wrapperStyle={{ zIndex: 20 }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <ChartTooltipCard
                    title={tooltipTitle}
                    rows={[
                      {
                        label: String(payload[0].name),
                        value: `${payload[0].value}${unit} · ${Math.round((Number(payload[0].value) / total) * 100)}%`,
                        color: (payload[0].payload as { color: string }).color,
                      },
                    ]}
                  />
                ) : null
              }
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="max-w-[90%] whitespace-nowrap text-center text-lg font-bold leading-none tracking-tight text-(--color-text)">
          {center}
        </span>
        <span className="text-[11px] text-(--color-text-muted)">{caption}</span>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Needs attention + KPIs
// ═════════════════════════════════════════════════════════════════════════════

interface AttentionItem {
  key: string;
  tone: 'danger' | 'warning' | 'info' | 'success';
  icon: React.ElementType;
  title: string;
  detail: string;
  to?: string;
}

const ATTENTION_TONE: Record<AttentionItem['tone'], string> = {
  danger: 'border-(--color-danger-border) bg-(--color-danger-light) text-(--color-danger)',
  warning: 'border-(--color-warning-border) bg-(--color-warning-light) text-(--color-warning)',
  info: 'border-(--color-info-border) bg-(--color-info-light) text-(--color-info)',
  success: 'border-(--color-success-border) bg-(--color-success-light) text-(--color-success)',
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function buildAttentionItems(d: DashboardData, canAccess: CanAccess): AttentionItem[] {
  const items: AttentionItem[] = [];
  const link = (path: string) => (canAccess(path) ? path : undefined);

  if (d.machines.breakdown > 0) {
    items.push({
      key: 'breakdown',
      tone: 'danger',
      icon: WrenchScrewdriverIcon,
      title: `${plural(d.machines.breakdown, 'machine')} down`,
      detail: d.machines.breakdowns.map((m) => m.code).join(', '),
      to: link('/floor'),
    });
  }
  if (d.orders.overdue > 0) {
    items.push({
      key: 'overdue',
      tone: 'danger',
      icon: ExclamationTriangleIcon,
      title: `${plural(d.orders.overdue, 'order')} past deadline`,
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
      title: `${plural(d.stock.lowStock.length, 'yarn')} below reorder level`,
      detail: short > 0 ? `${short} short for booked orders` : d.stock.lowStock.slice(0, 3).map((y) => y.code).join(', '),
      to: link('/stock'),
    });
  }
  if (d.quality.awaitingRolls > 0) {
    items.push({
      key: 'qc',
      tone: 'warning',
      icon: BeakerIcon,
      title: `${plural(d.quality.awaitingRolls, 'roll')} awaiting QC`,
      detail: `${d.quality.awaitingMetres.toLocaleString('en-IN')} m to inspect`,
      to: link('/qc'),
    });
  }
  if (d.orders.dueThisWeek > 0) {
    items.push({
      key: 'due',
      tone: 'info',
      icon: ClipboardDocumentCheckIcon,
      title: `${plural(d.orders.dueThisWeek, 'order')} due within 7 days`,
      detail: `${d.orders.activeMetres.toLocaleString('en-IN')} m in the active book`,
      to: link('/orders'),
    });
  }
  if (d.finishedGoods.readyRolls > 0) {
    items.push({
      key: 'ready',
      tone: 'success',
      icon: TruckIcon,
      title: `${plural(d.finishedGoods.readyRolls, 'roll')} ready to dispatch`,
      detail: `${d.finishedGoods.readyMetres.toLocaleString('en-IN')} m passed QC`,
      to: link('/dispatch'),
    });
  }
  return items;
}

function AttentionStrip({ items }: { items: AttentionItem[] }) {
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
            {item.to && (
              <ArrowRightIcon className="h-4 w-4 shrink-0 text-(--color-text-subtle) transition-transform group-hover:translate-x-0.5 group-hover:text-(--color-text-muted)" />
            )}
          </>
        );
        const cls = 'group flex items-center gap-3 rounded-xl border border-(--color-border) bg-white px-3.5 py-3 shadow-2xs';
        return item.to ? (
          <Link key={item.key} to={item.to} className={[cls, 'transition-shadow hover:shadow-sm'].join(' ')}>
            {body}
          </Link>
        ) : (
          <div key={item.key} className={cls}>
            {body}
          </div>
        );
      })}
    </motion.div>
  );
}

function pctChange(current: number, previous: number): string | null {
  if (previous <= 0) return current > 0 ? 'new vs yesterday' : null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs yesterday`;
}

function KpiRow({ data }: { data: DashboardData }) {
  const { production, machines, orders, quality, finishedGoods, workforce } = data;
  return (
    <StatGrid columns={6}>
      <StatCard
        icon={SwatchIcon}
        label="Metres today"
        value={`${production.today.toLocaleString('en-IN')} m`}
        sub={pctChange(production.today, production.yesterday) ?? `${production.last7Days.toLocaleString('en-IN')} m this week`}
        tone="accent"
      />
      <StatCard
        icon={CpuChipIcon}
        label="Utilisation"
        value={`${machines.utilizationRate}%`}
        sub={`${machines.running}/${machines.total} running${machines.breakdown ? ` · ${machines.breakdown} down` : ''}`}
        tone={machines.breakdown ? 'danger' : 'success'}
        live={machines.running > 0}
      />
      <StatCard
        icon={ShoppingBagIcon}
        label="Active orders"
        value={orders.active}
        sub={orders.overdue ? `${orders.overdue} overdue · ${orders.dueThisWeek} due this week` : `${orders.dueThisWeek} due this week`}
        tone={orders.overdue ? 'danger' : 'info'}
      />
      <StatCard
        icon={BeakerIcon}
        label="QC pass rate"
        value={quality.last7Days.passRate == null ? '—' : `${quality.last7Days.passRate}%`}
        sub={`${plural(quality.awaitingRolls, 'roll')} awaiting · 7 days`}
        tone={quality.last7Days.passRate != null && quality.last7Days.passRate < 90 ? 'warning' : 'success'}
      />
      <StatCard
        icon={TruckIcon}
        label="Ready to ship"
        value={`${finishedGoods.readyMetres.toLocaleString('en-IN')} m`}
        sub={`${plural(finishedGoods.readyRolls, 'roll')} passed QC`}
        tone="neutral"
      />
      <StatCard
        icon={UserGroupIcon}
        label="Staff present"
        value={workforce.markedToday ? `${workforce.presentToday}/${workforce.totalStaff}` : '—'}
        sub={workforce.markedToday ? `${workforce.absentToday} absent today` : 'Attendance not marked yet'}
        tone={workforce.markedToday ? 'neutral' : 'warning'}
      />
    </StatGrid>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Production (Recharts stacked bars)
// ═════════════════════════════════════════════════════════════════════════════

function dayLabel(date: string, isToday = false) {
  if (isToday) return 'Today';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function ProductionPanel({ production, className }: { production: DashboardData['production']; className?: string }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const last = production.trend[production.trend.length - 1]?.date;
  const totals = useMemo(() => {
    const t = { SPINNING: 0, WEAVING: 0, DYEING: 0 } as Record<Stage, number>;
    production.trend.forEach((d) => STAGE_ORDER.forEach((s) => (t[s] += d[s])));
    return t;
  }, [production.trend]);
  const hasData = production.trend.some((d) => d.total > 0);

  return (
    <Panel
      className={className}
      title="Production, last 14 days"
      icon={ChartBarIcon}
      subtitle={
        <>
          {production.last7Days.toLocaleString('en-IN')} m this week vs {production.prev7Days.toLocaleString('en-IN')} m the week before · today by shift:{' '}
          {(['MORNING', 'EVENING', 'NIGHT'] as const)
            .map((s) => `${s[0]}${s.slice(1).toLowerCase()} ${production.byShiftToday[s].toLocaleString('en-IN')} m`)
            .join(', ')}
        </>
      }
      headerRight={
        <SegmentedControl
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: 'chart', label: 'Chart' },
            { value: 'table', label: 'Table' },
          ]}
        />
      }
    >
      <div className="mb-3">
        <Legend
          items={STAGE_ORDER.map((s) => ({
            label: STAGE_META[s].label,
            color: STAGE_META[s].color,
            value: `${Math.round(totals[s]).toLocaleString('en-IN')} m`,
          }))}
        />
      </div>

      {view === 'table' ? (
        <div className="max-h-[240px] overflow-auto rounded-lg border border-(--color-border)">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-(--color-bg) text-xs uppercase tracking-wide text-(--color-text-muted)">
                <th className="px-3 py-2 text-left font-semibold">Day</th>
                {STAGE_ORDER.map((s) => (
                  <th key={s} className="px-3 py-2 text-right font-semibold">{STAGE_META[s].label}</th>
                ))}
                <th className="px-3 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {[...production.trend].reverse().map((d) => (
                <tr key={d.date} className="border-t border-(--color-border)">
                  <td className="px-3 py-1.5 text-(--color-text)">{dayLabel(d.date, d.date === last)}</td>
                  {STAGE_ORDER.map((s) => (
                    <td key={s} className="px-3 py-1.5 text-right tabular-nums text-(--color-text-muted)">{d[s].toLocaleString('en-IN')}</td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-(--color-text)">{d.total.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={production.trend} margin={{ top: 8, right: 4, bottom: 0, left: -8 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => dayLabel(d, d === last)}
                tick={{ fontSize: 11, fill: C.muted }}
                tickLine={false}
                axisLine={{ stroke: C.axis }}
                minTickGap={12}
              />
              <YAxis
                tickFormatter={(v: number) => formatCompact(v)}
                tick={{ fontSize: 11, fill: C.muted }}
                tickLine={false}
                axisLine={false}
                width={44}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: C.hover, radius: 6 }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <ChartTooltipCard
                      title={new Date(`${label}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                      rows={[...STAGE_ORDER].reverse().map((s) => ({
                        label: STAGE_META[s].label,
                        value: `${Number((payload[0].payload as Record<Stage, number>)[s]).toLocaleString('en-IN')} m`,
                        color: STAGE_META[s].color,
                      }))}
                      total={`${Number((payload[0].payload as { total: number }).total).toLocaleString('en-IN')} m`}
                    />
                  ) : null
                }
              />
              {STAGE_ORDER.map((s, i) => (
                <Bar
                  key={s}
                  dataKey={s}
                  name={STAGE_META[s].label}
                  stackId="metres"
                  fill={STAGE_META[s].color}
                  stroke="#FFFFFF"
                  strokeWidth={1}
                  maxBarSize={28}
                  radius={i === STAGE_ORDER.length - 1 ? [4, 4, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
          {!hasData && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="rounded-md bg-white/90 px-3 py-1.5 text-sm text-(--color-text-muted)">No production logged in the last 14 days</p>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Machine floor (Recharts donut)
// ═════════════════════════════════════════════════════════════════════════════

function MachineFloorPanel({ machines, canOpenFloor }: { machines: DashboardData['machines']; canOpenFloor: boolean }) {
  const statusData = (['RUNNING', 'IDLE', 'BREAKDOWN'] as MachineStatus[]).map((st) => ({
    name: MACHINE_STATUS_META[st].label,
    value: st === 'RUNNING' ? machines.running : st === 'IDLE' ? machines.idle : machines.breakdown,
    color: MACHINE_STATUS_META[st].color,
  }));

  return (
    <Panel
      title="Machine floor"
      icon={WrenchScrewdriverIcon}
      subtitle={`${machines.running} of ${machines.total} running`}
      action={canOpenFloor ? { label: 'Floor board', to: '/floor' } : null}
    >
      {machines.total === 0 ? (
        <p className="py-6 text-center text-sm text-(--color-text-muted)">No machines registered yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-5">
            <Donut data={statusData} center={`${machines.utilizationRate}%`} caption="utilisation" size={120} tooltipTitle="Machines" />
            <ul className="flex flex-1 flex-col gap-1.5">
              {statusData.map((s) => (
                <li key={s.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-(--color-text-muted)">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  <span className="font-semibold tabular-nums text-(--color-text)">{s.value}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3 border-t border-(--color-border) pt-3">
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
                        <span className={['h-1.5 w-1.5 rounded-full', m.status === 'RUNNING' ? 'animate-pulse-subtle' : ''].join(' ')} style={{ background: meta.color }} />
                        {m.code}
                      </span>
                    );
                  })}
                </div>
              </div>
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

// ═════════════════════════════════════════════════════════════════════════════
// Orders
// ═════════════════════════════════════════════════════════════════════════════

function OrderPipeline({ counts }: { counts: DashboardData['ordersByStatus'] }) {
  const byStatus = new Map(counts.map((c) => [c.status, c.count]));
  return (
    <motion.div
      variants={staggerItem}
      className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-(--color-border) bg-(--color-border) sm:grid-cols-6"
    >
      {PIPELINE.map((status, i) => {
        const count = byStatus.get(status) ?? 0;
        return (
          <Link key={status} to="/orders" className="flex flex-col gap-0.5 bg-white px-3 py-2.5 transition-colors hover:bg-(--color-surface-alt)">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-(--color-text-subtle)">Step {i + 1}</span>
            <span className={['text-xl font-bold tabular-nums', count ? 'text-(--color-text)' : 'text-(--color-text-subtle)'].join(' ')}>{count}</span>
            <span className="truncate text-xs text-(--color-text-muted)">{ORDER_STATUS_META[status].label}</span>
          </Link>
        );
      })}
    </motion.div>
  );
}

function deadlineBadge(daysLeft: number) {
  if (daysLeft < 0) return <Badge variant="danger" dot label={`${Math.abs(daysLeft)}d overdue`} />;
  if (daysLeft === 0) return <Badge variant="danger" dot label="Due today" />;
  if (daysLeft <= 3) return <Badge variant="warning" dot label={`${daysLeft}d left`} />;
  if (daysLeft <= 7) return <Badge variant="info" label={`${daysLeft}d left`} />;
  return <Badge variant="neutral" label={`${daysLeft}d left`} />;
}

function OrderBookPanel({ orders }: { orders: DashboardData['orders'] }) {
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
                <th className="w-[30%] px-3 py-2 font-semibold">Progress</th>
                <th className="px-5 py-2 text-right font-semibold">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {orders.upcoming.map((o) => {
                const tone =
                  o.daysLeft < 0 ? 'danger' : o.daysLeft <= 3 && o.progressPercent < 75 ? 'warning' : o.progressPercent >= 100 ? 'success' : 'accent';
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
                      <p className="mt-1 text-[11px] tabular-nums text-(--color-text-subtle)" title="Metres logged per stage, then dispatched">
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

// ═════════════════════════════════════════════════════════════════════════════
// Quality (Recharts donut + horizontal bars)
// ═════════════════════════════════════════════════════════════════════════════

function QualityPanel({ quality, canOpenQc }: { quality: DashboardData['quality']; canOpenQc: boolean }) {
  const { inspected, pass, rework, reject, passRate } = quality.last7Days;
  const results = [
    { name: 'Passed', value: pass, color: C.success },
    { name: 'Rework', value: rework, color: C.warning },
    { name: 'Rejected', value: reject, color: C.danger },
  ];
  const defects = quality.defects.map((d) => ({ name: DEFECT_LABEL[d.type] ?? d.type, count: d.count }));

  return (
    <Panel title="Quality" icon={BeakerIcon} subtitle="Inspections over the last 7 days" action={canOpenQc ? { label: 'QC queue', to: '/qc' } : null}>
      <div className="flex min-w-0 flex-wrap items-center gap-4 sm:flex-nowrap">
        <Donut data={results} center={passRate == null ? '—' : `${passRate}%`} caption="pass rate" tooltipTitle="QC results" unit=" rolls" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {results.map((r) => (
            <div key={r.name} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-(--color-text-muted)">
                <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                {r.name}
              </span>
              <span className="font-semibold tabular-nums text-(--color-text)">{r.value}</span>
            </div>
          ))}
          <p className="mt-1 border-t border-(--color-border) pt-1.5 text-xs text-(--color-text-muted)">
            {plural(inspected, 'roll')} inspected · <span className="font-semibold text-(--color-text)">{quality.awaitingRolls}</span> awaiting
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-(--color-border) pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">Defects found</p>
        {defects.length === 0 ? (
          <p className="text-xs text-(--color-text-subtle)">No defects recorded this week.</p>
        ) : (
          <div className="min-w-0 px-1" style={{ height: Math.max(64, defects.length * 36) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={defects} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 4 }} barCategoryGap={8}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={96} tickMargin={8} tick={{ fontSize: 11, fill: C.ink }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: C.hover }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <ChartTooltipCard title={String((payload[0].payload as { name: string }).name)} rows={[{ label: 'Rolls', value: String(payload[0].value) }]} />
                    ) : null
                  }
                />
                <Bar dataKey="count" fill={C.ink} radius={[0, 4, 4, 0]} maxBarSize={14} label={{ position: 'right', fontSize: 11, fill: C.ink }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Yarn stock
// ═════════════════════════════════════════════════════════════════════════════

function StockPanel({ stock }: { stock: DashboardData['stock'] }) {
  return (
    <Panel
      title="Yarn stock"
      icon={CubeIcon}
      subtitle={`${stock.totalOnHandKg.toLocaleString('en-IN', { maximumFractionDigits: 0 })} kg on hand across ${stock.yarnTypes} yarn types`}
      action={{ label: 'Stock', to: '/stock' }}
    >
      {stock.lowStock.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg bg-(--color-success-light) px-3 py-2.5 text-xs text-(--color-text)">
          <CheckCircleIcon className="h-4 w-4 shrink-0 text-(--color-success)" />
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
          {stock.lowStock.length > 5 && <li className="text-xs text-(--color-text-muted)">+{stock.lowStock.length - 5} more below reorder level</li>}
        </ul>
      )}
    </Panel>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Money (Recharts bars) - OWNER / OFFICE only
// ═════════════════════════════════════════════════════════════════════════════

function FinancePanel({ finance, canAccess }: { finance: NonNullable<DashboardData['finance']>; canAccess?: CanAccess }) {
  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long' });
  const flows = [
    { name: 'Invoiced', value: finance.invoicedThisMonth, color: C.spinning },
    { name: 'Collected', value: finance.collectedThisMonth, color: C.success },
    { name: 'Yarn bought', value: finance.purchasesThisMonth, color: C.weaving },
  ];
  const collectionRate =
    finance.invoicedThisMonth > 0 ? Math.min(100, Math.round((finance.collectedThisMonth / finance.invoicedThisMonth) * 100)) : null;

  return (
    <Panel
      title="Money"
      icon={BanknotesIcon}
      subtitle={`${monthName} to date`}
      action={canAccess?.('/reports/month-end') ? { label: 'Month-end', to: '/reports/month-end' } : null}
    >
      <div className="rounded-lg bg-(--color-surface-alt) p-3">
        <p className="text-xs text-(--color-text-muted)">Outstanding receivables</p>
        <p className="text-2xl font-bold text-(--color-text)">{formatCurrency(finance.outstanding)}</p>
        <p className="text-xs text-(--color-text-muted)">
          across {plural(finance.unpaidInvoices, 'unpaid invoice')}
          {collectionRate != null && <> · {collectionRate}% of this month's invoices collected</>}
        </p>
      </div>

      <div className="mt-3 h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={flows} margin={{ top: 18, right: 4, bottom: 0, left: -8 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={{ stroke: C.axis }} />
            <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} width={44} />
            <Tooltip
              cursor={{ fill: C.hover, radius: 6 }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <ChartTooltipCard
                    title={String((payload[0].payload as { name: string }).name)}
                    rows={[{ label: monthName, value: formatCurrency(Number(payload[0].value)) }]}
                  />
                ) : null
              }
            />
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
              label={{ position: 'top', fontSize: 11, fill: C.ink, formatter: (v: unknown) => `₹${formatCompact(Number(v))}` }}
            >
              {flows.map((f) => (
                <Cell key={f.name} fill={f.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {finance.topReceivables.length > 0 && (
        <div className="mt-3 border-t border-(--color-border) pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">Who owes the most</p>
          <ul className="flex flex-col gap-2.5">
            {finance.topReceivables.map((receivable, index) => {
              const maximumAmount = finance.topReceivables[0]?.amount ?? 0;
              const barWidth = maximumAmount > 0 ? (receivable.amount / maximumAmount) * 100 : 0;
              return (
                <li key={receivable.buyerName} className="min-w-0">
                  <div className="mb-1 flex min-w-0 items-center justify-between gap-3">
                    <span
                      className="min-w-0 truncate text-xs font-medium text-(--color-text)"
                      title={receivable.buyerName}
                    >
                      {index + 1}. {receivable.buyerName}
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-(--color-text)">
                      {formatCurrency(receivable.amount)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-(--color-surface-sunken)">
                    <div
                      className="h-full rounded-full bg-(--color-accent)"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Panel>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Activity feed
// ═════════════════════════════════════════════════════════════════════════════

const ACTIVITY_ICON: Record<ActivityType, React.ElementType> = {
  PRODUCTION: WrenchScrewdriverIcon,
  QC: BeakerIcon,
  DISPATCH: TruckIcon,
  RECEIPT: ArrowDownTrayIcon,
  PAYMENT: BanknotesIcon,
};

const ACTIVITY_TONE: Record<DashboardActivity['tone'], string> = {
  neutral: 'bg-(--color-surface-sunken) text-(--color-text-muted)',
  info: 'bg-(--color-info-light) text-(--color-info)',
  success: 'bg-(--color-success-light) text-(--color-success)',
  warning: 'bg-(--color-warning-light) text-(--color-warning)',
  danger: 'bg-(--color-danger-light) text-(--color-danger)',
};

function ActivityPanel({ activity, canAccess }: { activity: DashboardActivity[]; canAccess: CanAccess }) {
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
            // Map concrete ids back to route patterns for the role check, e.g. /orders/<uuid> -> /orders/:id.
            const href = a.href && canAccess(a.href.replace(/\/[0-9a-f-]{36}$/, '/:id')) ? a.href : undefined;
            return (
              <li key={`${a.type}-${a.at}-${i}`} className="relative flex gap-3">
                {i < activity.length - 1 && <span className="absolute top-7 bottom-0 left-3.5 w-px bg-(--color-border)" aria-hidden />}
                {href ? (
                  <Link to={href} className="-mx-1.5 flex min-w-0 flex-1 gap-3 rounded-md px-1.5 hover:bg-(--color-surface-alt)">
                    {content}
                  </Link>
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

// ═════════════════════════════════════════════════════════════════════════════
// STAFF home - machines assigned to the signed-in worker (from /floor/board)
// ═════════════════════════════════════════════════════════════════════════════

const STAFF_STATUS_BADGE = {
  RUNNING: { variant: 'success', label: 'Running' },
  IDLE: { variant: 'neutral', label: 'Idle' },
  BREAKDOWN: { variant: 'danger', label: 'Breakdown' },
} as const;

function StaffHome({ board }: { board: FloorBoardResponse }) {
  const { machines, stats } = board;
  const chartData = machines.map((m) => ({ code: m.code, metres: m.metresToday, color: STAGE_META[m.stage].color }));

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col gap-6">
      <StatGrid columns={3}>
        <StatCard icon={CpuChipIcon} label="My machines" value={stats.totalMachines} sub={`${stats.running} running · ${stats.idle} idle`} tone="accent" live={stats.running > 0} />
        <StatCard icon={SwatchIcon} label="Metres today" value={`${stats.totalMetresToday.toLocaleString('en-IN')} m`} tone="info" />
        <StatCard
          icon={ExclamationTriangleIcon}
          label="Breakdowns"
          value={stats.breakdown}
          sub={stats.breakdown ? 'Supervisor has been notified' : 'All machines healthy'}
          tone={stats.breakdown ? 'danger' : 'success'}
        />
      </StatGrid>

      {machines.length > 0 && (
        <Panel title="Metres logged today" icon={ChartBarIcon} subtitle="Per machine, coloured by stage">
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 18, right: 4, bottom: 0, left: -8 }}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="code" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={{ stroke: C.axis }} />
                <YAxis tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: C.hover, radius: 6 }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <ChartTooltipCard
                        title={String((payload[0].payload as { code: string }).code)}
                        rows={[{ label: 'Today', value: `${Number(payload[0].value).toLocaleString('en-IN')} m` }]}
                      />
                    ) : null
                  }
                />
                <Bar dataKey="metres" radius={[4, 4, 0, 0]} maxBarSize={40} label={{ position: 'top', fontSize: 11, fill: C.ink }}>
                  {chartData.map((d) => (
                    <Cell key={d.code} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      <Panel title="My machines" icon={WrenchScrewdriverIcon} subtitle="Machines assigned to you" action={{ label: 'Open floor', to: '/floor' }}>
        {machines.length === 0 ? (
          <p className="py-8 text-center text-sm text-(--color-text-muted)">No machines are assigned to you yet. Ask your supervisor to assign one.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {machines.map((m) => {
              const job = m.currentJob;
              const pct = job && job.targetMetres > 0 ? Math.min(100, Math.round((job.producedMetres / job.targetMetres) * 100)) : 0;
              return (
                <Link key={m.id} to="/floor" className="rounded-lg border border-(--color-border) p-4 transition-shadow hover:shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm font-semibold text-(--color-text)">{m.code}</p>
                      <p className="flex items-center gap-1.5 text-xs text-(--color-text-muted)">
                        <span className="h-2 w-2 rounded-sm" style={{ background: STAGE_META[m.stage].color }} />
                        {m.name} · {STAGE_META[m.stage].label}
                      </p>
                    </div>
                    <Badge variant={STAFF_STATUS_BADGE[m.status].variant} dot label={STAFF_STATUS_BADGE[m.status].label} />
                  </div>
                  {job ? (
                    <div className="mt-3">
                      <p className="text-xs text-(--color-text-muted)">
                        <span className="font-semibold text-(--color-text)">{job.orderNumber}</span> · {job.buyerName} · {job.fabricType}, {job.colour}
                      </p>
                      <div className="mt-2">
                        <ProgressBar
                          value={pct}
                          tone={pct >= 100 ? 'success' : 'accent'}
                          label={`${job.producedMetres.toLocaleString('en-IN')} of ${job.targetMetres.toLocaleString('en-IN')} m (${pct}%)`}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-(--color-text-subtle)">No job running.</p>
                  )}
                  <p className="mt-3 border-t border-(--color-border) pt-2 text-xs text-(--color-text-muted)">
                    <span className="font-semibold text-(--color-text)">{m.metresToday.toLocaleString('en-IN')} m</span> logged today
                    {m.status === 'BREAKDOWN' && m.breakdownReportedAt && ` · down ${formatRelative(m.breakdownReportedAt)}`}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Misc
// ═════════════════════════════════════════════════════════════════════════════

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-14 rounded-xl" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-[330px] rounded-xl xl:col-span-2" />
        <Skeleton className="h-[330px] rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
