import { useAuth } from '../../lib/auth';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
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

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card className="p-5 flex flex-col gap-3 relative overflow-hidden">
      {accent && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#EA580C] rounded-l-xl" />
      )}
      <div className="flex items-center gap-2 text-[#78716C]">
        <Icon className="w-5 h-5" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-3xl font-bold text-[#1A1714] leading-none">{value}</p>
      {sub && <p className="text-xs text-[#78716C]">{sub}</p>}
    </Card>
  );
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

  return (
    <div className="flex flex-col gap-8 page-content">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[#1A1714]">
          Good {getGreeting()}, {user?.name?.split(' ')[0]}
        </h2>
        <p className="mt-1 text-sm text-[#78716C]">
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={WrenchScrewdriverIcon}
              label="Machines Running"
              value={data.machinesRunning}
              sub={`${data.machinesIdle} idle · ${data.machinesBreakdown} down`}
              accent
            />
            <StatCard
              icon={CubeIcon}
              label="Rolls Awaiting QC"
              value={data.rollsAwaitingQc}
              accent={data.rollsAwaitingQc > 0}
            />
            <StatCard
              icon={BeakerIcon}
              label="Low Stock Yarns"
              value={data.lowStockYarnCount}
              accent={data.lowStockYarnCount > 0}
            />
            <StatCard
              icon={SwatchIcon}
              label="Metres Today"
              value={`${data.metresTodayProduced.toLocaleString('en-IN')} m`}
            />
          </div>

          {/* Orders by status */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ChartBarIcon className="w-5 h-5 text-[#78716C]" />
              <h3 className="text-sm font-semibold text-[#1A1714]">Orders by Status</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.ordersByStatus.length === 0 ? (
                <p className="text-sm text-[#78716C]">No orders yet.</p>
              ) : (
                data.ordersByStatus.map((s) => (
                  <div
                    key={s.status}
                    className="flex items-center gap-2 bg-white border border-[#E8E4DF] rounded-lg px-4 py-2"
                  >
                    <Badge
                      variant={STATUS_VARIANT[s.status] ?? 'neutral'}
                      label={STATUS_LABEL[s.status] ?? s.status}
                    />
                    <span className="text-sm font-semibold text-[#1A1714]">{s.count}</span>
                  </div>
                ))
              )}
            </div>
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
