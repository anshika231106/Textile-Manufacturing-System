import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowPathIcon,
  BeakerIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  CpuChipIcon,
  PlusIcon,
  ShoppingBagIcon,
  SwatchIcon,
  TruckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useAuth, type Role } from '../../lib/auth';
import { ApiError } from '../../lib/api';
import { usePolling } from '../../lib/usePolling';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/ErrorState';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/Skeleton';
import { StatCard, StatGrid } from '../../components/ui/StatCard';
import { staggerContainer } from '../../lib/motion';
import { getBoard, type FloorBoardResponse } from '../floor/floor.api';
import { getDashboard, type DashboardData, type Stage } from './reports.api';
import { ProductionTrendChart, StageLegend, STAGE_ORDER } from './dashboard/ProductionTrendChart';
import {
  ActivityPanel,
  AttentionStrip,
  FinancePanel,
  MachineFloorPanel,
  OrderDeadlinesPanel,
  OrderPipeline,
  Panel,
  QualityPanel,
  StockPanel,
  buildAttentionItems,
} from './dashboard/panels';
import { StaffHome } from './dashboard/StaffHome';

const REFRESH_MS = 60_000;

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
  '/reports/month-end': ['OWNER', 'OFFICE'],
};

const QUICK_ACTIONS = [
  { label: 'New order', to: '/orders/new', icon: PlusIcon, primary: true },
  { label: 'Log production', to: '/floor/log', icon: ClipboardDocumentListIcon },
  { label: 'Inspect rolls', to: '/qc', icon: BeakerIcon },
  { label: 'Dispatch', to: '/dispatch', icon: TruckIcon },
];

type Snapshot =
  | { kind: 'manager'; data: DashboardData }
  | { kind: 'staff'; board: FloorBoardResponse };

