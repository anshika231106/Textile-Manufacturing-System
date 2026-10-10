import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Callout } from '../../components/ui/Callout';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Table, type Column } from '../../components/ui/Table';
import { formatCurrency, formatDate, formatTimestamp } from '../../lib/format';
import { getRollTrace, type RollTraceData } from './rolls.api';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  WrenchIcon,
  TruckIcon,
  ClockIcon,
  CubeIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon,
  TagIcon,
  UserIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';

type YarnItem = RollTraceData['yarnIssued'][0];
type LogItem = RollTraceData['productionLogs'][0];

export function RollTracePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<RollTraceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchCode, setSearchCode] = useState('');
  const [activeTab, setActiveTab] = useState<'TIMELINE' | 'YARN' | 'MACHINES' | 'QC' | 'DISPATCH'>('TIMELINE');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getRollTrace(id)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.error('Failed to load roll trace:', err);
        setError(err.message || `Unable to locate roll "${id}" in factory records.`);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchCode.trim()) {
      navigate(`/rolls/${encodeURIComponent(searchCode.trim().toUpperCase())}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASSED':
        return <Badge variant="success" label="QC PASSED" dot />;
      case 'DISPATCHED':
        return <Badge variant="info" label="DISPATCHED" dot />;
      case 'REWORK':
        return <Badge variant="warning" label="REWORK REQUIRED" dot />;
      case 'REJECTED':
        return <Badge variant="danger" label="QC REJECTED" dot />;
      case 'PENDING_QC':
      default:
        return <Badge variant="neutral" label="PENDING QC" dot />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Spinner size="lg" />
        <p className="text-sm font-medium text-slate-500">Retrieving full genealogy and roll audit trail...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 py-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeftIcon className="w-4 h-4 mr-1.5" /> Back
        </Button>
        <Callout tone="danger" title="Roll Not Found">
          {error || `Roll "${id}" could not be found.`}
        </Callout>
        <Card className="p-6 text-center space-y-4">
          <p className="text-sm text-slate-600">
            Search for another roll code (e.g., <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">ROLL-0001</code>):
          </p>
          <form onSubmit={handleSearch} className="flex max-w-sm mx-auto gap-2">
            <input
              type="text"
              placeholder="Enter Roll No..."
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg text-sm bg-white border-slate-200"
            />
            <Button type="submit" variant="primary">Search</Button>
          </form>
        </Card>
      </div>
    );
  }

  const { roll, order, yarnIssued, stageJobs, productionLogs, qcHistory, dispatch } = data;
  const latestQc = qcHistory[qcHistory.length - 1];

  const yarnColumns: Column<YarnItem>[] = [
    {
      key: 'code',
      header: 'Yarn Code / Spec',
      render: (y) => (
        <div>
          <span className="font-semibold text-slate-900">{y.yarnCode}</span>
          <div className="text-xs text-slate-500">{y.yarnName} ({y.colour})</div>
        </div>
      ),
    },
    {
      key: 'kg',
      header: 'Issued Quantity',
      render: (y) => <span className="font-mono">{y.kg} kg</span>,
    },
    {
      key: 'rate',
      header: 'Issue Rate',
      render: (y) => `${formatCurrency(y.ratePerKg)}/kg`,
    },
    {
      key: 'total',
      header: 'Cost Subtotal',
      render: (y) => <span className="font-semibold">{formatCurrency(y.totalCost)}</span>,
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (y) => y.reference || '—',
    },
    {
      key: 'date',
      header: 'Date & Issuer',
      render: (y) => (
        <div className="text-xs">
          <div>{formatDate(y.occurredAt)}</div>
          <div className="text-slate-400">{y.issuedByName}</div>
        </div>
      ),
    },
  ];

  const shiftLogColumns: Column<LogItem>[] = [
    {
      key: 'stage',
      header: 'Stage',
      render: (l) => <Badge variant="neutral" label={l.stage} />,
    },
    {
      key: 'machine',
      header: 'Machine',
      render: (l) => <span className="font-medium text-slate-800">{l.machineCode} ({l.machineName})</span>,
    },
    {
      key: 'shift',
      header: 'Shift',
      render: (l) => <span className="font-medium">{l.shift}</span>,
    },
    {
      key: 'metres',
      header: 'Output Metres',
      render: (l) => <span className="font-mono font-semibold">{l.metres} m</span>,
    },
    {
      key: 'operator',
      header: 'Operator',
      render: (l) => l.operatorName,
    },
    {
      key: 'time',
      header: 'Logged At',
      render: (l) => formatTimestamp(l.loggedAt),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-fade-in">
      {/* Top Breadcrumb & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeftIcon className="w-4 h-4 mr-1" /> Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">{roll.rollNo}</h1>
              {getStatusBadge(roll.status)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Cut piece of Order <Link to={`/orders/${order.id}`} className="text-indigo-600 hover:underline font-semibold">{order.orderNo}</Link> • Created {formatTimestamp(roll.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="relative hidden md:block">
            <input
              type="text"
              placeholder="Jump to roll..."
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-36 focus:w-48 transition-all"
            />
            <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
          </form>

          <Link to={`/track/${order.trackingToken}`} target="_blank">
            <Button variant="secondary" size="sm">
              <ArrowTopRightOnSquareIcon className="w-4 h-4 mr-1.5" /> Buyer Tracking
            </Button>
          </Link>
          <Link to={`/orders/${order.id}`}>
            <Button variant="secondary" size="sm">
              <DocumentTextIcon className="w-4 h-4 mr-1.5" /> Order View
            </Button>
          </Link>
          <Link to={`/rolls/${roll.id}/label`}>
            <Button variant="primary" size="sm">
              <PrinterIcon className="w-4 h-4 mr-1.5" /> Print Label
            </Button>
          </Link>
        </div>
      </div>

      {/* Hero Overview Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-indigo-500 bg-gradient-to-br from-indigo-50/40 to-white">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <CubeIcon className="w-4 h-4 text-indigo-600" /> Roll Specification
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-1">{roll.metres} <span className="text-sm font-normal text-slate-600">metres</span></div>
          <div className="text-xs text-slate-600 mt-1 truncate">{order.fabricType} ({order.colour})</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50/40 to-white">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <UserIcon className="w-4 h-4 text-blue-600" /> Buyer & Order
          </div>
          <div className="text-lg font-bold text-slate-900 truncate mt-1">{order.buyer.name}</div>
          <div className="text-xs text-slate-600 mt-1">Order: <span className="font-mono font-medium">{order.orderNo}</span> ({order.metres}m total)</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50/40 to-white">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheckIcon className="w-4 h-4 text-emerald-600" /> Quality Control
          </div>
          <div className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
            {latestQc ? (
              <>
                <span className={latestQc.result === 'PASS' ? 'text-emerald-700' : latestQc.result === 'REWORK' ? 'text-amber-700' : 'text-red-700'}>
                  {latestQc.result}
                </span>
                {latestQc.defectType && <Badge variant="warning" label={latestQc.defectType} />}
              </>
            ) : (
              <span className="text-slate-400 font-normal text-sm">Awaiting Inspection</span>
            )}
          </div>
          <div className="text-xs text-slate-600 mt-1">
            {latestQc ? `Checked by ${latestQc.inspector.name}` : 'In QC Queue'}
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50/40 to-white">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <TruckIcon className="w-4 h-4 text-purple-600" /> Logistics Status
          </div>
          <div className="text-lg font-bold text-slate-900 mt-1">
            {dispatch ? (
              <span className="text-purple-700 font-mono">{dispatch.dispatchNo}</span>
            ) : (
              <span className="text-slate-500 font-normal text-sm">On Factory Floor</span>
            )}
          </div>
          <div className="text-xs text-slate-600 mt-1">
            {dispatch?.invoice ? `Invoice: ${dispatch.invoice.invoiceNo} (${dispatch.invoice.status})` : 'Not yet dispatched'}
          </div>
        </Card>
      </div>

      {/* Tabs Control */}
      <SegmentedControl
        value={activeTab}
        onChange={(val) => setActiveTab(val as any)}
        options={[
          { value: 'TIMELINE', label: 'Genealogy Timeline' },
          { value: 'YARN', label: `Raw Materials (${yarnIssued.length})` },
          { value: 'MACHINES', label: `Machines & Shifts (${productionLogs.length})` },
          { value: 'QC', label: `QC History (${qcHistory.length})` },
          { value: 'DISPATCH', label: 'Dispatch & Billing' },
        ]}
      />

      {/* TAB 1: INTERACTIVE TIMELINE */}
      {activeTab === 'TIMELINE' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-indigo-600" />
            Complete Birth-to-Dispatch Journey
          </h2>

          <div className="relative border-l-2 border-indigo-200 ml-4 sm:ml-6 pl-6 sm:pl-8 space-y-8">
            {/* Step 1: Order Booking */}
            <div className="relative">
              <span className="absolute -left-[35px] sm:-left-[43px] top-0 flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white shadow-md">
                <DocumentTextIcon className="w-4 h-4" />
              </span>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm">Stage 1: Order Confirmed & Yarn Allocated</h3>
                  <span className="text-xs text-slate-500">{order.startedAt ? formatDate(order.startedAt) : 'Pending'}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Buyer <strong className="text-slate-800">{order.buyer.name}</strong> placed order <strong className="font-mono text-slate-800">{order.orderNo}</strong> for {order.metres}m of {order.fabricType} ({order.colour}).
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {yarnIssued.map((y) => (
                    <span key={y.id} className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-slate-200 font-mono text-slate-700">
                      <TagIcon className="w-3.5 h-3.5 text-indigo-500" /> {y.kg}kg {y.yarnCode} issued by {y.issuedByName}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 2: Loom Weaving */}
            <div className="relative">
              <span className="absolute -left-[35px] sm:-left-[43px] top-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white shadow-md">
                <CpuChipIcon className="w-4 h-4" />
              </span>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm">Stage 2: Weaving Loom Processing</h3>
                  <Badge variant="info" label={`Weaving Loom: ${roll.weavingMachine.code}`} />
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Warp & weft insertion executed on <strong className="text-slate-800">{roll.weavingMachine.name} ({roll.weavingMachine.code})</strong>.
                </p>
                <div className="mt-2 bg-white rounded-lg p-2.5 border border-slate-200 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Active Shift Production: </span>
                  {productionLogs.filter(p => p.stage === 'WEAVING').length > 0 ? (
                    productionLogs.filter(p => p.stage === 'WEAVING').map(p => `${p.shift} Shift (${p.metres}m by ${p.operatorName})`).join(' • ')
                  ) : (
                    'Run recorded under primary loom logs.'
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Dyeing & Finishing */}
            <div className="relative">
              <span className="absolute -left-[35px] sm:-left-[43px] top-0 flex items-center justify-center w-8 h-8 rounded-full bg-cyan-600 text-white shadow-md">
                <CpuChipIcon className="w-4 h-4" />
              </span>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm">Stage 3: Dyeing & Chemical Finishing</h3>
                  <Badge variant="info" label={`Dyeing Vat: ${roll.dyeingMachine.code}`} />
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Wet-processing and shade application executed in <strong className="text-slate-800">{roll.dyeingMachine.name} ({roll.dyeingMachine.code})</strong> for shade <strong className="text-slate-800">{order.colour}</strong>.
                </p>
              </div>
            </div>

            {/* Step 4: Roll Cut & Serialized */}
            <div className="relative">
              <span className="absolute -left-[35px] sm:-left-[43px] top-0 flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-white shadow-md">
                <CubeIcon className="w-4 h-4" />
              </span>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm">Stage 4: Roll Tagged & Measured</h3>
                  <span className="text-xs text-slate-500">{formatTimestamp(roll.createdAt)}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Fabric piece of <strong className="font-mono text-slate-900">{roll.metres} metres</strong> offloaded from line and serialized with unique ID <strong className="font-mono text-indigo-700">{roll.rollNo}</strong>. Created by <span className="font-medium text-slate-700">{roll.createdBy.name}</span>.
                </p>
              </div>
            </div>

            {/* Step 5: Quality Inspection */}
            <div className="relative">
              <span className={`absolute -left-[35px] sm:-left-[43px] top-0 flex items-center justify-center w-8 h-8 rounded-full text-white shadow-md ${latestQc?.result === 'PASS' ? 'bg-emerald-600' : latestQc?.result === 'REWORK' ? 'bg-amber-600' : latestQc?.result === 'REJECT' ? 'bg-red-600' : 'bg-slate-400'}`}>
                {latestQc?.result === 'PASS' ? <CheckCircleIcon className="w-4 h-4" /> : latestQc?.result === 'REWORK' ? <WrenchIcon className="w-4 h-4" /> : latestQc?.result === 'REJECT' ? <XCircleIcon className="w-4 h-4" /> : <ClockIcon className="w-4 h-4" />}
              </span>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm">Stage 5: Quality Control Inspection</h3>
                  {latestQc ? (
                    <Badge
                      variant={latestQc.result === 'PASS' ? 'success' : latestQc.result === 'REWORK' ? 'warning' : 'danger'}
                      label={`QC ${latestQc.result}`}
                    />
                  ) : (
                    <Badge variant="neutral" label="Pending Inspection" />
                  )}
                </div>
                {latestQc ? (
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    <p>
                      Inspected by <strong className="text-slate-800">{latestQc.inspector.name}</strong> on {formatTimestamp(latestQc.checkedAt)}.
                    </p>
                    {latestQc.defectType && (
                      <p className="text-amber-800 font-medium">
                        Identified Defect: {latestQc.defectType.replace('_', ' ')}
                      </p>
                    )}
                    {latestQc.notes && (
                      <p className="italic text-slate-600 bg-white p-2 rounded border border-slate-200">
                        "{latestQc.notes}"
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">Roll is awaiting QA inspection on the floor.</p>
                )}
              </div>
            </div>

            {/* Step 6: Dispatch & Invoicing */}
            <div className="relative">
              <span className={`absolute -left-[35px] sm:-left-[43px] top-0 flex items-center justify-center w-8 h-8 rounded-full text-white shadow-md ${dispatch ? 'bg-purple-600' : 'bg-slate-300'}`}>
                <TruckIcon className="w-4 h-4" />
              </span>
              <div className={`p-4 rounded-xl border shadow-xs ${dispatch ? 'bg-purple-50/40 border-purple-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm">Stage 6: Dispatch & Invoicing</h3>
                  {dispatch ? <Badge variant="info" label={`Manifest: ${dispatch.dispatchNo}`} /> : <Badge variant="neutral" label="Not Yet Dispatched" />}
                </div>
                {dispatch ? (
                  <div className="mt-2 space-y-1 text-xs text-slate-700">
                    <p>
                      Loaded on vehicle <strong className="font-mono text-slate-900">{dispatch.vehicleNo || 'Direct Transport'}</strong> on {formatTimestamp(dispatch.dispatchedAt)}.
                    </p>
                    <p>
                      Dispatched by: <span className="font-medium">{dispatch.dispatchedByName}</span>
                    </p>
                    {dispatch.invoice && (
                      <div className="mt-2 p-2 bg-white rounded border border-purple-200 flex items-center justify-between font-mono">
                        <span>Invoice: {dispatch.invoice.invoiceNo}</span>
                        <span className="font-bold">{formatCurrency(dispatch.invoice.amount)} ({dispatch.invoice.status})</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">
                    {roll.status === 'PASSED'
                      ? 'Roll has passed QC and is in finished goods store, ready for truck loading.'
                      : 'Roll cannot be dispatched until quality inspection is completed and marked PASSED.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 2: RAW MATERIALS (YARN) */}
      {activeTab === 'YARN' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Yarn Batches Issued to Order {order.orderNo}</h2>
            <Badge variant="neutral" label={`${yarnIssued.length} Issue Transactions`} />
          </div>
          {yarnIssued.length > 0 ? (
            <Table
              rows={yarnIssued}
              rowKey={(y) => y.id}
              columns={yarnColumns}
            />
          ) : (
            <Callout tone="neutral">No yarn issue movements recorded yet for this order.</Callout>
          )}
        </Card>
      )}

      {/* TAB 3: MACHINES & SHIFT LOGS */}
      {activeTab === 'MACHINES' && (
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Production Stage Jobs</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stageJobs.map((j) => (
                <div key={j.id} className={`p-4 rounded-xl border ${j.isWeavingMachineForThisRoll || j.isDyeingMachineForThisRoll ? 'border-indigo-500 bg-indigo-50/20 shadow-xs ring-1 ring-indigo-500/20' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center justify-between">
                    <Badge variant="neutral" label={j.stage} />
                    <Badge
                      variant={j.status === 'COMPLETED' ? 'success' : j.status === 'RUNNING' ? 'info' : 'neutral'}
                      label={j.status}
                    />
                  </div>
                  <div className="font-bold text-slate-900 mt-2 font-mono text-base">{j.machineCode}</div>
                  <div className="text-xs text-slate-500">{j.machineName}</div>
                  <div className="mt-3 text-xs text-slate-600 border-t pt-2 border-slate-100 flex justify-between">
                    <span>Started: {formatDate(j.startedAt)}</span>
                    {j.endedAt && <span>Ended: {formatDate(j.endedAt)}</span>}
                  </div>
                  {(j.isWeavingMachineForThisRoll || j.isDyeingMachineForThisRoll) && (
                    <div className="mt-2 text-[11px] font-semibold text-indigo-700 bg-indigo-100/60 px-2 py-0.5 rounded text-center">
                      ★ Active machine for this roll
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Shift Production Output Logs</h2>
              <Badge variant="neutral" label={`${productionLogs.length} Shifts`} />
            </div>
            {productionLogs.length > 0 ? (
              <Table
                rows={productionLogs}
                rowKey={(l) => l.id}
                columns={shiftLogColumns}
              />
            ) : (
              <Callout tone="neutral">No shift production logs recorded for this order yet.</Callout>
            )}
          </Card>
        </div>
      )}

      {/* TAB 4: QC HISTORY */}
      {activeTab === 'QC' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">QC Inspection History</h2>
            <Badge variant="neutral" label={`${qcHistory.length} Checks`} />
          </div>
          {qcHistory.length > 0 ? (
            <div className="space-y-3">
              {qcHistory.map((q, idx) => (
                <div key={q.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-slate-200 font-mono text-xs flex items-center justify-center font-bold text-slate-700">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={q.result === 'PASS' ? 'success' : q.result === 'REWORK' ? 'warning' : 'danger'}
                          label={q.result}
                        />
                        {q.defectType && <Badge variant="warning" label={q.defectType} />}
                      </div>
                      {q.notes && <p className="text-xs text-slate-600 mt-1 italic">"{q.notes}"</p>}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 sm:text-right">
                    <div>Inspected by <strong className="text-slate-700">{q.inspector.name}</strong></div>
                    <div>{formatTimestamp(q.checkedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Callout tone="neutral">No QC inspections performed yet. Roll is currently PENDING_QC.</Callout>
          )}
        </Card>
      )}

      {/* TAB 5: DISPATCH & BILLING */}
      {activeTab === 'DISPATCH' && (
        <Card className="p-6 space-y-6">
          <h2 className="text-lg font-semibold text-slate-900">Dispatch Manifest & Invoice</h2>
          {dispatch ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Dispatch Record</h3>
                  <Badge variant="info" label={dispatch.dispatchNo} />
                </div>
                <div className="text-xs space-y-2 text-slate-600">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>Vehicle Number:</span>
                    <span className="font-mono font-medium text-slate-800">{dispatch.vehicleNo || 'Direct Transport'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>Dispatched Timestamp:</span>
                    <span>{formatTimestamp(dispatch.dispatchedAt)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>Authorized Operator:</span>
                    <span className="font-medium text-slate-800">{dispatch.dispatchedByName}</span>
                  </div>
                </div>
              </div>

              {dispatch.invoice ? (
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Tax Invoice</h3>
                    <Badge
                      variant={dispatch.invoice.status === 'PAID' ? 'success' : 'warning'}
                      label={dispatch.invoice.status}
                    />
                  </div>
                  <div className="text-xs space-y-2 text-slate-600">
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span>Invoice Number:</span>
                      <span className="font-mono font-bold text-slate-800">{dispatch.invoice.invoiceNo}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span>Total Invoiced Amount:</span>
                      <span className="font-bold text-slate-900">{formatCurrency(dispatch.invoice.amount)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span>Payments Received:</span>
                      <span className="text-emerald-700 font-semibold">{formatCurrency(dispatch.invoice.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span>Issued At:</span>
                      <span>{formatDate(dispatch.invoice.issuedAt)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex items-center justify-center text-xs text-slate-500">
                  No invoice record linked to this dispatch.
                </div>
              )}
            </div>
          ) : (
            <Callout tone="neutral">
              This roll has not been dispatched yet. When loaded and confirmed for shipping, vehicle details, dispatch number, and matching customer invoice will automatically display here.
            </Callout>
          )}
        </Card>
      )}
    </div>
  );
}
