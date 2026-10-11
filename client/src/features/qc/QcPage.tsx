import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Spinner } from '../../components/ui/Spinner';
import { Callout } from '../../components/ui/Callout';
import { StatCard, StatGrid } from '../../components/ui/StatCard';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Table, type Column } from '../../components/ui/Table';
import { Card } from '../../components/ui/Card';
import { DEFAULT_PAGE_SIZE, Pagination } from '../../components/ui/Pagination';
import { formatDate, formatRelative, initialsOf, shadeSwatch } from '../../lib/format';
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
  Square3Stack3DIcon,
  ClockIcon,
  ChartBarIcon,
  TruckIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

const DEFECT_OPTIONS: { value: DefectType; label: string; description: string }[] = [
  { value: 'HOLE', label: 'Hole / Tear', description: 'Physical puncture or ruptured warp/weft yarns' },
  { value: 'COLOUR_MISMATCH', label: 'Colour Mismatch', description: 'Uneven shade, patchiness, or off-spec lab dip' },
  { value: 'UNEVEN_WEAVE', label: 'Uneven Weave / Selvedge', description: 'Tension variation, reed marks, or slack selvedge' },
  { value: 'OTHER', label: 'Other Visual Defect', description: 'Oil stain, slub irregularity, or foreign yarn debris' },
];

const VERDICT_OPTIONS: {
  value: QcResult;
  label: string;
  icon: React.ElementType;
  tone: 'success' | 'warning' | 'danger';
  description: string;
}[] = [
  { value: 'PASS', label: 'PASS', icon: CheckCircleIcon, tone: 'success', description: 'Ready for Dispatch' },
  { value: 'REWORK', label: 'REWORK', icon: WrenchIcon, tone: 'warning', description: 'Mending / Correction' },
  { value: 'REJECT', label: 'REJECT', icon: XCircleIcon, tone: 'danger', description: 'Scrap / Downgrade' },
];

// --- Table cell renderers ---

// One place for status colour: the pill and the row's left edge both read from here.
const STATUS_META: Record<
  RollStatus,
  { label: string; icon: React.ElementType; pill: string; bar: string }
> = {
  PENDING_QC: {
    label: 'Pending QC',
    icon: ClockIcon,
    pill: 'bg-(--color-warning-light) text-(--color-warning) ring-(--color-warning-border)',
    bar: 'bg-(--color-warning)',
  },
  PASSED: {
    label: 'Passed',
    icon: CheckCircleIcon,
    pill: 'bg-(--color-success-light) text-(--color-success) ring-(--color-success-border)',
    bar: 'bg-(--color-success)',
  },
  REWORK: {
    label: 'Rework',
    icon: WrenchIcon,
    pill: 'bg-(--color-accent-light) text-(--color-accent) ring-(--color-accent)/40',
    bar: 'bg-(--color-accent)',
  },
  REJECTED: {
    label: 'Rejected',
    icon: XCircleIcon,
    pill: 'bg-(--color-danger-light) text-(--color-danger) ring-(--color-danger-border)',
    bar: 'bg-(--color-danger)',
  },
  DISPATCHED: {
    label: 'Dispatched',
    icon: TruckIcon,
    pill: 'bg-(--color-surface-sunken) text-(--color-text-muted) ring-(--color-border)',
    bar: 'bg-(--color-text-subtle)',
  },
};

const DEFECT_LABELS: Record<DefectType, string> = {
  HOLE: 'Hole / Tear',
  COLOUR_MISMATCH: 'Colour mismatch',
  UNEVEN_WEAVE: 'Uneven weave',
  OTHER: 'Other defect',
};

