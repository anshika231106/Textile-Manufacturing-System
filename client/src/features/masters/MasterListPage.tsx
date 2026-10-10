import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { useToast } from '../../components/ui/Toast';
import {
  listBuyers,
  createBuyer,
  listSuppliers,
  createSupplier,
  listYarnTypes,
  createYarnType,
  listMachines,
  createMachine,
  listWorkers,
  createWorker,
  type Buyer,
  type Supplier,
  type YarnType,
  type Machine,
  type Worker,
} from './masters.api';
import { Card } from '../../components/ui/Card';
import { Table, type Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Dialog } from '../../components/ui/Dialog';
import { ErrorState } from '../../components/ui/ErrorState';
import { formatCurrency } from '../../lib/format';
import {
  UsersIcon,
  TruckIcon,
  CubeIcon,
  WrenchScrewdriverIcon,
  UserGroupIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

type MasterType = 'buyers' | 'suppliers' | 'yarns' | 'machines' | 'workers';

interface TabItem {
  id: MasterType;
  label: string;
  icon: any;
  description: string;
}

const TABS: TabItem[] = [
  { id: 'buyers', label: 'Buyers', icon: UsersIcon, description: 'Textile customers and apparel manufacturing clients' },
  { id: 'suppliers', label: 'Suppliers', icon: TruckIcon, description: 'Raw cotton and synthetic yarn spinning vendors' },
  { id: 'yarns', label: 'Yarn Types', icon: CubeIcon, description: 'Material catalogue, counts, colours and minimum reorder thresholds' },
  { id: 'machines', label: 'Machines', icon: WrenchScrewdriverIcon, description: 'Spinning frames, looms and dyeing vats with operational cost rates' },
  { id: 'workers', label: 'Workers', icon: UserGroupIcon, description: 'Floor operators, masters and inspectors with daily wage rates' },
];

export function MasterListPage() {
  const { type } = useParams<{ type?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  // Normalize active master type
  let currentType: MasterType = 'buyers';
  if (type === 'suppliers') currentType = 'suppliers';
  else if (type === 'yarns' || type === 'yarn-types') currentType = 'yarns';
  else if (type === 'machines') currentType = 'machines';
  else if (type === 'workers') currentType = 'workers';

  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Form states for creation
  const [buyerForm, setBuyerForm] = useState({ name: '', contactName: '', phone: '', email: '', address: '' });
  const [supplierForm, setSupplierForm] = useState({ name: '', contactName: '', phone: '', email: '' });
  const [yarnForm, setYarnForm] = useState({ code: '', name: '', colour: '', countLabel: '', reorderLevelKg: '' });
  const [machineForm, setMachineForm] = useState({ code: '', name: '', stage: 'WEAVING' as 'SPINNING' | 'WEAVING' | 'DYEING', ratePerMetre: '' });
  const [workerForm, setWorkerForm] = useState({ code: '', name: '', phone: '', role: 'Operator', dailyWage: '' });

  // Permissions
  const canCreate = (() => {
    if (!user) return false;
    if (user.role === 'OWNER' || user.role === 'OFFICE') return true;
    if (currentType === 'suppliers' && user.role === 'STOREKEEPER') return true;
    return false;
  })();

  // Data fetching
  const { data: buyers, loading: loadingBuyers, error: errorBuyers, reload: reloadBuyers } =
    useApi(listBuyers, [currentType]);
  const { data: suppliers, loading: loadingSuppliers, error: errorSuppliers, reload: reloadSuppliers } =
    useApi(listSuppliers, [currentType]);
  const { data: yarns, loading: loadingYarns, error: errorYarns, reload: reloadYarns } =
    useApi(listYarnTypes, [currentType]);
  const { data: machines, loading: loadingMachines, error: errorMachines, reload: reloadMachines } =
    useApi(listMachines, [currentType]);
  const { data: workers, loading: loadingWorkers, error: errorWorkers, reload: reloadWorkers } =
    useApi(listWorkers, [currentType]);

  const handleTabChange = (t: MasterType) => {
    navigate(`/masters/${t}`);
    setSearchQuery('');
    setDialogOpen(false);
    setFormErrors({});
  };

  const reloadCurrent = () => {
    if (currentType === 'buyers') reloadBuyers();
    if (currentType === 'suppliers') reloadSuppliers();
    if (currentType === 'yarns') reloadYarns();
    if (currentType === 'machines') reloadMachines();
    if (currentType === 'workers') reloadWorkers();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setIsSubmitting(true);

    try {
      if (currentType === 'buyers') {
        if (!buyerForm.name.trim()) throw new Error('Buyer name is required.');
        await createBuyer({
          name: buyerForm.name.trim(),
          contactName: buyerForm.contactName.trim() || undefined,
          phone: buyerForm.phone.trim() || undefined,
          email: buyerForm.email.trim() || undefined,
          address: buyerForm.address.trim() || undefined,
        });
        showToast(`Buyer "${buyerForm.name}" created!`, 'success');
        setBuyerForm({ name: '', contactName: '', phone: '', email: '', address: '' });
        reloadBuyers();
      } else if (currentType === 'suppliers') {
        if (!supplierForm.name.trim()) throw new Error('Supplier name is required.');
        await createSupplier({
          name: supplierForm.name.trim(),
          contactName: supplierForm.contactName.trim() || undefined,
          phone: supplierForm.phone.trim() || undefined,
          email: supplierForm.email.trim() || undefined,
        });
        showToast(`Supplier "${supplierForm.name}" created!`, 'success');
        setSupplierForm({ name: '', contactName: '', phone: '', email: '' });
        reloadSuppliers();
      } else if (currentType === 'yarns') {
        if (!yarnForm.code.trim()) throw new Error('Yarn code is required.');
        if (!yarnForm.name.trim()) throw new Error('Yarn name is required.');
        if (!yarnForm.colour.trim()) throw new Error('Yarn colour is required.');
        const reorderVal = parseFloat(yarnForm.reorderLevelKg) || 0;
        await createYarnType({
          code: yarnForm.code.trim().toUpperCase(),
          name: yarnForm.name.trim(),
          colour: yarnForm.colour.trim(),
          countLabel: yarnForm.countLabel.trim() || undefined,
          reorderLevelKg: reorderVal,
        });
        showToast(`Yarn type "${yarnForm.code}" created!`, 'success');
        setYarnForm({ code: '', name: '', colour: '', countLabel: '', reorderLevelKg: '' });
        reloadYarns();
      } else if (currentType === 'machines') {
        if (!machineForm.code.trim()) throw new Error('Machine code is required.');
        if (!machineForm.name.trim()) throw new Error('Machine name is required.');
        const rateVal = parseFloat(machineForm.ratePerMetre) || 0;
        await createMachine({
          code: machineForm.code.trim().toUpperCase(),
          name: machineForm.name.trim(),
          stage: machineForm.stage,
          ratePerMetre: rateVal,
        });
        showToast(`Machine "${machineForm.code}" registered!`, 'success');
        setMachineForm({ code: '', name: '', stage: 'WEAVING', ratePerMetre: '' });
        reloadMachines();
      } else if (currentType === 'workers') {
        if (!workerForm.name.trim()) throw new Error('Worker name is required.');
        const wageVal = parseFloat(workerForm.dailyWage) || 0;
        await createWorker({
          code: workerForm.code.trim() || undefined,
          name: workerForm.name.trim(),
          phone: workerForm.phone.trim() || undefined,
          role: workerForm.role.trim(),
          dailyWage: wageVal,
        });
        showToast(`Worker "${workerForm.name}" registered!`, 'success');
        setWorkerForm({ code: '', name: '', phone: '', role: 'Operator', dailyWage: '' });
        reloadWorkers();
      }

      setDialogOpen(false);
    } catch (err: any) {
      setFormErrors({ general: err.message || 'Failed to create record.' });
      showToast(err.message || 'Validation error', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Buyer Table Columns ---
  const buyerCols: Column<Buyer>[] = [
    {
      key: 'name',
      header: 'Company / Mill Name',
      render: (r) => (
        <div>
          <span className="font-semibold text-[#1A1714]">{r.name}</span>
          {r.address && <p className="text-xs text-[#78716C]">{r.address}</p>}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Person',
      render: (r) => <span className="font-medium text-sm text-[#1A1714]">{r.contactName || '—'}</span>,
    },
    {
      key: 'phone',
      header: 'Phone Number',
      render: (r) => <span className="font-mono text-xs text-[#1A1714]">{r.phone || '—'}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (r) => <span className="text-xs text-[#78716C]">{r.email || '—'}</span>,
    },
  ];

  // --- Supplier Table Columns ---
  const supplierCols: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Supplier / Vendor',
      render: (r) => (
        <div>
          <span className="font-semibold text-[#1A1714]">{r.name}</span>
          {r.contactName && <p className="text-xs text-[#78716C]">Attn: {r.contactName}</p>}
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Contact Phone',
      render: (r) => <span className="font-mono text-xs text-[#1A1714]">{r.phone || '—'}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (r) => <span className="text-xs text-[#78716C]">{r.email || '—'}</span>,
    },
  ];

  // --- Yarn Table Columns ---
  const yarnCols: Column<YarnType>[] = [
    {
      key: 'code',
      header: 'Code & Count',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold bg-[#F5F4F2] px-2 py-0.5 rounded border border-[#E8E4DF] text-[#1A1714]">
            {r.code}
          </span>
          {r.countLabel && <span className="text-xs text-[#78716C]">({r.countLabel})</span>}
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Yarn Material',
      render: (r) => (
        <div>
          <span className="font-semibold text-sm text-[#1A1714]">{r.name}</span>
          <p className="text-xs text-[#78716C]">Shade: {r.colour}</p>
        </div>
      ),
    },
    {
      key: 'reorder',
      header: 'Reorder Level (kg)',
      align: 'right',
      render: (r) => (
        <span className="font-semibold text-sm text-[#1A1714] block text-right">
          {r.reorderLevelKg.toLocaleString('en-IN')} kg
        </span>
      ),
    },
    {
      key: 'available',
      header: 'Current Available',
      align: 'right',
      render: (r) => (
        <span className="text-sm font-medium text-[#16A34A] block text-right">
          {(r.availableKg ?? 0).toLocaleString('en-IN')} kg
        </span>
      ),
    },
  ];

  // --- Machine Table Columns ---
  const machineCols: Column<Machine>[] = [
    {
      key: 'code',
      header: 'Machine Code',
      render: (r) => (
        <span className="font-mono text-xs font-semibold bg-[#F5F4F2] px-2 py-0.5 rounded border border-[#E8E4DF] text-[#1A1714]">
          {r.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Machine Name',
      render: (r) => <span className="font-medium text-[#1A1714]">{r.name}</span>,
    },
    {
      key: 'stage',
      header: 'Production Stage',
      render: (r) => (
        <Badge
          variant="info"
          label={r.stage}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge
          variant={r.status === 'RUNNING' ? 'success' : r.status === 'BREAKDOWN' ? 'danger' : 'neutral'}
          label={r.status}
          dot
        />
      ),
    },
    {
      key: 'rate',
      header: 'Rate / Metre',
      align: 'right',
      render: (r) => (
        <span className="font-semibold text-sm text-[#1A1714] block text-right">
          {formatCurrency(r.ratePerMetre)}/m
        </span>
      ),
    },
  ];

  // --- Worker Table Columns ---
  const workerCols: Column<Worker>[] = [
    {
      key: 'code',
      header: 'Worker ID',
      render: (r) => (
        <span className="font-mono text-xs font-semibold bg-[#F5F4F2] px-2 py-0.5 rounded border border-[#E8E4DF] text-[#1A1714]">
          {r.code || 'EMP'}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Worker Name',
      render: (r) => <span className="font-semibold text-[#1A1714]">{r.name}</span>,
    },
    {
      key: 'role',
      header: 'Role / Designation',
      render: (r) => <span className="text-sm text-[#78716C]">{r.role}</span>,
    },
    {
      key: 'phone',
      header: 'Phone Number',
      render: (r) => <span className="font-mono text-xs text-[#1A1714]">{r.phone || '—'}</span>,
    },
    {
      key: 'wage',
      header: 'Daily Wage Rate',
      align: 'right',
      render: (r) => (
        <span className="font-semibold text-sm text-[#1A1714] block text-right">
          {formatCurrency(r.dailyWage)} / day
        </span>
      ),
    },
  ];

  const currentTabInfo = TABS.find((t) => t.id === currentType)!;

  // Filter lists by search query
  const filteredData = (() => {
    const q = searchQuery.toLowerCase().trim();
    if (currentType === 'buyers') {
      const list = buyers || [];
      if (!q) return list;
      return list.filter((b) => b.name.toLowerCase().includes(q) || (b.contactName && b.contactName.toLowerCase().includes(q)));
    }
    if (currentType === 'suppliers') {
      const list = suppliers || [];
      if (!q) return list;
      return list.filter((s) => s.name.toLowerCase().includes(q) || (s.contactName && s.contactName.toLowerCase().includes(q)));
    }
    if (currentType === 'yarns') {
      const list = yarns || [];
      if (!q) return list;
      return list.filter((y) => y.code.toLowerCase().includes(q) || y.name.toLowerCase().includes(q) || y.colour.toLowerCase().includes(q));
    }
    if (currentType === 'machines') {
      const list = machines || [];
      if (!q) return list;
      return list.filter((m) => m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.stage.toLowerCase().includes(q));
    }
    if (currentType === 'workers') {
      const list = workers || [];
      if (!q) return list;
      return list.filter((w) => w.name.toLowerCase().includes(q) || w.role.toLowerCase().includes(q) || (w.code && w.code.toLowerCase().includes(q)));
    }
    return [];
  })();

  const activeLoading =
    currentType === 'buyers' ? loadingBuyers :
    currentType === 'suppliers' ? loadingSuppliers :
    currentType === 'yarns' ? loadingYarns :
    currentType === 'machines' ? loadingMachines : loadingWorkers;

  const activeError =
    currentType === 'buyers' ? errorBuyers :
    currentType === 'suppliers' ? errorSuppliers :
    currentType === 'yarns' ? errorYarns :
    currentType === 'machines' ? errorMachines : errorWorkers;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1714]">Masters Management</h1>
          <p className="text-sm text-[#78716C] mt-0.5">
            Everest Textile Mills core master data for entities, inventory catalogs, machines and workforce.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={reloadCurrent}
            title="Refresh current list"
          >
            <ArrowPathIcon className="w-4 h-4 text-[#78716C]" />
          </Button>

          {canCreate && (
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setFormErrors({});
                setDialogOpen(true);
              }}
            >
              <PlusIcon className="w-4 h-4" />
              Add {currentTabInfo.label.replace(/s$/, '')}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#E8E4DF] overflow-x-auto pb-px">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === currentType;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-[#EA580C] text-[#EA580C]'
                  : 'border-transparent text-[#78716C] hover:text-[#1A1714]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-sm w-full">
          <MagnifyingGlassIcon className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Search ${currentTabInfo.label.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#E8E4DF] bg-white placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C]"
          />
        </div>

        <span className="text-xs text-[#78716C]">
          Showing {filteredData.length} records
        </span>
      </div>

      {/* Table Area */}
      {activeError ? (
        <ErrorState message={activeError.message} code={activeError.code} onRetry={reloadCurrent} />
      ) : (
        <Card className="p-0 border border-[#E8E4DF] overflow-hidden shadow-xs">
          {currentType === 'buyers' && (
            <Table
              columns={buyerCols}
              rows={filteredData as Buyer[]}
              loading={activeLoading}
              rowKey={(r) => r.id}
              emptyTitle="No buyers found"
              emptyDescription="Add textile buyers or customer accounts to begin booking fabric orders."
            />
          )}

          {currentType === 'suppliers' && (
            <Table
              columns={supplierCols}
              rows={filteredData as Supplier[]}
              loading={activeLoading}
              rowKey={(r) => r.id}
              emptyTitle="No suppliers found"
              emptyDescription="Add yarn mills or vendors to record raw material deliveries."
            />
          )}

          {currentType === 'yarns' && (
            <Table
              columns={yarnCols}
              rows={filteredData as YarnType[]}
              loading={activeLoading}
              rowKey={(r) => r.id}
              emptyTitle="No yarn types registered"
              emptyDescription="Create yarn material definitions with counts and reorder thresholds."
            />
          )}

          {currentType === 'machines' && (
            <Table
              columns={machineCols}
              rows={filteredData as Machine[]}
              loading={activeLoading}
              rowKey={(r) => r.id}
              emptyTitle="No machines registered"
              emptyDescription="Register spinning frames, looms and dyeing equipment."
            />
          )}

          {currentType === 'workers' && (
            <Table
              columns={workerCols}
              rows={filteredData as Worker[]}
              loading={activeLoading}
              rowKey={(r) => r.id}
              emptyTitle="No workers registered"
              emptyDescription="Register factory staff and technicians for attendance and wages."
            />
          )}
        </Card>
      )}

      {/* Create Dialog Modal */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={`Add New ${currentTabInfo.label.replace(/s$/, '')}`}
        width="max-w-lg"
      >
        <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
          {formErrors.general && (
            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] text-xs text-[#991B1B]">
              {formErrors.general}
            </div>
          )}

          {/* Form for Buyers */}
          {currentType === 'buyers' && (
            <>
              <Input
                label="Company / Buyer Name"
                required
                placeholder="e.g. Arvind Garments Hub"
                value={buyerForm.name}
                onChange={(e) => setBuyerForm({ ...buyerForm, name: e.target.value })}
              />
              <Input
                label="Primary Contact Person"
                placeholder="e.g. Mehul Lalbhai"
                value={buyerForm.contactName}
                onChange={(e) => setBuyerForm({ ...buyerForm, contactName: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Phone Number"
                  placeholder="e.g. 9845099887"
                  value={buyerForm.phone}
                  onChange={(e) => setBuyerForm({ ...buyerForm, phone: e.target.value })}
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="e.g. contact@arvind.com"
                  value={buyerForm.email}
                  onChange={(e) => setBuyerForm({ ...buyerForm, email: e.target.value })}
                />
              </div>
              <Input
                label="Office / Delivery Address"
                placeholder="e.g. Naroda Road, Ahmedabad"
                value={buyerForm.address}
                onChange={(e) => setBuyerForm({ ...buyerForm, address: e.target.value })}
              />
            </>
          )}

          {/* Form for Suppliers */}
          {currentType === 'suppliers' && (
            <>
              <Input
                label="Supplier / Mill Name"
                required
                placeholder="e.g. Nahar Spinning Mills Ltd"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
              />
              <Input
                label="Contact Representative"
                placeholder="e.g. Dinesh Oswal"
                value={supplierForm.contactName}
                onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Phone"
                  placeholder="e.g. 9815044332"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="e.g. sales@nahargroup.com"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                />
              </div>
            </>
          )}

          {/* Form for Yarn Types */}
          {currentType === 'yarns' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Yarn Code"
                  required
                  placeholder="e.g. COT-60-WHT"
                  value={yarnForm.code}
                  onChange={(e) => setYarnForm({ ...yarnForm, code: e.target.value })}
                />
                <Input
                  label="Count Label"
                  placeholder="e.g. 60s Comb"
                  value={yarnForm.countLabel}
                  onChange={(e) => setYarnForm({ ...yarnForm, countLabel: e.target.value })}
                />
              </div>
              <Input
                label="Yarn Description / Name"
                required
                placeholder="e.g. Cotton 60s Combed Compact"
                value={yarnForm.name}
                onChange={(e) => setYarnForm({ ...yarnForm, name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Colour / Shade"
                  required
                  placeholder="e.g. Optic White"
                  value={yarnForm.colour}
                  onChange={(e) => setYarnForm({ ...yarnForm, colour: e.target.value })}
                />
                <Input
                  label="Reorder Level (kg)"
                  required
                  type="number"
                  min="0"
                  placeholder="e.g. 100"
                  value={yarnForm.reorderLevelKg}
                  onChange={(e) => setYarnForm({ ...yarnForm, reorderLevelKg: e.target.value })}
                  hint="Triggers Low Stock warning when available falls below"
                />
              </div>
            </>
          )}

          {/* Form for Machines */}
          {currentType === 'machines' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Machine Code"
                  required
                  placeholder="e.g. LOOM-04"
                  value={machineForm.code}
                  onChange={(e) => setMachineForm({ ...machineForm, code: e.target.value })}
                />
                <Select
                  label="Production Stage"
                  options={[
                    { value: 'SPINNING', label: '1. Spinning' },
                    { value: 'WEAVING', label: '2. Weaving' },
                    { value: 'DYEING', label: '3. Dyeing' },
                  ]}
                  value={machineForm.stage}
                  onChange={(e: any) => setMachineForm({ ...machineForm, stage: e.target.value })}
                />
              </div>
              <Input
                label="Machine Name / Model"
                required
                placeholder="e.g. Tsudakoma Air-Jet Loom 4"
                value={machineForm.name}
                onChange={(e) => setMachineForm({ ...machineForm, name: e.target.value })}
              />
              <Input
                label="Machine Rate per Metre (₹)"
                required
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 28.50"
                value={machineForm.ratePerMetre}
                onChange={(e) => setMachineForm({ ...machineForm, ratePerMetre: e.target.value })}
                hint="Operational processing cost factored into fabric order costing"
              />
            </>
          )}

          {/* Form for Workers */}
          {currentType === 'workers' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Worker ID (Optional)"
                  placeholder="e.g. W-06"
                  value={workerForm.code}
                  onChange={(e) => setWorkerForm({ ...workerForm, code: e.target.value })}
                />
                <Input
                  label="Full Name"
                  required
                  placeholder="e.g. Ramdev Yadav"
                  value={workerForm.name}
                  onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Role / Designation"
                  required
                  placeholder="e.g. Master Weaver"
                  value={workerForm.role}
                  onChange={(e) => setWorkerForm({ ...workerForm, role: e.target.value })}
                />
                <Input
                  label="Phone Number"
                  placeholder="e.g. 9876543210"
                  value={workerForm.phone}
                  onChange={(e) => setWorkerForm({ ...workerForm, phone: e.target.value })}
                />
              </div>
              <Input
                label="Daily Wage (₹ / day)"
                required
                type="number"
                min="0"
                step="10"
                placeholder="e.g. 750"
                value={workerForm.dailyWage}
                onChange={(e) => setWorkerForm({ ...workerForm, dailyWage: e.target.value })}
                hint="Daily remuneration used for month-end payroll calculation"
              />
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E8E4DF]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
            >
              Save Master Record
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
