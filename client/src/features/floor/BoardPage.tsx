import { useState, useCallback, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { usePolling } from '../../lib/usePolling';
import { useToast } from '../../components/ui/Toast';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Spinner } from '../../components/ui/Spinner';
import { Callout } from '../../components/ui/Callout';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { StatCard, StatGrid } from '../../components/ui/StatCard';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import {
  getBoard,
  startJob,
  completeJob,
  markBreakdown,
  restoreMachine,
  assignMachine,
  listFloorStaff,
  updateMachineStatus,
  type FloorMachine,
  type FloorStaff,
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

const STAGE_FILTER_OPTIONS: { value: 'ALL' | Stage; label: string }[] = [
  { value: 'ALL', label: 'All Stages' },
  ...STAGES.map((st) => ({ value: st, label: st })),
];

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'IDLE', label: 'Idle' },
  { value: 'BREAKDOWN', label: 'Damaged' },
];

const SELF_STATUS_OPTIONS: { value: MachineStatus; label: string; tone: 'neutral' | 'success' | 'danger' }[] = [
  { value: 'IDLE', label: 'IDLE', tone: 'neutral' },
  { value: 'RUNNING', label: 'RUNNING', tone: 'success' },
  { value: 'BREAKDOWN', label: 'Damaged', tone: 'danger' },
];

