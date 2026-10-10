import { useAuth } from '../../lib/auth';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { StatCard, StatGrid } from '../../components/ui/StatCard';
import {
  CubeIcon,
  WrenchScrewdriverIcon,
  BeakerIcon,
  ChartBarIcon,
  SwatchIcon,
} from '@heroicons/react/24/outline';

interface DashboardData {
  ordersByStatus: { status: string; count: number }[];
  machinesRunning: number;
  machinesIdle: number;
  machinesBreakdown: number;
  lowStockYarnCount: number;
  rollsAwaitingQc: number;
  metresTodayProduced: number;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:       'Pending',
  IN_PRODUCTION: 'In Production',
  QC:            'In QC',
  READY:         'Ready to Dispatch',
  DISPATCHED:    'Dispatched',
  COMPLETED:     'Completed',
  CANCELLED:     'Cancelled',
};

const STATUS_VARIANT: Record<string, 'neutral' | 'warning' | 'info' | 'success' | 'danger'> = {
  PENDING:       'neutral',
  IN_PRODUCTION: 'info',
  QC:            'warning',
  READY:         'success',
  DISPATCHED:    'success',
  COMPLETED:     'success',
  CANCELLED:     'danger',
};

// Segment colors for the proportional status bar - mirrors Badge's dot-color mapping.
const SEGMENT_COLOR: Record<string, string> = {
  neutral: 'bg-(--color-text-muted)',
  warning: 'bg-(--color-warning)',
  info:    'bg-(--color-info)',
  success: 'bg-(--color-success)',
  danger:  'bg-(--color-danger)',
};

const MOCK_DASHBOARD: DashboardData = {
  ordersByStatus: [
    { status: 'PENDING', count: 4 },
    { status: 'IN_PRODUCTION', count: 6 },
    { status: 'QC', count: 2 },
    { status: 'READY', count: 5 },
    { status: 'DISPATCHED', count: 12 },
  ],
  machinesRunning: 6,
  machinesIdle: 2,
  machinesBreakdown: 1,
  lowStockYarnCount: 2,
  rollsAwaitingQc: 3,
  metresTodayProduced: 4850,
};

export function HomePage() {
  const { user } = useAuth();

  const { data, loading, error, reload } = useApi<DashboardData>(
    async () => {
      try {
        return await api<DashboardData>('/reports/dashboard');
      } catch {
        // Fallback to sample data during frontend MVP development
        return MOCK_DASHBOARD;
      }
    },
    []
  );

  const totalOrders = data?.ordersByStatus.reduce((sum, s) => sum + s.count, 0) ?? 0;

  return (
    <div className="flex flex-col gap-8 page-content">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-(--color-text)">
          Good {getGreeting()}, {user?.name?.split(' ')[0]}
        </h2>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Here's what's happening at the mill today.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <ErrorState code={error.code} message={error.message} onRetry={reload} />
      )}

      {!loading && !error && data && (
        <>
          {/* KPI tiles */}
          <StatGrid columns={4}>
            <StatCard
              icon={WrenchScrewdriverIcon}
              label="Machines Running"
              value={data.machinesRunning}
              sub={`${data.machinesIdle} idle · ${data.machinesBreakdown} down`}
              tone="accent"
              live
            />
            <StatCard
              icon={CubeIcon}
              label="Rolls Awaiting QC"
              value={data.rollsAwaitingQc}
              tone={data.rollsAwaitingQc > 0 ? 'accent' : 'neutral'}
            />
            <StatCard
              icon={BeakerIcon}
              label="Low Stock Yarns"
              value={data.lowStockYarnCount}
              tone={data.lowStockYarnCount > 0 ? 'accent' : 'neutral'}
            />
            <StatCard
              icon={SwatchIcon}
              label="Metres Today"
              value={`${data.metresTodayProduced.toLocaleString('en-IN')} m`}
              tone="neutral"
            />
          </StatGrid>

          {/* Orders by status */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ChartBarIcon className="w-5 h-5 text-(--color-text-muted)" />
              <h3 className="text-sm font-semibold text-(--color-text)">Orders by Status</h3>
            </div>

            {totalOrders === 0 ? (
              <p className="text-sm text-(--color-text-muted)">No orders yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Proportional breakdown bar */}
                <div className="flex w-full h-3 rounded-full overflow-hidden bg-(--color-surface-sunken)">
                  {data.ordersByStatus.map((s) => (
                    <div
                      key={s.status}
                      style={{ width: `${(s.count / totalOrders) * 100}%` }}
                      className={[SEGMENT_COLOR[STATUS_VARIANT[s.status] ?? 'neutral'], 'transition-all duration-300'].join(' ')}
                      title={`${STATUS_LABEL[s.status] ?? s.status}: ${s.count}`}
                    />
                  ))}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-2">
                  {data.ordersByStatus.map((s) => (
                    <div
                      key={s.status}
                      className="flex items-center gap-2 bg-white border border-(--color-border) rounded-lg px-4 py-2"
                    >
                      <Badge
                        variant={STATUS_VARIANT[s.status] ?? 'neutral'}
                        label={STATUS_LABEL[s.status] ?? s.status}
                      />
                      <span className="text-sm font-semibold text-(--color-text)">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