function StatusPill({ status }: { status: RollStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${meta.pill}`}
    >
      <Icon className={`h-3.5 w-3.5 ${status === 'PENDING_QC' ? 'animate-pulse-subtle' : ''}`} />
      {meta.label}
    </span>
  );
}

function InspectionCell({ roll }: { roll: QcRollItem }) {
  let detail;
  if (roll.defectType) {
    detail = (
      <span className="w-full truncate text-xs text-(--color-text-muted)" title={roll.notes}>
        <span className="font-medium text-(--color-danger)">{DEFECT_LABELS[roll.defectType]}</span>
        {roll.notes && <> · {roll.notes}</>}
      </span>
    );
  } else if (roll.lastResult === 'PASS') {
    detail = <span className="text-xs text-(--color-text-muted)">Grade A quality</span>;
  } else {
    detail = <span className="text-xs italic text-(--color-text-subtle)">Awaiting first inspection</span>;
  }
  return (
    <div className="flex max-w-60 min-w-0 flex-col items-start gap-1.5">
      <StatusPill status={roll.status} />
      {detail}
    </div>
  );
}

// Stored names look like "Suresh Patil (SUPERVISOR)"; show the name and keep the role as a hint.
function InspectorCell({ name, at }: { name?: string; at?: string }) {
  if (!name) return <span className="text-xs text-(--color-text-subtle)">Not yet inspected</span>;
  const [, person = name, role] = name.match(/^(.*?)\s*(?:\((.+)\))?$/) ?? [];
  return (
    <div className="flex min-w-0 items-center gap-2.5" title={role ? `${person} · ${role}` : person}>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--color-surface-sunken) text-[11px] font-bold text-(--color-text-muted) ring-1 ring-(--color-border)"
        aria-hidden
      >
        {initialsOf(person)}
      </span>
      <div className="min-w-0">
        <p className="truncate whitespace-nowrap text-sm font-medium text-(--color-text)">{person}</p>
        {at && <p className="whitespace-nowrap text-xs text-(--color-text-subtle)">{formatRelative(at)}</p>}
      </div>
    </div>
  );
}

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
  const [page, setPage] = useState(0);
  const pageSize = DEFAULT_PAGE_SIZE;

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

  const pageCount = Math.ceil(filteredRolls.length / pageSize);
  const visiblePage = Math.min(page, Math.max(pageCount - 1, 0));
  const paginatedRolls = filteredRolls.slice(visiblePage * pageSize, (visiblePage + 1) * pageSize);

  const statusTabOptions: { value: 'ALL' | RollStatus; label: string; count: number }[] = [
    { value: 'ALL', label: 'All Rolls', count: stats.totalRolls },
    { value: 'PENDING_QC', label: 'Pending QC', count: stats.pendingQc },
    { value: 'PASSED', label: 'Passed', count: stats.passed },
    { value: 'REWORK', label: 'Rework', count: stats.rework },
    { value: 'REJECTED', label: 'Rejected', count: stats.rejected },
  ];

  const rollColumns: Column<QcRollItem>[] = [
    {
      key: 'roll',
      header: 'Roll',
      className: 'relative pl-6',
      render: (roll) => (
        <>
          <span
            className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${STATUS_META[roll.status].bar}`}
            aria-hidden
          />
          <Link
            to={`/rolls/${roll.id}`}
            className="whitespace-nowrap font-mono text-sm font-semibold text-(--color-text) hover:text-(--color-accent) transition-colors"
          >
            {roll.rollNo}
          </Link>
          <p className="whitespace-nowrap text-xs text-(--color-text-subtle)" title={formatDate(roll.createdAt)}>
            Created {formatRelative(roll.createdAt)}
          </p>
        </>
      ),
    },
    {
      key: 'order',
      header: 'Order',
      render: (roll) => (
        <div className="min-w-0">
          <p className="whitespace-nowrap font-mono text-sm font-medium text-(--color-text)">{roll.orderNumber}</p>
          <p className="max-w-48 truncate text-xs text-(--color-text-muted)">{roll.buyerName}</p>
        </div>
      ),
    },
    {
      key: 'fabric',
      header: 'Fabric',
      render: (roll) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-4 w-4 shrink-0 rounded-full ring-1 ring-(--color-border) shadow-inner"
            style={{ backgroundColor: shadeSwatch(roll.colour) ?? 'transparent' }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="max-w-44 truncate text-sm text-(--color-text)">{roll.fabricType}</p>
            <p className="text-xs text-(--color-text-muted)">{roll.colour}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'length',
      header: 'Length',
      align: 'right',
      render: (roll) => (
        <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-(--color-text)">
          {roll.metres.toLocaleString('en-IN')}
          <span className="ml-1 text-xs font-normal text-(--color-text-subtle)">m</span>
        </span>
      ),
    },
    {
      key: 'machines',
      header: 'Machines',
      className: 'hidden xl:table-cell',
      render: (roll) => (
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 text-xs">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-(--color-text-subtle)">Loom</dt>
          <dd className="truncate text-(--color-text-dark)">{roll.weavingMachineName}</dd>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-(--color-text-subtle)">Dye</dt>
          <dd className="truncate text-(--color-text-dark)">{roll.dyeingMachineName}</dd>
        </dl>
      ),
    },
    {
      key: 'inspection',
      header: 'Inspection',
      render: (roll) => <InspectionCell roll={roll} />,
    },
    {
      key: 'inspector',
      header: 'Inspector',
      className: 'hidden lg:table-cell',
      render: (roll) => <InspectorCell name={roll.inspectorName} at={roll.inspectedAt} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (roll) => {
        const needsAction = roll.status === 'PENDING_QC' || roll.status === 'REWORK';
        return (
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            <Link
              to={`/rolls/${roll.id}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-(--color-text-muted) hover:text-(--color-accent) hover:bg-(--color-accent-light) transition-colors"
              title="Trace roll"
              aria-label={`Trace ${roll.rollNo}`}
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </Link>
            <Button
              size="sm"
              variant={needsAction ? 'primary' : 'ghost'}
              onClick={() => openInspection(roll)}
              className={`min-w-28 rounded-full text-xs ${needsAction ? '' : 'ring-1 ring-inset ring-(--color-border)'}`}
            >
              <ShieldCheckIcon className="h-4 w-4" />
              {roll.status === 'PENDING_QC' ? 'Inspect' : 'Re-inspect'}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-(--color-border)">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-(--color-text) tracking-tight">
              Quality Control & Roll Inspection
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-(--color-accent-light) text-(--color-accent) border border-(--color-accent)/30">
              QC Station
            </span>
          </div>
          <p className="text-sm text-(--color-text-muted) mt-1">
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
            <ArrowPathIcon className="w-4 h-4 text-(--color-text-muted)" />
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
      <StatGrid columns={6}>
        <StatCard icon={Square3Stack3DIcon} label="Total Rolls" value={stats.totalRolls} sub="Woven batches" tone="neutral" />
        <StatCard
          icon={ClockIcon}
          label="Pending QC"
          value={stats.pendingQc}
          sub="Awaiting inspection"
          tone="warning"
          live={stats.pendingQc > 0}
        />
        <StatCard icon={CheckCircleIcon} label="Passed" value={stats.passed} sub="Ready for dispatch" tone="success" />
        <StatCard icon={WrenchIcon} label="In Rework" value={stats.rework} sub="Mending required" tone="warning" />
        <StatCard icon={XCircleIcon} label="Rejected" value={stats.rejected} sub="Scrap / downgraded" tone="danger" />
        <StatCard icon={ChartBarIcon} label="Pass Rate" value={`${stats.passRate}%`} sub="Inspection yield" tone="info" />
      </StatGrid>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-(--color-border) p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        {/* Status Tabs */}
        <div className="w-full md:w-auto overflow-x-auto">
          <SegmentedControl
            value={selectedStatusTab}
            onChange={(v) => {
              setSelectedStatusTab(v);
              setPage(0);
            }}
            options={statusTabOptions}
            size="sm"
          />
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <MagnifyingGlassIcon className="w-4 h-4 text-(--color-text-subtle) absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search roll, order, buyer..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            className="w-full text-xs rounded-lg border border-(--color-border) bg-white py-2 pl-9 pr-3 text-(--color-text) placeholder-(--color-text-subtle) focus:outline-none focus:ring-1 focus:ring-(--color-accent)"
          />
        </div>
      </div>

      {/* Main QC Rolls Queue Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-(--color-text-muted)">
          <Spinner />
          <p className="text-sm mt-3 font-medium">Loading roll inspection queue...</p>
        </div>
      ) : filteredRolls.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-(--color-border) p-12 text-center text-sm text-(--color-text-muted) space-y-3">
          <p className="font-semibold text-(--color-text-dark)">No rolls match current filter criteria.</p>
          <p className="text-xs text-(--color-text-subtle)">
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
        <Card className="overflow-hidden p-0">
          <Table bare columns={rollColumns} rows={paginatedRolls} rowKey={(r) => r.id} />
          <Pagination
            page={visiblePage}
            pageSize={pageSize}
            totalCount={filteredRolls.length}
            itemLabel="rolls"
            onPageChange={setPage}
          />
        </Card>
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
            <div className="p-3 bg-(--color-surface-sunken) rounded-xl border border-(--color-border) text-xs space-y-1.5 text-(--color-text-dark)">
              <div className="flex justify-between font-semibold">
                <span className="font-mono text-(--color-text)">{inspectingRoll.rollNo}</span>
                <span className="font-mono text-(--color-success)">{inspectingRoll.metres} metres</span>
              </div>
              <div className="flex justify-between">
                <span>Order:</span>
                <span className="font-mono font-medium text-(--color-text)">{inspectingRoll.orderNumber} ({inspectingRoll.buyerName})</span>
              </div>
              <div className="flex justify-between text-(--color-text-muted)">
                <span>Fabric Spec:</span>
                <span>{inspectingRoll.fabricType} • {inspectingRoll.colour}</span>
              </div>
            </div>
          )}

          {/* Verdict Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
              QC Inspection Verdict <span className="text-(--color-danger)">*</span>
            </label>
            <SegmentedControl
              value={qcResult}
              onChange={(v) => {
                setQcResult(v);
                if (v === 'PASS') setDefectType('');
              }}
              options={VERDICT_OPTIONS}
              fullWidth
              size="md"
            />
          </div>

          {/* Defect Type selector (Visible & Required unless PASS) */}
          {qcResult !== 'PASS' && (
            <Callout tone="danger" title="Primary Defect Observed *">
              <p className="mb-2 text-[11px]">(Required for non-pass verdicts)</p>
              <div className="space-y-1.5">
                {DEFECT_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                      defectType === opt.value
                        ? 'bg-(--color-danger-light) border-(--color-danger) text-(--color-text) font-medium'
                        : 'bg-white border-(--color-border) text-(--color-text-dark) hover:bg-(--color-surface-alt)'
                    }`}
                  >
                    <input
                      type="radio"
                      name="defectType"
                      value={opt.value}
                      checked={defectType === opt.value}
                      onChange={() => setDefectType(opt.value)}
                      className="mt-0.5 accent-(--color-danger)"
                    />
                    <div className="text-xs">
                      <div className="font-semibold">{opt.label}</div>
                      <div className="text-[11px] text-(--color-text-muted)">{opt.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </Callout>
          )}

          {/* Observations and notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
              Inspection Notes / Lab Observations
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Minor warp slub observed between 35m - 40m; selvedge tightness within acceptable tolerance..."
              className="w-full rounded-lg border border-(--color-border) bg-white py-2 px-3 text-xs text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
            />
          </div>

          {/* Inspector footer info */}
          <div className="flex items-center justify-between text-xs text-(--color-text-muted) pt-2">
            <span>Inspector: <strong className="text-(--color-text)">{user?.name || 'Suresh Patil'}</strong></span>
            <span>Role: <strong className="text-(--color-text)">{user?.role || 'SUPERVISOR'}</strong></span>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-(--color-border)">
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
