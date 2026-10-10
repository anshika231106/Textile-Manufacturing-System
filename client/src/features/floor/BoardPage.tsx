import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { usePolling } from '../../lib/usePolling';
import { useToast } from '../../components/ui/Toast';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Spinner } from '../../components/ui/Spinner';
import {
  getBoard,
  startJob,
  completeJob,
  markBreakdown,
  restoreMachine,
  type FloorMachine,
  type BoardStats,
  type Stage,
  type MachineStatus,
  type Shift,
} from './floor.api';
import { listOrders, type Order } from '../orders/orders.api';
import {
  PlayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ClipboardDocumentListIcon,
  AdjustmentsHorizontalIcon,
  CpuChipIcon,
  BoltIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';

const STAGES: Stage[] = ['SPINNING', 'WEAVING', 'DYEING'];

const STAGE_LABELS: Record<Stage, string> = {
  SPINNING: 'Spinning (Yarn)',
  WEAVING: 'Weaving (Greige Fabric)',
  DYEING: 'Dyeing & Processing',
};

const STAGE_COLORS: Record<Stage, { border: string; bg: string; text: string }> = {
  SPINNING: { border: 'border-blue-200', bg: 'bg-blue-50/60', text: 'text-blue-700' },
  WEAVING: { border: 'border-amber-200', bg: 'bg-amber-50/60', text: 'text-amber-700' },
  DYEING: { border: 'border-purple-200', bg: 'bg-purple-50/60', text: 'text-purple-700' },
};

export function BoardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const isSupervisorOrOwner = user?.role === 'SUPERVISOR' || user?.role === 'OWNER';

  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<FloorMachine[]>([]);
  const [stats, setStats] = useState<BoardStats>({
    totalMachines: 0,
    running: 0,
    idle: 0,
    breakdown: 0,
    totalMetresToday: 0,
    utilizationRate: 0,
  });
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Filter state
  const [selectedStageFilter, setSelectedStageFilter] = useState<'ALL' | Stage>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | MachineStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Available orders for starting jobs
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);

  // Dialog states
  const [startJobMachine, setStartJobMachine] = useState<FloorMachine | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedShift, setSelectedShift] = useState<Shift>('MORNING');
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);

  const [breakdownMachine, setBreakdownMachine] = useState<FloorMachine | null>(null);
  const [breakdownReason, setBreakdownReason] = useState('');
  const [isSubmittingBreakdown, setIsSubmittingBreakdown] = useState(false);

  const [completeJobMachine, setCompleteJobMachine] = useState<FloorMachine | null>(null);
  const [isSubmittingComplete, setIsSubmittingComplete] = useState(false);

  const [restoreMachineId, setRestoreMachineId] = useState<string | null>(null);
  const [isSubmittingRestore, setIsSubmittingRestore] = useState(false);

  // Poll floor board every 5000 ms
  const refreshBoard = useCallback(async () => {
    try {
      const data = await getBoard();
      setMachines(data.machines);
      setStats(data.stats);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Error refreshing machine floor board:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(refreshBoard, 5000);

  // Load orders for start-job modal once
  const loadOrders = useCallback(async () => {
    try {
      const orders = await listOrders();
      setAvailableOrders(orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED'));
    } catch {
      // fallback
    }
  }, []);

  const openStartJobModal = (machine: FloorMachine) => {
    setStartJobMachine(machine);
    setSelectedOrderId('');
    setSelectedShift('MORNING');
    loadOrders();
  };

  const handleStartJob = async () => {
    if (!startJobMachine || !selectedOrderId) {
      showToast('Please select an order to start production', 'error');
      return;
    }

    try {
      setIsSubmittingJob(true);
      await startJob({
        machineId: startJobMachine.id,
        orderId: selectedOrderId,
        stage: startJobMachine.stage,
        shift: selectedShift,
      });
      showToast(`Job started successfully on ${startJobMachine.name}`, 'success');
      setStartJobMachine(null);
      await refreshBoard();
    } catch (err: any) {
      showToast(err.message || 'Failed to start job on machine', 'error');
    } finally {
      setIsSubmittingJob(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!completeJobMachine || !completeJobMachine.currentJob) return;

    try {
      setIsSubmittingComplete(true);
      await completeJob(completeJobMachine.currentJob.id);
      showToast(`Job completed on ${completeJobMachine.name}. Machine is now idle.`, 'success');
      setCompleteJobMachine(null);
      await refreshBoard();
    } catch (err: any) {
      showToast(err.message || 'Failed to complete job', 'error');
    } finally {
      setIsSubmittingComplete(false);
    }
  };

  const handleMarkBreakdown = async () => {
    if (!breakdownMachine) return;

    try {
      setIsSubmittingBreakdown(true);
      await markBreakdown(breakdownMachine.id, {
        reason: breakdownReason || 'Reported breakdown by supervisor',
      });
      showToast(`Machine ${breakdownMachine.name} marked under breakdown`, 'error');
      setBreakdownMachine(null);
      setBreakdownReason('');
      await refreshBoard();
    } catch (err: any) {
      showToast(err.message || 'Failed to report breakdown', 'error');
    } finally {
      setIsSubmittingBreakdown(false);
    }
  };

  const handleRestore = async (machineId: string) => {
    try {
      setIsSubmittingRestore(true);
      setRestoreMachineId(machineId);
      await restoreMachine(machineId);
      showToast('Machine restored to operational status', 'success');
      await refreshBoard();
    } catch (err: any) {
      showToast(err.message || 'Failed to restore machine', 'error');
    } finally {
      setIsSubmittingRestore(false);
      setRestoreMachineId(null);
    }
  };

  // Filtered machines
  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      if (selectedStageFilter !== 'ALL' && m.stage !== selectedStageFilter) return false;
      if (selectedStatusFilter !== 'ALL' && m.status !== selectedStatusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q);
        const matchOrder = m.currentJob?.orderNumber.toLowerCase().includes(q) || m.currentJob?.buyerName.toLowerCase().includes(q);
        if (!matchName && !matchOrder) return false;
      }
      return true;
    });
  }, [machines, selectedStageFilter, selectedStatusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#1A1714]">
              Production Floor Live Board
            </h1>
            {/* Live Polling Badge */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live Polling (5s)
            </span>
          </div>
          <p className="text-sm text-[#78716C] mt-1">
            Real-time machine statuses, active orders, and live production output tracking.
            <span className="ml-2 text-xs text-[#A8A29E]">
              Last sync: {lastRefreshed.toLocaleTimeString()}
            </span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refreshBoard()}
            className="text-xs"
            title="Manual Refresh"
          >
            <ArrowPathIcon className="w-4 h-4 text-[#78716C]" />
            Refresh
          </Button>

          {isSupervisorOrOwner ? (
            <Link to="/floor/log">
              <Button size="sm" className="shadow-xs text-xs">
                <ClipboardDocumentListIcon className="w-4 h-4" />
                Log Shift Metres
              </Button>
            </Link>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#F5F4F2] border border-[#E8E4DF] text-xs font-medium text-[#78716C]">
              <ShieldExclamationIcon className="w-4 h-4 text-[#A8A29E]" />
              Read-Only View ({user?.role || 'Guest'})
            </div>
          )}
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-xl border border-[#E8E4DF] p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-[#78716C] mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Total Units</span>
            <CpuChipIcon className="w-4 h-4 text-[#A8A29E]" />
          </div>
          <div className="text-2xl font-bold text-[#1A1714]">{stats.totalMachines}</div>
          <div className="text-xs text-[#78716C] mt-1">Installed plant machines</div>
        </div>

        <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-2xs hover:shadow-xs transition-shadow bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Running</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-800">{stats.running}</div>
          <div className="text-xs text-emerald-600 mt-1 font-medium">
            {stats.utilizationRate}% Utilization
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E8E4DF] p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-[#78716C] mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Idle Units</span>
            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
          </div>
          <div className="text-2xl font-bold text-[#44403C]">{stats.idle}</div>
          <div className="text-xs text-[#78716C] mt-1">Ready for assignment</div>
        </div>

        <div className={`bg-white rounded-xl border p-4 shadow-2xs hover:shadow-xs transition-shadow ${stats.breakdown > 0 ? 'border-rose-200 bg-rose-50/40 text-rose-900' : 'border-[#E8E4DF]'}`}>
          <div className="flex items-center justify-between text-[#78716C] mb-1">
            <span className={`text-xs font-medium uppercase tracking-wider ${stats.breakdown > 0 ? 'text-rose-700' : ''}`}>
              Breakdown
            </span>
            <ExclamationTriangleIcon className={`w-4 h-4 ${stats.breakdown > 0 ? 'text-rose-600' : 'text-[#A8A29E]'}`} />
          </div>
          <div className={`text-2xl font-bold ${stats.breakdown > 0 ? 'text-rose-700' : 'text-[#1A1714]'}`}>
            {stats.breakdown}
          </div>
          <div className={`text-xs mt-1 ${stats.breakdown > 0 ? 'text-rose-600 font-medium' : 'text-[#78716C]'}`}>
            {stats.breakdown > 0 ? 'Requires technician' : 'Zero downtime'}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-amber-200/80 p-4 shadow-2xs hover:shadow-xs transition-shadow bg-gradient-to-br from-white to-amber-50/30 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-amber-800 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Output Today</span>
            <BoltIcon className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-900 font-mono">
            {stats.totalMetresToday.toLocaleString()} <span className="text-sm font-sans font-medium text-amber-700">m</span>
          </div>
          <div className="text-xs text-amber-700 mt-1">Aggregated shift total</div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white rounded-xl border border-[#E8E4DF] p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[#78716C] mr-1 flex items-center gap-1">
            <AdjustmentsHorizontalIcon className="w-4 h-4" />
            Stage:
          </span>
          <button
            onClick={() => setSelectedStageFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedStageFilter === 'ALL'
                ? 'bg-[#1A1714] text-white shadow-2xs'
                : 'bg-[#F5F4F2] text-[#78716C] hover:bg-[#E8E4DF] hover:text-[#1A1714]'
            }`}
          >
            All Stages
          </button>
          {STAGES.map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStageFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedStageFilter === st
                  ? 'bg-[#EA580C] text-white shadow-2xs'
                  : 'bg-[#F5F4F2] text-[#78716C] hover:bg-[#E8E4DF] hover:text-[#1A1714]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[#78716C]">Status:</span>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
              aria-label="Filter machines by status"
              className="text-xs rounded-lg border border-[#E8E4DF] bg-white py-1.5 px-2.5 text-[#1A1714] focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
            >
              <option value="ALL">All Statuses</option>
              <option value="RUNNING">Running</option>
              <option value="IDLE">Idle</option>
              <option value="BREAKDOWN">Breakdown</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="w-full sm:w-48">
            <input
              type="text"
              placeholder="Search machine/order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs rounded-lg border border-[#E8E4DF] bg-white py-1.5 px-3 text-[#1A1714] placeholder-[#A8A29E] focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
            />
          </div>
        </div>
      </div>

      {/* Main Floor Columns or Grouped Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#78716C]">
          <Spinner />
          <p className="text-sm mt-3 font-medium">Connecting to machine floor sensors...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {STAGES.filter(
            (st) => selectedStageFilter === 'ALL' || selectedStageFilter === st
          ).map((stage) => {
            const stageMachines = filteredMachines.filter((m) => m.stage === stage);
            const style = STAGE_COLORS[stage];

            return (
              <section key={stage} className="space-y-3.5">
                {/* Stage Header */}
                <div className="flex items-center justify-between border-b border-[#E8E4DF] pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${style.bg} ${style.text} border ${style.border}`}>
                      {stage}
                    </span>
                    <h2 className="text-base font-semibold text-[#1A1714]">
                      {STAGE_LABELS[stage]}
                    </h2>
                  </div>
                  <span className="text-xs text-[#78716C] font-medium">
                    {stageMachines.length} {stageMachines.length === 1 ? 'unit' : 'units'}
                  </span>
                </div>

                {stageMachines.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#E8E4DF] p-8 text-center text-[#78716C] text-sm">
                    No machines match current filter criteria in this stage.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stageMachines.map((machine) => {
                      const isRunning = machine.status === 'RUNNING';
                      const isIdle = machine.status === 'IDLE';
                      const isBreakdown = machine.status === 'BREAKDOWN';

                      const progressPercent = machine.currentJob && machine.currentJob.targetMetres > 0
                        ? Math.min(Math.round((machine.currentJob.producedMetres / machine.currentJob.targetMetres) * 100), 100)
                        : 0;

                      return (
                        <div
                          key={machine.id}
                          className={`bg-white rounded-xl border transition-all duration-150 flex flex-col justify-between overflow-hidden shadow-2xs hover:shadow-md ${
                            isRunning
                              ? 'border-emerald-200/90 ring-1 ring-emerald-500/10'
                              : isBreakdown
                              ? 'border-rose-300 bg-rose-50/20'
                              : 'border-[#E8E4DF]'
                          }`}
                        >
                          {/* Machine Card Top */}
                          <div className="p-4.5 border-b border-[#F5F4F2]">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#F5F4F2] text-[#44403C] border border-[#E8E4DF]">
                                    {machine.code}
                                  </span>
                                  <span className="text-xs text-[#78716C]">
                                    ₹{machine.ratePerMetre}/m
                                  </span>
                                </div>
                                <h3 className="text-sm font-semibold text-[#1A1714] mt-1.5 leading-snug">
                                  {machine.name}
                                </h3>
                              </div>

                              <div>
                                {isRunning && (
                                  <Badge variant="success" label="RUNNING" dot />
                                )}
                                {isIdle && (
                                  <Badge variant="neutral" label="IDLE" />
                                )}
                                {isBreakdown && (
                                  <Badge variant="danger" label="BREAKDOWN" dot />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Machine Card Body */}
                          <div className="p-4.5 flex-1 space-y-3.5">
                            {isRunning && machine.currentJob ? (
                              <div className="space-y-3">
                                <div className="bg-emerald-50/40 rounded-lg p-3 border border-emerald-100">
                                  <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="text-emerald-800 font-medium">Active Order:</span>
                                    <span className="font-mono font-bold text-emerald-900">
                                      {machine.currentJob.orderNumber}
                                    </span>
                                  </div>
                                  <div className="text-xs text-[#44403C] font-medium truncate">
                                    {machine.currentJob.buyerName}
                                  </div>
                                  <div className="text-xs text-[#78716C] mt-0.5 truncate">
                                    {machine.currentJob.fabricType} • {machine.currentJob.colour}
                                  </div>

                                  {/* Progress bar */}
                                  <div className="mt-2.5">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                      <span className="text-[#78716C]">Job Progress</span>
                                      <span className="font-mono font-semibold text-emerald-800">
                                        {machine.currentJob.producedMetres} / {machine.currentJob.targetMetres} m ({progressPercent}%)
                                      </span>
                                    </div>
                                    <div className="w-full bg-emerald-100/70 rounded-full h-1.5 overflow-hidden">
                                      <div
                                        className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300"
                                        style={{ width: `${progressPercent}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-[#78716C] px-1">
                                  <span>Shift: <strong className="text-[#1A1714]">{machine.currentJob.shift || 'MORNING'}</strong></span>
                                  <span>Output Today: <strong className="text-[#1A1714] font-mono">{machine.metresToday} m</strong></span>
                                </div>
                              </div>
                            ) : isBreakdown ? (
                              <div className="bg-rose-50 rounded-lg p-3 border border-rose-200 text-xs text-rose-800 space-y-1.5">
                                <div className="flex items-center gap-1.5 font-semibold text-rose-900">
                                  <ExclamationTriangleIcon className="w-4 h-4 text-rose-600 shrink-0" />
                                  Breakdown Reported
                                </div>
                                <p className="text-rose-700 leading-relaxed">
                                  {machine.breakdownReason || 'Technical fault observed during production run.'}
                                </p>
                                <div className="text-[11px] text-rose-600 font-mono mt-1">
                                  Reported: {machine.breakdownReportedAt ? new Date(machine.breakdownReportedAt).toLocaleTimeString() : 'Recent'}
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-dashed border-[#E8E4DF] bg-[#FBFBFA] p-4 text-center">
                                <p className="text-xs text-[#78716C] font-medium">Machine ready for assignment</p>
                                <p className="text-[11px] text-[#A8A29E] mt-0.5">No active order currently loaded</p>
                                <div className="text-xs text-[#78716C] mt-2">
                                  Output Today: <span className="font-mono font-semibold text-[#1A1714]">{machine.metresToday} m</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Machine Card Actions */}
                          <div className="p-3 bg-[#FBFBFA] border-t border-[#E8E4DF] flex items-center justify-between gap-2">
                            {isIdle && (
                              <>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  disabled={!isSupervisorOrOwner}
                                  onClick={() => openStartJobModal(machine)}
                                  className="w-full text-xs shadow-2xs"
                                >
                                  <PlayIcon className="w-3.5 h-3.5" />
                                  Start Job
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={!isSupervisorOrOwner}
                                  onClick={() => {
                                    setBreakdownMachine(machine);
                                    setBreakdownReason('');
                                  }}
                                  className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                  title="Mark Breakdown"
                                >
                                  Fault
                                </Button>
                              </>
                            )}

                            {isRunning && (
                              <div className="flex items-center gap-1.5 w-full">
                                <Link to={`/floor/log?machineId=${machine.id}`} className="flex-1">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="w-full text-xs"
                                  >
                                    Log Metres
                                  </Button>
                                </Link>

                                <Button
                                  size="sm"
                                  variant="primary"
                                  disabled={!isSupervisorOrOwner}
                                  onClick={() => setCompleteJobMachine(machine)}
                                  className="text-xs bg-emerald-600 hover:bg-emerald-700 border-transparent shadow-2xs"
                                  title="Complete Job"
                                >
                                  <CheckCircleIcon className="w-4 h-4" />
                                  Finish
                                </Button>

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={!isSupervisorOrOwner}
                                  onClick={() => {
                                    setBreakdownMachine(machine);
                                    setBreakdownReason('');
                                  }}
                                  className="text-xs text-rose-600 hover:bg-rose-50 p-2"
                                  title="Report Breakdown"
                                >
                                  <ExclamationTriangleIcon className="w-4 h-4" />
                                </Button>
                              </div>
                            )}

                            {isBreakdown && (
                              <Button
                                size="sm"
                                variant="primary"
                                disabled={!isSupervisorOrOwner}
                                loading={isSubmittingRestore && restoreMachineId === machine.id}
                                onClick={() => handleRestore(machine.id)}
                                className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 border-transparent shadow-2xs"
                              >
                                <ArrowPathIcon className="w-3.5 h-3.5" />
                                Restore to Service
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Start Job Dialog */}
      <Dialog
        open={!!startJobMachine}
        onClose={() => setStartJobMachine(null)}
        title={`Assign Order to ${startJobMachine?.name || 'Machine'}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
            <strong>Target Stage:</strong> {startJobMachine?.stage} (Rate: ₹{startJobMachine?.ratePerMetre}/m)
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#1A1714]">
              Select Active Order <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="w-full rounded-lg border border-[#E8E4DF] bg-white py-2 px-3 text-sm text-[#1A1714] focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
            >
              <option value="">-- Choose an order --</option>
              {availableOrders.map((ord) => (
                <option key={ord.id} value={ord.id}>
                  {ord.orderNumber} — {ord.buyerName} ({ord.fabricType}, {ord.metres}m)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#1A1714]">Working Shift</label>
            <div className="grid grid-cols-3 gap-2">
              {(['MORNING', 'EVENING', 'NIGHT'] as Shift[]).map((sh) => (
                <button
                  key={sh}
                  type="button"
                  onClick={() => setSelectedShift(sh)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    selectedShift === sh
                      ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-2xs'
                      : 'bg-white text-[#78716C] border-[#E8E4DF] hover:border-[#A8A29E]'
                  }`}
                >
                  {sh}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E8E4DF]">
            <Button
              variant="secondary"
              onClick={() => setStartJobMachine(null)}
              disabled={isSubmittingJob}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={isSubmittingJob}
              onClick={handleStartJob}
            >
              Start Production
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Complete Job Dialog */}
      <Dialog
        open={!!completeJobMachine}
        onClose={() => setCompleteJobMachine(null)}
        title="Complete Machine Stage Job"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#44403C]">
            Are you sure you want to mark the current job on{' '}
            <strong>{completeJobMachine?.name}</strong> as completed?
          </p>

          {completeJobMachine?.currentJob && (
            <div className="bg-[#F5F4F2] rounded-lg p-3.5 space-y-2 text-xs border border-[#E8E4DF]">
              <div className="flex justify-between">
                <span className="text-[#78716C]">Order:</span>
                <span className="font-mono font-bold text-[#1A1714]">
                  {completeJobMachine.currentJob.orderNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#78716C]">Client:</span>
                <span className="font-medium text-[#1A1714]">
                  {completeJobMachine.currentJob.buyerName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#78716C]">Metres Produced:</span>
                <span className="font-mono font-semibold text-emerald-700">
                  {completeJobMachine.currentJob.producedMetres} / {completeJobMachine.currentJob.targetMetres} m
                </span>
              </div>
            </div>
          )}

          <p className="text-xs text-[#78716C]">
            Completing this stage job frees up the unit back to IDLE status and enables the order to advance to the next manufacturing stage or Quality Control.
          </p>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E8E4DF]">
            <Button
              variant="secondary"
              onClick={() => setCompleteJobMachine(null)}
              disabled={isSubmittingComplete}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={isSubmittingComplete}
              onClick={handleCompleteJob}
              className="bg-emerald-600 hover:bg-emerald-700 border-transparent shadow-2xs"
            >
              Confirm Completion
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Report Breakdown Dialog */}
      <Dialog
        open={!!breakdownMachine}
        onClose={() => setBreakdownMachine(null)}
        title={`Report Breakdown — ${breakdownMachine?.name}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-xs text-rose-800">
            Reporting a breakdown pauses running work on this unit and alerts plant floor maintenance staff.
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#1A1714]">
              Reason / Observed Issue
            </label>
            <textarea
              rows={3}
              value={breakdownReason}
              onChange={(e) => setBreakdownReason(e.target.value)}
              placeholder="e.g. Warp yarn tension sensor error, motor heating, heald frame misalignment..."
              className="w-full rounded-lg border border-[#E8E4DF] bg-white py-2 px-3 text-sm text-[#1A1714] focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E8E4DF]">
            <Button
              variant="secondary"
              onClick={() => setBreakdownMachine(null)}
              disabled={isSubmittingBreakdown}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={isSubmittingBreakdown}
              onClick={handleMarkBreakdown}
            >
              Confirm Breakdown
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
