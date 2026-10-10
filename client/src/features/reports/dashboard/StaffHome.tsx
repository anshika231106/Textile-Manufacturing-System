import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CpuChipIcon, SwatchIcon, WrenchScrewdriverIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Badge } from '../../../components/ui/Badge';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { StatCard, StatGrid } from '../../../components/ui/StatCard';
import { formatRelative } from '../../../lib/format';
import { staggerContainer } from '../../../lib/motion';
import type { FloorBoardResponse } from '../../floor/floor.api';
import { Panel } from './panels';
import { STAGE_META } from './ProductionTrendChart';

const STATUS_BADGE = {
  RUNNING: { variant: 'success', label: 'Running' },
  IDLE: { variant: 'neutral', label: 'Idle' },
  BREAKDOWN: { variant: 'danger', label: 'Breakdown' },
} as const;

/** Home screen for floor staff: only the machines assigned to them, from /floor/board. */
export function StaffHome({ board }: { board: FloorBoardResponse }) {
  const { machines, stats } = board;

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

      <Panel title="My machines" icon={WrenchScrewdriverIcon} subtitle="Machines assigned to you" action={{ label: 'Open floor', to: '/floor' }}>
        {machines.length === 0 ? (
          <p className="py-8 text-center text-sm text-(--color-text-muted)">
            No machines are assigned to you yet. Ask your supervisor to assign one.
          </p>
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
                    <Badge variant={STATUS_BADGE[m.status].variant} dot label={STATUS_BADGE[m.status].label} />
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