export function BoardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const isSupervisorOrOwner = user?.role === 'SUPERVISOR' || user?.role === 'OWNER';
  const isStaff = user?.role === 'STAFF';

  const [loading, setLoading] = useState(true);
  const [boardError, setBoardError] = useState('');
  const [machines, setMachines] = useState<FloorMachine[]>([]);
  const [staffMembers, setStaffMembers] = useState<FloorStaff[]>([]);
  const [savingMachineId, setSavingMachineId] = useState<string | null>(null);
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
      setBoardError('');
      if (data.machines.length === 0 && isStaff) {
        setBoardError('No machines have been assigned to your account yet. Ask your supervisor to assign your machines.');
      }
    } catch (err) {
      console.error('Error refreshing machine floor board:', err);
      setBoardError(err instanceof Error ? err.message : 'Unable to load machine status.');
    } finally {
      setLoading(false);
    }
  }, [isStaff]);

  usePolling(refreshBoard, 5000);

  useEffect(() => {
    if (!isSupervisorOrOwner) return;
    listFloorStaff()
      .then(setStaffMembers)
      .catch((err: unknown) => {
        showToast(err instanceof Error ? err.message : 'Unable to load staff list', 'error');
      });
  }, [isSupervisorOrOwner, showToast]);

  const handleAssignMachine = async (machineId: string, staffId: string) => {
    try {
      setSavingMachineId(machineId);
      await assignMachine(machineId, staffId || null);
      showToast('Machine assignment updated', 'success');
      await refreshBoard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update machine assignment', 'error');
    } finally {
      setSavingMachineId(null);
    }
  };

  const handleStaffStatusChange = async (machine: FloorMachine, status: MachineStatus) => {
    try {
      setSavingMachineId(machine.id);
      await updateMachineStatus(machine.id, status);
      showToast(`${machine.name} status updated to ${status === 'BREAKDOWN' ? 'Damaged' : status.toLowerCase()}`, 'success');
      await refreshBoard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update machine status', 'error');
    } finally {
      setSavingMachineId(null);
    }
  };

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
            <h1 className="text-2xl font-bold tracking-tight text-(--color-text)">
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
          <p className="text-sm text-(--color-text-muted) mt-1">
            {isStaff
              ? 'Update the status of machines assigned to you. Supervisors can see changes live.'
              : 'Monitor machine status, active orders, production output, and staff assignments.'}
            <span className="ml-2 text-xs text-(--color-text-subtle)">
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
            <ArrowPathIcon className="w-4 h-4 text-(--color-text-muted)" />
            Refresh
          </Button>

          {isSupervisorOrOwner ? (
            <Link to="/floor/log">
              <Button size="sm" className="shadow-xs text-xs">
                <ClipboardDocumentListIcon className="w-4 h-4" />
                Log Shift Metres
              </Button>
            </Link>
          ) : isStaff ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 border border-blue-100 text-xs font-medium text-blue-700">
              Your Assigned Machines
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-(--color-surface-sunken) border border-(--color-border) text-xs font-medium text-(--color-text-muted)">
              <ShieldExclamationIcon className="w-4 h-4 text-(--color-text-subtle)" />
              View Only ({user?.role || 'Guest'})
            </div>
          )}
        </div>
      </div>

      {/* Stats Summary Bar */}
      <StatGrid columns={5}>
        <StatCard
          icon={CpuChipIcon}
          label="Total Units"
          value={stats.totalMachines}
          sub="Installed plant machines"
          tone="neutral"
        />
        <StatCard
          icon={BoltIcon}
          label="Running"
          value={stats.running}
          sub={`${stats.utilizationRate}% Utilization`}
          tone="success"
          live
        />
        <StatCard
          icon={CpuChipIcon}
          label="Idle Units"
          value={stats.idle}
          sub="Ready for assignment"
          tone="neutral"
        />
        <StatCard
          icon={ExclamationTriangleIcon}
          label="Damaged"
          value={stats.breakdown}
          sub={stats.breakdown > 0 ? 'Requires attention' : 'No damaged machines'}
          tone={stats.breakdown > 0 ? 'danger' : 'neutral'}
        />
        <StatCard
          icon={BoltIcon}
          label="Output Today"
          value={`${stats.totalMetresToday.toLocaleString()} m`}
          sub="Aggregated shift total"
          tone="warning"
        />
      </StatGrid>

      {/* Filter and Control Bar */}
      <div className="bg-white rounded-xl border border-(--color-border) p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-(--color-text-muted) mr-1 flex items-center gap-1">
            <AdjustmentsHorizontalIcon className="w-4 h-4" />
            Stage:
          </span>
          <SegmentedControl
            value={selectedStageFilter}
            onChange={setSelectedStageFilter}
            options={STAGE_FILTER_OPTIONS}
            size="sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-(--color-text-muted)">Status:</span>
            <Select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
              aria-label="Filter machines by status"
              options={STATUS_FILTER_OPTIONS}
              className="text-xs py-1.5"
            />
          </div>

          {/* Search Input */}
          <div className="w-full sm:w-48">
            <Input
              type="text"
              placeholder="Search machine/order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs py-1.5"
            />
          </div>
        </div>
      </div>

      {/* Main Floor Columns or Grouped Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-(--color-text-muted)">
          <Spinner />
          <p className="text-sm mt-3 font-medium">Connecting to machine floor sensors...</p>
        </div>
      ) : boardError ? (
        <Callout tone="danger">{boardError}</Callout>
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
                <div className="flex items-center justify-between border-b border-(--color-border) pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${style.bg} ${style.text} border ${style.border}`}>
                      {stage}
                    </span>
                    <h2 className="text-base font-semibold text-(--color-text)">
                      {STAGE_LABELS[stage]}
                    </h2>
                  </div>
                  <span className="text-xs text-(--color-text-muted) font-medium">
                    {stageMachines.length} {stageMachines.length === 1 ? 'unit' : 'units'}
                  </span>
                </div>

                {stageMachines.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-(--color-border) p-8 text-center text-(--color-text-muted) text-sm">
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
                              : 'border-(--color-border)'
                          }`}
                        >
                          {/* Machine Card Top */}
                          <div className="p-4.5 border-b border-(--color-surface-sunken)">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-(--color-surface-sunken) text-(--color-text-dark) border border-(--color-border)">
                                    {machine.code}
                                  </span>
                                  <span className="text-xs text-(--color-text-muted)">
                                    ₹{machine.ratePerMetre}/m
                                  </span>
                                </div>
                                <h3 className="text-sm font-semibold text-(--color-text) mt-1.5 leading-snug">
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
                                  <Badge variant="danger" label="DAMAGED" dot />
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
                                  <div className="text-xs text-(--color-text-dark) font-medium truncate">
                                    {machine.currentJob.buyerName}
                                  </div>
                                  <div className="text-xs text-(--color-text-muted) mt-0.5 truncate">
                                    {machine.currentJob.fabricType} • {machine.currentJob.colour}
                                  </div>

                                  {/* Progress bar */}
                                  <div className="mt-2.5">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                      <span className="text-(--color-text-muted)">Job Progress</span>
                                      <span className="font-mono font-semibold text-emerald-800">
                                        {machine.currentJob.producedMetres} / {machine.currentJob.targetMetres} m ({progressPercent}%)
                                      </span>
                                    </div>
                                    <ProgressBar value={progressPercent} tone="success" size="sm" />
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-(--color-text-muted) px-1">
                                  <span>Shift: <strong className="text-(--color-text)">{machine.currentJob.shift || 'MORNING'}</strong></span>
                                  <span>Output Today: <strong className="text-(--color-text) font-mono">{machine.metresToday} m</strong></span>
                                </div>
                              </div>
                            ) : isBreakdown ? (
                              <div className="bg-rose-50 rounded-lg p-3 border border-rose-200 text-xs text-rose-800 space-y-1.5">
                                <div className="flex items-center gap-1.5 font-semibold text-rose-900">
                                  <ExclamationTriangleIcon className="w-4 h-4 text-rose-600 shrink-0" />
                                  Machine Damaged
                                </div>
                                <p className="text-rose-700 leading-relaxed">
                                  {machine.statusNote || machine.breakdownReason || 'Damage reported on this machine.'}
                                </p>
                                <div className="text-[11px] text-rose-600 font-mono mt-1">
                                  Reported by {machine.statusUpdatedBy?.name || 'Staff'}{machine.statusUpdatedAt ? ` at ${new Date(machine.statusUpdatedAt).toLocaleString()}` : ''}
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-dashed border-(--color-border) bg-(--color-surface-alt) p-4 text-center">
                                <p className="text-xs text-(--color-text-muted) font-medium">Machine ready for assignment</p>
                                <p className="text-[11px] text-(--color-text-subtle) mt-0.5">No active order currently loaded</p>
                                <div className="text-xs text-(--color-text-muted) mt-2">
                                  Output Today: <span className="font-mono font-semibold text-(--color-text)">{machine.metresToday} m</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Machine Card Actions */}
                          <div className="p-3 bg-(--color-surface-alt) border-t border-(--color-border) space-y-3">
                            {isStaff ? (
                              <>
                                <div className="text-xs text-(--color-text-muted)">
                                  Assigned to <span className="font-semibold text-(--color-text)">{machine.assignedStaff?.name || user?.name}</span>
                                </div>
                                <SegmentedControl
                                  value={machine.status}
                                  onChange={(status) => handleStaffStatusChange(machine, status)}
                                  options={SELF_STATUS_OPTIONS}
                                  size="sm"
                                  fullWidth
                                  disabledOptions={
                                    savingMachineId === machine.id
                                      ? ['IDLE', 'RUNNING', 'BREAKDOWN']
                                      : [machine.status]
                                  }
                                />
                              </>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                {isIdle && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      onClick={() => openStartJobModal(machine)}
                                      className="w-full text-xs shadow-2xs"
                                    >
                                      <PlayIcon className="w-3.5 h-3.5" />
                                      Start Job
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setBreakdownMachine(machine);
                                        setBreakdownReason('');
                                      }}
                                      className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                      title="Mark Damaged"
                                    >
                                      Fault
                                    </Button>
                                  </>
                                )}

                                {isRunning && (
                                  <div className="flex items-center gap-1.5 w-full">
                                    {machine.currentJob && isSupervisorOrOwner && (
                                      <Link to={`/floor/log?machineId=${machine.id}`} className="flex-1">
                                        <Button size="sm" variant="secondary" className="w-full text-xs">
                                          Log Metres
                                        </Button>
                                      </Link>
                                    )}
                                    {machine.currentJob && (
                                      <Button
                                        size="sm"
                                        variant="primary"
                                        onClick={() => setCompleteJobMachine(machine)}
                                        className="text-xs bg-emerald-600 hover:bg-emerald-700 border-transparent shadow-2xs"
                                        title="Complete Job"
                                      >
                                        <CheckCircleIcon className="w-4 h-4" />
                                        Finish
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setBreakdownMachine(machine);
                                        setBreakdownReason('');
                                      }}
                                      className="text-xs text-rose-600 hover:bg-rose-50 p-2"
                                      title="Report Damage"
                                    >
                                      <ExclamationTriangleIcon className="w-4 h-4" />
                                    </Button>
                                  </div>
                                )}

                                {isBreakdown && (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    loading={isSubmittingRestore && restoreMachineId === machine.id}
                                    onClick={() => handleRestore(machine.id)}
                                    className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 border-transparent shadow-2xs"
                                  >
                                    <ArrowPathIcon className="w-3.5 h-3.5" />
                                    Restore to Service
                                  </Button>
                                )}
                              </div>
                            )}

                            {isSupervisorOrOwner && (
                              <div className="border-t border-(--color-border) pt-3">
                                <Select
                                  label="Assigned Staff"
                                  value={machine.assignedStaff?.id ?? ''}
                                  disabled={savingMachineId === machine.id}
                                  onChange={(event) => handleAssignMachine(machine.id, event.target.value)}
                                  options={[
                                    { value: '', label: 'Unassigned' },
                                    ...staffMembers.map((staff) => ({ value: staff.id, label: staff.name })),
                                  ]}
                                  className="text-xs py-2"
                                />
                              </div>
                            )}

                            {machine.statusUpdatedBy && (
                              <p className="text-[11px] text-(--color-text-muted)">
                                Last status update by <span className="font-medium text-(--color-text-dark)">{machine.statusUpdatedBy.name}</span>
                                {machine.statusUpdatedAt && ` · ${new Date(machine.statusUpdatedAt).toLocaleString()}`}
                              </p>
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
          <Callout tone="warning">
            <strong>Target Stage:</strong> {startJobMachine?.stage} (Rate: ₹{startJobMachine?.ratePerMetre}/m)
          </Callout>

          <Select
            label="Select Active Order"
            required
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            placeholder="-- Choose an order --"
            options={availableOrders.map((ord) => ({
              value: ord.id,
              label: `${ord.orderNumber} — ${ord.buyerName} (${ord.fabricType}, ${ord.metres}m)`,
            }))}
          />

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-(--color-text)">Working Shift</label>
            <SegmentedControl
              value={selectedShift}
              onChange={setSelectedShift}
              options={(['MORNING', 'EVENING', 'NIGHT'] as Shift[]).map((sh) => ({ value: sh, label: sh }))}
              fullWidth
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-(--color-border)">
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
          <p className="text-sm text-(--color-text-dark)">
            Are you sure you want to mark the current job on{' '}
            <strong>{completeJobMachine?.name}</strong> as completed?
          </p>

          {completeJobMachine?.currentJob && (
            <div className="bg-(--color-surface-sunken) rounded-lg p-3.5 space-y-2 text-xs border border-(--color-border)">
              <div className="flex justify-between">
                <span className="text-(--color-text-muted)">Order:</span>
                <span className="font-mono font-bold text-(--color-text)">
                  {completeJobMachine.currentJob.orderNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-(--color-text-muted)">Client:</span>
                <span className="font-medium text-(--color-text)">
                  {completeJobMachine.currentJob.buyerName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-(--color-text-muted)">Metres Produced:</span>
                <span className="font-mono font-semibold text-emerald-700">
                  {completeJobMachine.currentJob.producedMetres} / {completeJobMachine.currentJob.targetMetres} m
                </span>
              </div>
            </div>
          )}

          <p className="text-xs text-(--color-text-muted)">
            Completing this stage job frees up the unit back to IDLE status and enables the order to advance to the next manufacturing stage or Quality Control.
          </p>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-(--color-border)">
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
          <Callout tone="danger">
            Reporting a breakdown pauses running work on this unit and alerts plant floor maintenance staff.
          </Callout>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-(--color-text)">
              Reason / Observed Issue
            </label>
            <textarea
              rows={3}
              value={breakdownReason}
              onChange={(e) => setBreakdownReason(e.target.value)}
              placeholder="e.g. Warp yarn tension sensor error, motor heating, heald frame misalignment..."
              className="w-full rounded-lg border border-(--color-border) bg-white py-2 px-3 text-sm text-(--color-text) focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-(--color-border)">
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
