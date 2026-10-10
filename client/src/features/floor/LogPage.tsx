import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Callout } from '../../components/ui/Callout';
import { Select } from '../../components/ui/Select';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Table, type Column } from '../../components/ui/Table';
import {
  getBoard,
  logProduction,
  getProductionLogs,
  type FloorMachine,
  type Shift,
  type ProductionLogItem,
} from './floor.api';
import {
  ClipboardDocumentCheckIcon,
  ArrowLeftIcon,
  ClockIcon,
  CpuChipIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

const SHIFT_OPTIONS: { value: Shift; label: string; description: string }[] = [
  { value: 'MORNING', label: 'Morning', description: '06:00 - 14:00' },
  { value: 'EVENING', label: 'Evening', description: '14:00 - 22:00' },
  { value: 'NIGHT', label: 'Night', description: '22:00 - 06:00' },
];

export function LogPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const preselectedMachineId = searchParams.get('machineId');

  const [loading, setLoading] = useState(true);
  const [runningMachines, setRunningMachines] = useState<FloorMachine[]>([]);
  const [recentLogs, setRecentLogs] = useState<ProductionLogItem[]>([]);

  // Form states
  const [selectedMachineId, setSelectedMachineId] = useState(preselectedMachineId || '');
  const [shift, setShift] = useState<Shift>('MORNING');
  const [metres, setMetres] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load running machines & recent logs
  const loadData = async () => {
    try {
      setLoading(true);
      const [boardData, logsData] = await Promise.all([
        getBoard(),
        getProductionLogs(25),
      ]);

      // All machines or active ones
      const running = boardData.machines.filter((m) => m.status === 'RUNNING' && m.currentJob);
      setRunningMachines(running);
      setRecentLogs(logsData);

      if (!selectedMachineId && running.length > 0) {
        if (preselectedMachineId && running.some((m) => m.id === preselectedMachineId)) {
          setSelectedMachineId(preselectedMachineId);
        } else {
          setSelectedMachineId(running[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading log page data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentSelectedMachine = runningMachines.find((m) => m.id === selectedMachineId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMachineId) {
      showToast('Please select a running machine / job', 'error');
      return;
    }

    const metresNum = parseFloat(metres);
    if (isNaN(metresNum) || metresNum <= 0) {
      showToast('Please enter a valid positive metre quantity', 'error');
      return;
    }

    if (!currentSelectedMachine?.currentJob) {
      showToast('Selected machine does not have an active job', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await logProduction(
        {
          machineId: selectedMachineId,
          orderId: currentSelectedMachine.currentJob.orderId,
          stageJobId: currentSelectedMachine.currentJob.id,
          stage: currentSelectedMachine.stage,
          shift,
          metres: metresNum,
          notes: notes.trim() || undefined,
        },
        user?.name || 'Supervisor'
      );

      showToast(`Recorded ${metresNum}m for ${currentSelectedMachine.name}`, 'success');

      // Reset form
      setMetres('');
      setNotes('');

      // Refresh recent logs
      const updatedLogs = await getProductionLogs(25);
      setRecentLogs(updatedLogs);
    } catch (err: any) {
      showToast(err.message || 'Failed to record production log', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const logColumns: Column<ProductionLogItem>[] = [
    {
      key: 'time',
      header: 'Time',
      render: (log) => (
        <span className="text-(--color-text-muted) whitespace-nowrap">
          {new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
    {
      key: 'shift',
      header: 'Shift',
      render: (log) => (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-(--color-surface-sunken) text-(--color-text-dark)">
          {log.shift}
        </span>
      ),
    },
    {
      key: 'machine',
      header: 'Machine',
      render: (log) => (
        <div>
          <div className="font-semibold text-(--color-text)">{log.machineCode}</div>
          <div className="text-[11px] text-(--color-text-muted) truncate max-w-[120px]">{log.machineName}</div>
        </div>
      ),
    },
    {
      key: 'order',
      header: 'Order',
      render: (log) => (
        <div>
          <div className="font-mono font-medium text-(--color-text)">{log.orderNumber}</div>
          <div className="text-[11px] text-(--color-text-muted)">{log.stage}</div>
        </div>
      ),
    },
    {
      key: 'metres',
      header: 'Metres',
      align: 'right',
      render: (log) => (
        <span className="font-mono font-bold text-emerald-700 whitespace-nowrap">
          +{log.metres.toLocaleString()} m
        </span>
      ),
    },
    {
      key: 'loggedBy',
      header: 'Logged By',
      render: (log) => <span className="text-(--color-text-muted)">{log.createdByName}</span>,
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-(--color-border)">
        <div className="flex items-center gap-3">
          <Link
            to="/floor"
            className="p-2 rounded-lg border border-(--color-border) bg-white text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-sunken) transition-colors"
            title="Back to Floor Board"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-(--color-text) tracking-tight">
              Production Shift Log
            </h1>
            <p className="text-sm text-(--color-text-muted) mt-0.5">
              Record inspected metres produced during plant shifts per machine and active job.
            </p>
          </div>
        </div>

        <Link to="/floor">
          <Button variant="secondary" size="sm" className="text-xs">
            <CpuChipIcon className="w-4 h-4" />
            View Live Machine Floor
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-(--color-text-muted)">
          <Spinner />
          <p className="text-sm mt-3 font-medium">Loading floor units & shift records...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Log Entry Form */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-(--color-border) p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-(--color-surface-sunken)">
              <ClipboardDocumentCheckIcon className="w-5 h-5 text-(--color-accent)" />
              <h2 className="text-base font-semibold text-(--color-text)">
                New Production Shift Entry
              </h2>
            </div>

            {runningMachines.length === 0 ? (
              <div className="rounded-xl border border-dashed border-(--color-border) p-6 text-center text-sm text-(--color-text-muted) space-y-2">
                <p className="font-medium text-(--color-text-dark)">No active jobs running on the floor.</p>
                <p className="text-xs text-(--color-text-subtle)">
                  To log output, start a job on one of the idle machines from the Floor Board.
                </p>
                <Link to="/floor" className="inline-block mt-2">
                  <Button size="sm" variant="secondary">Go to Machine Floor</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Select Running Machine */}
                <Select
                  label="Select Running Machine & Job"
                  required
                  value={selectedMachineId}
                  onChange={(e) => setSelectedMachineId(e.target.value)}
                  options={runningMachines.map((m) => ({
                    value: m.id,
                    label: `${m.code} - ${m.name} (${m.currentJob?.orderNumber} • ${m.stage})`,
                  }))}
                />

                {/* Selected Machine Context Banner */}
                {currentSelectedMachine?.currentJob && (
                  <Callout tone="warning">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-semibold text-amber-950">
                        {currentSelectedMachine.currentJob.orderNumber}
                      </span>
                      <Badge variant="warning" label={currentSelectedMachine.stage} />
                    </div>
                    <div className="text-(--color-text-dark)">
                      <strong>Client:</strong> {currentSelectedMachine.currentJob.buyerName}
                    </div>
                    <div className="text-(--color-text-dark)">
                      <strong>Fabric:</strong> {currentSelectedMachine.currentJob.fabricType} ({currentSelectedMachine.currentJob.colour})
                    </div>
                    <div className="pt-1.5 mt-1.5 flex justify-between border-t border-amber-200/50">
                      <span>Target: <strong>{currentSelectedMachine.currentJob.targetMetres} m</strong></span>
                      <span>Produced so far: <strong className="text-emerald-700">{currentSelectedMachine.currentJob.producedMetres} m</strong></span>
                    </div>
                  </Callout>
                )}

                {/* Shift Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                    Production Shift
                  </label>
                  <SegmentedControl value={shift} onChange={setShift} options={SHIFT_OPTIONS} fullWidth />
                </div>

                {/* Metres Produced */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                    Metres Produced this Shift <span className="text-(--color-danger)">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={metres}
                      onChange={(e) => setMetres(e.target.value)}
                      placeholder="e.g. 350"
                      className="w-full rounded-lg border border-(--color-border) bg-white py-2.5 pl-3.5 pr-12 text-sm text-(--color-text) font-mono focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
                      required
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs font-semibold text-(--color-text-muted)">
                      metres
                    </span>
                  </div>
                </div>

                {/* Optional Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
                    Shift Observations / Operator Notes
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Minor stop for bobbin change at 10:30; weaving quality optimal..."
                    className="w-full rounded-lg border border-(--color-border) bg-white py-2 px-3 text-xs text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={submitting}
                    className="w-full py-2.5 text-sm shadow-xs"
                  >
                    <SparklesIcon className="w-4 h-4" />
                    Record Metres to Order
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Recent Shift Logs Table */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-(--color-border) p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-(--color-surface-sunken)">
              <div className="flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-(--color-text-muted)" />
                <h2 className="text-base font-semibold text-(--color-text)">
                  Recent Shift Logs Today
                </h2>
              </div>
              <span className="text-xs font-medium text-(--color-text-muted)">
                {recentLogs.length} entries recorded
              </span>
            </div>

            <Table
              columns={logColumns}
              rows={recentLogs}
              rowKey={(log) => log.id}
              emptyTitle="No production logs yet"
              emptyDescription="No production logs recorded today yet."
            />
          </div>
        </div>
      )}
    </div>
  );
}
