import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#E8E4DF]">
        <div className="flex items-center gap-3">
          <Link
            to="/floor"
            className="p-2 rounded-lg border border-[#E8E4DF] bg-white text-[#78716C] hover:text-[#1A1714] hover:bg-[#F5F4F2] transition-colors"
            title="Back to Floor Board"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1714] tracking-tight">
              Production Shift Log
            </h1>
            <p className="text-sm text-[#78716C] mt-0.5">
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
        <div className="flex flex-col items-center justify-center py-24 text-[#78716C]">
          <Spinner />
          <p className="text-sm mt-3 font-medium">Loading floor units & shift records...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Log Entry Form */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#F5F4F2]">
              <ClipboardDocumentCheckIcon className="w-5 h-5 text-[#EA580C]" />
              <h2 className="text-base font-semibold text-[#1A1714]">
                New Production Shift Entry
              </h2>
            </div>

            {runningMachines.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#E8E4DF] p-6 text-center text-sm text-[#78716C] space-y-2">
                <p className="font-medium text-[#44403C]">No active jobs running on the floor.</p>
                <p className="text-xs text-[#A8A29E]">
                  To log output, start a job on one of the idle machines from the Floor Board.
                </p>
                <Link to="/floor" className="inline-block mt-2">
                  <Button size="sm" variant="secondary">Go to Machine Floor</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Select Running Machine */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
                    Select Running Machine & Job <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedMachineId}
                    onChange={(e) => setSelectedMachineId(e.target.value)}
                    className="w-full rounded-lg border border-[#E8E4DF] bg-white py-2.5 px-3 text-sm text-[#1A1714] focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                    required
                  >
                    {runningMachines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} - {m.name} ({m.currentJob?.orderNumber} • {m.stage})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Machine Context Banner */}
                {currentSelectedMachine?.currentJob && (
                  <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs text-amber-900 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-amber-950">
                        {currentSelectedMachine.currentJob.orderNumber}
                      </span>
                      <Badge variant="warning" label={currentSelectedMachine.stage} />
                    </div>
                    <div className="text-[#44403C]">
                      <strong>Client:</strong> {currentSelectedMachine.currentJob.buyerName}
                    </div>
                    <div className="text-[#44403C]">
                      <strong>Fabric:</strong> {currentSelectedMachine.currentJob.fabricType} ({currentSelectedMachine.currentJob.colour})
                    </div>
                    <div className="pt-1 flex justify-between text-[#78716C] border-t border-amber-200/50">
                      <span>Target: <strong>{currentSelectedMachine.currentJob.targetMetres} m</strong></span>
                      <span>Produced so far: <strong className="text-emerald-700">{currentSelectedMachine.currentJob.producedMetres} m</strong></span>
                    </div>
                  </div>
                )}

                {/* Shift Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
                    Production Shift
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'MORNING', label: 'Morning', hours: '06:00 - 14:00' },
                      { key: 'EVENING', label: 'Evening', hours: '14:00 - 22:00' },
                      { key: 'NIGHT', label: 'Night', hours: '22:00 - 06:00' },
                    ].map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setShift(s.key as Shift)}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          shift === s.key
                            ? 'bg-[#1A1714] text-white border-[#1A1714] shadow-xs'
                            : 'bg-white text-[#78716C] border-[#E8E4DF] hover:border-[#A8A29E]'
                        }`}
                      >
                        <div className="text-xs font-bold leading-tight">{s.label}</div>
                        <div className="text-[10px] opacity-75 mt-0.5">{s.hours}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Metres Produced */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
                    Metres Produced this Shift <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={metres}
                      onChange={(e) => setMetres(e.target.value)}
                      placeholder="e.g. 350"
                      className="w-full rounded-lg border border-[#E8E4DF] bg-white py-2.5 pl-3.5 pr-12 text-sm text-[#1A1714] font-mono focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                      required
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs font-semibold text-[#78716C]">
                      metres
                    </span>
                  </div>
                </div>

                {/* Optional Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
                    Shift Observations / Operator Notes
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Minor stop for bobbin change at 10:30; weaving quality optimal..."
                    className="w-full rounded-lg border border-[#E8E4DF] bg-white py-2 px-3 text-xs text-[#1A1714] focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
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
          <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F5F4F2]">
              <div className="flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-[#78716C]" />
                <h2 className="text-base font-semibold text-[#1A1714]">
                  Recent Shift Logs Today
                </h2>
              </div>
              <span className="text-xs font-medium text-[#78716C]">
                {recentLogs.length} entries recorded
              </span>
            </div>

            {recentLogs.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#78716C]">
                No production logs recorded today yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E8E4DF] text-[#78716C] font-semibold">
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Shift</th>
                      <th className="py-2.5 px-3">Machine</th>
                      <th className="py-2.5 px-3">Order</th>
                      <th className="py-2.5 px-3 text-right">Metres</th>
                      <th className="py-2.5 px-3">Logged By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F4F2]">
                    {recentLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#FBFBFA] transition-colors">
                        <td className="py-3 px-3 text-[#78716C] whitespace-nowrap">
                          {new Date(log.loggedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#F5F4F2] text-[#44403C]">
                            {log.shift}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-[#1A1714]">
                            {log.machineCode}
                          </div>
                          <div className="text-[11px] text-[#78716C] truncate max-w-[120px]">
                            {log.machineName}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono font-medium text-[#1A1714]">
                            {log.orderNumber}
                          </div>
                          <div className="text-[11px] text-[#78716C]">
                            {log.stage}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          +{log.metres.toLocaleString()} m
                        </td>
                        <td className="py-3 px-3 text-[#78716C]">
                          {log.createdByName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
