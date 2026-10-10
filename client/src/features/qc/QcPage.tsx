import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/ui/Toast';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Spinner } from '../../components/ui/Spinner';
import {
  getQcQueue,
  recordResult,
  calculateQcStats,
  type QcRollItem,
  type RollStatus,
  type QcResult,
  type DefectType,
  type QcStats,
} from './qc.api';
import { CreateRollForm } from './CreateRollForm';
import {
  PlusIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  WrenchIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

const DEFECT_OPTIONS: { value: DefectType; label: string; description: string }[] = [
  { value: 'HOLE', label: 'Hole / Tear', description: 'Physical puncture or ruptured warp/weft yarns' },
  { value: 'COLOUR_MISMATCH', label: 'Colour Mismatch', description: 'Uneven shade, patchiness, or off-spec lab dip' },
  { value: 'UNEVEN_WEAVE', label: 'Uneven Weave / Selvedge', description: 'Tension variation, reed marks, or slack selvedge' },
  { value: 'OTHER', label: 'Other Visual Defect', description: 'Oil stain, slub irregularity, or foreign yarn debris' },
];

export function QcPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rolls, setRolls] = useState<QcRollItem[]>([]);
  const [stats, setStats] = useState<QcStats>({
    totalRolls: 0,
    pendingQc: 0,
    passed: 0,
    rework: 0,
    rejected: 0,
    passRate: 100,
  });

  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStatusTab, setSelectedStatusTab] = useState<'ALL' | RollStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Inspection modal state
  const [inspectingRoll, setInspectingRoll] = useState<QcRollItem | null>(null);
  const [qcResult, setQcResult] = useState<QcResult>('PASS');
  const [defectType, setDefectType] = useState<DefectType | ''>('');
  const [notes, setNotes] = useState('');
  const [submittingResult, setSubmittingResult] = useState(false);

  const loadQueue = async () => {
    try {
      setLoading(true);
      const data = await getQcQueue();
      setRolls(data);
      setStats(calculateQcStats(data));
    } catch (err) {
      console.error('Failed to load QC queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const openInspection = (roll: QcRollItem) => {
    setInspectingRoll(roll);
    setQcResult(roll.lastResult || 'PASS');
    setDefectType(roll.defectType || '');
    setNotes(roll.notes || '');
  };

  const handleRecordResult = async () => {
    if (!inspectingRoll) return;

    if (qcResult !== 'PASS' && !defectType) {
      showToast('Please select a defect type for Rework or Reject verdicts', 'error');
      return;
    }

    try {
      setSubmittingResult(true);
      await recordResult(inspectingRoll.id, {
        result: qcResult,
        defectType: qcResult === 'PASS' ? undefined : (defectType as DefectType),
        notes: notes.trim() || undefined,
        inspectorName: user?.name ? `${user.name} (${user.role})` : undefined,
      });

      showToast(`Recorded ${qcResult} verdict for roll ${inspectingRoll.rollNo}`, 'success');
      setInspectingRoll(null);
      await loadQueue();
    } catch (err: any) {
      showToast(err.message || 'Failed to submit inspection verdict', 'error');
    } finally {
      setSubmittingResult(false);
    }
  };

  // Filter rolls
  const filteredRolls = useMemo(() => {
    return rolls.filter((r) => {
      if (selectedStatusTab !== 'ALL' && r.status !== selectedStatusTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRoll = r.rollNo.toLowerCase().includes(q);
        const matchOrder = r.orderNumber.toLowerCase().includes(q) || r.buyerName.toLowerCase().includes(q);
        const matchFabric = r.fabricType.toLowerCase().includes(q) || r.colour.toLowerCase().includes(q);
        if (!matchRoll && !matchOrder && !matchFabric) return false;
      }
      return true;
    });
  }, [rolls, selectedStatusTab, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#E8E4DF]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[#1A1714] tracking-tight">
              Quality Control & Roll Inspection
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              QC Station
            </span>
          </div>
          <p className="text-sm text-[#78716C] mt-1">
            Inspect woven and dyed fabric rolls, record defect categories, and approve rolls for dispatch.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadQueue()}
            className="text-xs"
          >
            <ArrowPathIcon className="w-4 h-4 text-[#78716C]" />
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="text-xs shadow-xs"
          >
            <PlusIcon className="w-4 h-4" />
            Create Fabric Roll
          </Button>
        </div>
      </div>

      {/* QC Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3.5">
        <div className="bg-white rounded-xl border border-[#E8E4DF] p-3.5 shadow-2xs">
          <div className="text-xs font-medium text-[#78716C] uppercase tracking-wider">Total Rolls</div>
          <div className="text-2xl font-bold text-[#1A1714] mt-1 font-mono">{stats.totalRolls}</div>
          <div className="text-[11px] text-[#A8A29E] mt-0.5">Woven batches</div>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 p-3.5 shadow-2xs bg-amber-50/30">
          <div className="text-xs font-medium text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
            <span>Pending QC</span>
            {stats.pendingQc > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            )}
          </div>
          <div className="text-2xl font-bold text-amber-900 mt-1 font-mono">{stats.pendingQc}</div>
          <div className="text-[11px] text-amber-700 mt-0.5">Awaiting inspection</div>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 p-3.5 shadow-2xs bg-emerald-50/30">
          <div className="text-xs font-medium text-emerald-800 uppercase tracking-wider">Passed</div>
          <div className="text-2xl font-bold text-emerald-900 mt-1 font-mono">{stats.passed}</div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Ready for dispatch</div>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 p-3.5 shadow-2xs bg-amber-50/20">
          <div className="text-xs font-medium text-amber-700 uppercase tracking-wider">In Rework</div>
          <div className="text-2xl font-bold text-amber-800 mt-1 font-mono">{stats.rework}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">Mending required</div>
        </div>

        <div className="bg-white rounded-xl border border-rose-200 p-3.5 shadow-2xs bg-rose-50/30">
          <div className="text-xs font-medium text-rose-800 uppercase tracking-wider">Rejected</div>
          <div className="text-2xl font-bold text-rose-900 mt-1 font-mono">{stats.rejected}</div>
          <div className="text-[11px] text-rose-700 mt-0.5">Scrap / downgraded</div>
        </div>

        <div className="bg-white rounded-xl border border-blue-200 p-3.5 shadow-2xs bg-blue-50/30">
          <div className="text-xs font-medium text-blue-800 uppercase tracking-wider">Pass Rate</div>
          <div className="text-2xl font-bold text-blue-900 mt-1 font-mono">{stats.passRate}%</div>
          <div className="text-[11px] text-blue-700 mt-0.5">Inspection yield</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-[#E8E4DF] p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { key: 'ALL', label: 'All Rolls', count: stats.totalRolls },
            { key: 'PENDING_QC', label: 'Pending QC', count: stats.pendingQc },
            { key: 'PASSED', label: 'Passed', count: stats.passed },
            { key: 'REWORK', label: 'Rework', count: stats.rework },
            { key: 'REJECTED', label: 'Rejected', count: stats.rejected },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedStatusTab(tab.key as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                selectedStatusTab === tab.key
                  ? 'bg-[#1A1714] text-white shadow-2xs'
                  : 'bg-[#F5F4F2] text-[#78716C] hover:bg-[#E8E4DF] hover:text-[#1A1714]'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                selectedStatusTab === tab.key ? 'bg-white/20 text-white' : 'bg-black/5 text-[#78716C]'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <MagnifyingGlassIcon className="w-4 h-4 text-[#A8A29E] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search roll, order, buyer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs rounded-lg border border-[#E8E4DF] bg-white py-2 pl-9 pr-3 text-[#1A1714] placeholder-[#A8A29E] focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
          />
        </div>
      </div>

      {/* Main QC Rolls Queue Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#78716C]">
          <Spinner />
          <p className="text-sm mt-3 font-medium">Loading roll inspection queue...</p>
        </div>
      ) : filteredRolls.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#E8E4DF] p-12 text-center text-sm text-[#78716C] space-y-3">
          <p className="font-semibold text-[#44403C]">No rolls match current filter criteria.</p>
          <p className="text-xs text-[#A8A29E]">
            Create a new roll using the button above or change your filter selection.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowCreateModal(true)}
            className="mt-2"
          >
            Create Fabric Roll
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8E4DF] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E8E4DF] bg-[#FBFBFA] text-[#78716C] font-semibold">
                  <th className="py-3 px-4">Roll Identifier</th>
                  <th className="py-3 px-4">Linked Order</th>
                  <th className="py-3 px-4 text-right">Length</th>
                  <th className="py-3 px-4">Machine Sources</th>
                  <th className="py-3 px-4">QC Status</th>
                  <th className="py-3 px-4">Last Result / Defects</th>
                  <th className="py-3 px-4">Inspector</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F4F2]">
                {filteredRolls.map((roll) => {
                  const isPending = roll.status === 'PENDING_QC';
                  const isPassed = roll.status === 'PASSED';
                  const isRework = roll.status === 'REWORK';
                  const isRejected = roll.status === 'REJECTED';

                  return (
                    <tr
                      key={roll.id}
                      className="hover:bg-[#FBFBFA] transition-colors"
                    >
                      {/* Roll Code */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-sm text-[#1A1714]">
                          {roll.rollNo}
                        </div>
                        <div className="text-[11px] text-[#A8A29E]">
                          Created: {new Date(roll.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Linked Order */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-semibold text-[#1A1714]">
                          {roll.orderNumber}
                        </div>
                        <div className="text-[11px] font-medium text-[#44403C]">
                          {roll.buyerName}
                        </div>
                        <div className="text-[11px] text-[#78716C]">
                          {roll.fabricType} ({roll.colour})
                        </div>
                      </td>

                      {/* Length in metres */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-[#1A1714] whitespace-nowrap">
                        {roll.metres} <span className="text-xs font-sans font-normal text-[#78716C]">m</span>
                      </td>

                      {/* Machines */}
                      <td className="py-3.5 px-4 text-[11px]">
                        <div className="text-[#44403C]">
                          <span className="text-[#78716C]">Loom:</span> {roll.weavingMachineName}
                        </div>
                        <div className="text-[#44403C] mt-0.5">
                          <span className="text-[#78716C]">Dyeing:</span> {roll.dyeingMachineName}
                        </div>
                      </td>

                      {/* QC Status Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isPending && <Badge variant="warning" label="PENDING QC" dot />}
                        {isPassed && <Badge variant="success" label="PASSED" dot />}
                        {isRework && <Badge variant="warning" label="REWORK" dot />}
                        {isRejected && <Badge variant="danger" label="REJECTED" dot />}
                        {roll.status === 'DISPATCHED' && <Badge variant="info" label="DISPATCHED" />}
                      </td>

                      {/* Last Result & Defects */}
                      <td className="py-3.5 px-4">
                        {roll.defectType ? (
                          <div className="space-y-0.5">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              {roll.defectType.replace('_', ' ')}
                            </span>
                            {roll.notes && (
                              <p className="text-[11px] text-[#78716C] line-clamp-1 italic max-w-xs">
                                "{roll.notes}"
                              </p>
                            )}
                          </div>
                        ) : roll.lastResult === 'PASS' ? (
                          <div className="text-emerald-700 font-medium text-xs flex items-center gap-1">
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                            Grade A Quality
                          </div>
                        ) : (
                          <span className="text-[#A8A29E] italic text-[11px]">Not inspected yet</span>
                        )}
                      </td>

                      {/* Inspector */}
                      <td className="py-3.5 px-4 text-[11px] text-[#78716C] whitespace-nowrap">
                        {roll.inspectorName ? (
                          <div>
                            <div className="text-[#1A1714] font-medium">{roll.inspectorName}</div>
                            {roll.inspectedAt && (
                              <div className="text-[10px] text-[#A8A29E]">
                                {new Date(roll.inspectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#A8A29E]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant={isPending || isRework ? 'primary' : 'secondary'}
                          onClick={() => openInspection(roll)}
                          className="text-xs shadow-2xs"
                        >
                          <ShieldCheckIcon className="w-3.5 h-3.5" />
                          {isPending ? 'Inspect' : 'Re-inspect'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Fabric Roll Dialog */}
      <Dialog
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Fabric Roll for QC"
      >
        <CreateRollForm
          onRollCreated={() => {
            setShowCreateModal(false);
            loadQueue();
          }}
          onCancel={() => setShowCreateModal(false)}
        />
      </Dialog>

      {/* Inspect Roll Dialog */}
      <Dialog
        open={!!inspectingRoll}
        onClose={() => setInspectingRoll(null)}
        title={`Inspect Fabric Roll — ${inspectingRoll?.rollNo}`}
      >
        <div className="space-y-4">
          {/* Roll Context Banner */}
          {inspectingRoll && (
            <div className="p-3 bg-[#F5F4F2] rounded-xl border border-[#E8E4DF] text-xs space-y-1.5 text-[#44403C]">
              <div className="flex justify-between font-semibold">
                <span className="font-mono text-[#1A1714]">{inspectingRoll.rollNo}</span>
                <span className="font-mono text-emerald-800">{inspectingRoll.metres} metres</span>
              </div>
              <div className="flex justify-between">
                <span>Order:</span>
                <span className="font-mono font-medium text-[#1A1714]">{inspectingRoll.orderNumber} ({inspectingRoll.buyerName})</span>
              </div>
              <div className="flex justify-between text-[#78716C]">
                <span>Fabric Spec:</span>
                <span>{inspectingRoll.fabricType} • {inspectingRoll.colour}</span>
              </div>
            </div>
          )}

          {/* Verdict Radio Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
              QC Inspection Verdict <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {/* Pass */}
              <button
                type="button"
                onClick={() => {
                  setQcResult('PASS');
                  setDefectType('');
                }}
                className={`p-3 rounded-xl border text-center transition-all ${
                  qcResult === 'PASS'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-[#44403C] border-[#E8E4DF] hover:border-emerald-300'
                }`}
              >
                <CheckCircleIcon className="w-5 h-5 mx-auto mb-1" />
                <div className="text-xs font-bold">PASS</div>
                <div className="text-[10px] opacity-80 mt-0.5">Ready for Dispatch</div>
              </button>

              {/* Rework */}
              <button
                type="button"
                onClick={() => setQcResult('REWORK')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  qcResult === 'REWORK'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-white text-[#44403C] border-[#E8E4DF] hover:border-amber-300'
                }`}
              >
                <WrenchIcon className="w-5 h-5 mx-auto mb-1" />
                <div className="text-xs font-bold">REWORK</div>
                <div className="text-[10px] opacity-80 mt-0.5">Mending / Correction</div>
              </button>

              {/* Reject */}
              <button
                type="button"
                onClick={() => setQcResult('REJECT')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  qcResult === 'REJECT'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white text-[#44403C] border-[#E8E4DF] hover:border-rose-300'
                }`}
              >
                <XCircleIcon className="w-5 h-5 mx-auto mb-1" />
                <div className="text-xs font-bold">REJECT</div>
                <div className="text-[10px] opacity-80 mt-0.5">Scrap / Downgrade</div>
              </button>
            </div>
          </div>

          {/* Defect Type selector (Visible & Required unless PASS) */}
          {qcResult !== 'PASS' && (
            <div className="space-y-2 p-3 bg-rose-50/50 rounded-xl border border-rose-200">
              <label className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center justify-between">
                <span>Primary Defect Observed <span className="text-rose-600">*</span></span>
                <span className="text-[10px] font-normal lowercase">(Required for non-pass verdicts)</span>
              </label>

              <div className="space-y-1.5">
                {DEFECT_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                      defectType === opt.value
                        ? 'bg-rose-100/70 border-rose-400 text-rose-950 font-medium'
                        : 'bg-white border-[#E8E4DF] text-[#44403C] hover:bg-[#FBFBFA]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="defectType"
                      value={opt.value}
                      checked={defectType === opt.value}
                      onChange={() => setDefectType(opt.value)}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div className="text-xs">
                      <div className="font-semibold">{opt.label}</div>
                      <div className="text-[11px] text-[#78716C]">{opt.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Observations and notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
              Inspection Notes / Lab Observations
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Minor warp slub observed between 35m - 40m; selvedge tightness within acceptable tolerance..."
              className="w-full rounded-lg border border-[#E8E4DF] bg-white py-2 px-3 text-xs text-[#1A1714] focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
            />
          </div>

          {/* Inspector footer info */}
          <div className="flex items-center justify-between text-xs text-[#78716C] pt-2">
            <span>Inspector: <strong className="text-[#1A1714]">{user?.name || 'Suresh Patil'}</strong></span>
            <span>Role: <strong className="text-[#1A1714]">{user?.role || 'SUPERVISOR'}</strong></span>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E8E4DF]">
            <Button
              variant="secondary"
              onClick={() => setInspectingRoll(null)}
              disabled={submittingResult}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={submittingResult}
              onClick={handleRecordResult}
              className={
                qcResult === 'PASS'
                  ? 'bg-emerald-600 hover:bg-emerald-700 border-transparent shadow-xs'
                  : qcResult === 'REWORK'
                  ? 'bg-amber-600 hover:bg-amber-700 border-transparent shadow-xs'
                  : 'bg-rose-600 hover:bg-rose-700 border-transparent shadow-xs'
              }
            >
              Save {qcResult} Verdict
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