function pctChange(current: number, previous: number): string | null {
  if (previous <= 0) return current > 0 ? 'new vs yesterday' : null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs yesterday`;
}

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role as Role | undefined;
  const isStaff = role === 'STAFF';

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [trendView, setTrendView] = useState<'chart' | 'table'>('chart');
  const inFlight = useRef(false);

  const canAccess = useCallback(
    (path: string) => {
      const roles = PAGE_ROLES[path];
      return roles === 'all' || (!!role && !!roles && roles.includes(role));
    },
    [role]
  );

  const load = useCallback(
    async (force = false) => {
      // Skip background refreshes while the tab is hidden; always honour manual refresh.
      if (inFlight.current || (!force && document.hidden && snapshot)) return;
      inFlight.current = true;
      setRefreshing(true);
      try {
        const next: Snapshot = isStaff
          ? { kind: 'staff', board: await getBoard() }
          : { kind: 'manager', data: await getDashboard() };
        setSnapshot(next);
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
  const attention = useMemo(() => (data ? buildAttentionItems(data, canAccess) : []), [data, canAccess]);
  const stageTotals = useMemo(() => {
    const totals = { SPINNING: 0, WEAVING: 0, DYEING: 0 } as Record<Stage, number>;
    data?.production.trend.forEach((d) => STAGE_ORDER.forEach((s) => (totals[s] += d[s])));
    STAGE_ORDER.forEach((s) => (totals[s] = Math.round(totals[s])));
    return totals;
  }, [data]);

  const updatedAt = data?.generatedAt ?? (snapshot ? new Date().toISOString() : null);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex flex-col gap-6 page-content">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-(--color-accent)">{today}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-(--color-text)">
            Good {getGreeting()}, {user?.name?.split(' ')[0]}
          </h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-(--color-text-muted)">
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
          {QUICK_ACTIONS.filter((a) => canAccess(a.to)).map((a) => (
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

      {data && (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col gap-6">
          <AttentionStrip items={attention} />

          {/* KPI tiles */}
          <StatGrid columns={6}>
            <StatCard
              icon={SwatchIcon}
              label="Metres today"
              value={`${data.production.today.toLocaleString('en-IN')} m`}
              sub={pctChange(data.production.today, data.production.yesterday) ?? `${data.production.last7Days.toLocaleString('en-IN')} m this week`}
              tone="accent"
            />
            <StatCard
              icon={CpuChipIcon}
              label="Utilisation"
              value={`${data.machines.utilizationRate}%`}
              sub={`${data.machines.running}/${data.machines.total} running${data.machines.breakdown ? ` · ${data.machines.breakdown} down` : ''}`}
              tone={data.machines.breakdown ? 'danger' : 'success'}
              live={data.machines.running > 0}
            />
            <StatCard
              icon={ShoppingBagIcon}
              label="Active orders"
              value={data.orders.active}
              sub={data.orders.overdue ? `${data.orders.overdue} overdue · ${data.orders.dueThisWeek} due this week` : `${data.orders.dueThisWeek} due this week`}
              tone={data.orders.overdue ? 'danger' : 'info'}
            />
            <StatCard
              icon={BeakerIcon}
              label="QC pass rate"
              value={data.quality.last7Days.passRate == null ? '—' : `${data.quality.last7Days.passRate}%`}
              sub={`${data.quality.awaitingRolls} roll${data.quality.awaitingRolls === 1 ? '' : 's'} awaiting · 7 days`}
              tone={data.quality.last7Days.passRate != null && data.quality.last7Days.passRate < 90 ? 'warning' : 'success'}
            />
            <StatCard
              icon={TruckIcon}
              label="Ready to ship"
              value={`${data.finishedGoods.readyMetres.toLocaleString('en-IN')} m`}
              sub={`${data.finishedGoods.readyRolls} roll${data.finishedGoods.readyRolls === 1 ? '' : 's'} passed QC`}
              tone="neutral"
            />
            <StatCard
              icon={UserGroupIcon}
              label="Staff present"
              value={data.workforce.markedToday ? `${data.workforce.presentToday}/${data.workforce.totalStaff}` : '—'}
              sub={data.workforce.markedToday ? `${data.workforce.absentToday} absent today` : 'Attendance not marked yet'}
              tone={data.workforce.markedToday ? 'neutral' : 'warning'}
            />
          </StatGrid>

          {/* Production + machines */}
          <div className="grid gap-6 xl:grid-cols-3">
            <Panel
              className="xl:col-span-2"
              title="Production, last 14 days"
              icon={ChartBarIcon}
              subtitle={
                <>
                  {data.production.last7Days.toLocaleString('en-IN')} m this week vs {data.production.prev7Days.toLocaleString('en-IN')} m the week before
                  {' · '}today by shift: {(['MORNING', 'EVENING', 'NIGHT'] as const)
                    .map((s) => `${s[0]}${s.slice(1).toLowerCase()} ${data.production.byShiftToday[s].toLocaleString('en-IN')} m`)
                    .join(', ')}
                </>
              }
              headerRight={
                <SegmentedControl
                  size="sm"
                  value={trendView}
                  onChange={setTrendView}
                  options={[
                    { value: 'chart', label: 'Chart' },
                    { value: 'table', label: 'Table' },
                  ]}
                />
              }
            >
              <div className="mb-3">
                <StageLegend totals={stageTotals} />
              </div>
              <ProductionTrendChart data={data.production.trend} view={trendView} />
            </Panel>
            <MachineFloorPanel machines={data.machines} canOpenFloor={canAccess('/floor')} />
          </div>

          {/* Orders */}
          <div className="flex flex-col gap-3">
            <OrderPipeline counts={data.ordersByStatus} />
            <OrderDeadlinesPanel orders={data.orders} />
          </div>

          {/* Quality / stock / money / activity */}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <QualityPanel quality={data.quality} canOpenQc={canAccess('/qc')} />
            <StockPanel stock={data.stock} />
            {data.finance ? (
              <FinancePanel finance={data.finance} />
            ) : (
              <ActivityPanel activity={data.activity} canAccess={canAccess} />
            )}
          </div>
          {data.finance && <ActivityPanel activity={data.activity} canAccess={canAccess} />}
        </motion.div>
      )}
    </div>
  );
}

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
