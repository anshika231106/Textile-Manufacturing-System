import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { useToast } from '../../components/ui/Toast';
import {
  listBuyers,
  createBuyer,
  updateBuyer,
  deleteBuyer,
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  listYarnTypes,
  createYarnType,
  updateYarnType,
  deleteYarnType,
  listMachines,
  createMachine,
  updateMachine,
  deleteMachine,
  type Buyer,
  type Supplier,
  type YarnType,
  type Machine,
} from './masters.api';
import { Card } from '../../components/ui/Card';
import { Table, type Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Dialog } from '../../components/ui/Dialog';
import { ErrorState } from '../../components/ui/ErrorState';
import { Callout } from '../../components/ui/Callout';
import { formatCurrency } from '../../lib/format';
import {
  UsersIcon,
  TruckIcon,
  CubeIcon,
  WrenchScrewdriverIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  TrashIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';

// Workers are managed in Staff Management (people) and Attendance (daily wages).
type MasterType = 'buyers' | 'suppliers' | 'yarns' | 'machines';

interface DeleteTarget {
  type: MasterType;
  id: string;
  label: string;
}

const EMPTY_BUYER_FORM = { name: '', contactName: '', phone: '', email: '', address: '' };
const EMPTY_SUPPLIER_FORM = { name: '', contactName: '', phone: '', email: '' };
const EMPTY_YARN_FORM = { code: '', name: '', colour: '', countLabel: '', reorderLevelKg: '' };
const EMPTY_MACHINE_FORM = { code: '', name: '', stage: 'WEAVING' as 'SPINNING' | 'WEAVING' | 'DYEING', ratePerMetre: '' };

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

  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  // Id of the record being edited; null while the dialog is adding a new record.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states for creation
  const [buyerForm, setBuyerForm] = useState(EMPTY_BUYER_FORM);
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER_FORM);
  const [yarnForm, setYarnForm] = useState(EMPTY_YARN_FORM);
  const [machineForm, setMachineForm] = useState(EMPTY_MACHINE_FORM);

  // Permissions
  // Editing follows the same roles as creating.
  const canCreate = (() => {
    if (!user) return false;
    if (user.role === 'OWNER' || user.role === 'OFFICE') return true;
    if (currentType === 'suppliers' && user.role === 'SUPERVISOR') return true;
    return false;
  })();
  const canDelete = user?.role === 'OWNER' || user?.role === 'OFFICE';

  // Data fetching
  const { data: buyers, loading: loadingBuyers, error: errorBuyers, reload: reloadBuyers } =
    useApi(listBuyers, [currentType]);
  const { data: suppliers, loading: loadingSuppliers, error: errorSuppliers, reload: reloadSuppliers } =
    useApi(listSuppliers, [currentType]);
  const { data: yarns, loading: loadingYarns, error: errorYarns, reload: reloadYarns } =
    useApi(listYarnTypes, [currentType]);
  const { data: machines, loading: loadingMachines, error: errorMachines, reload: reloadMachines } =
    useApi(listMachines, [currentType]);

  const handleTabChange = (t: MasterType) => {
    navigate(`/masters/${t}`);
    setSearchQuery('');
    setDialogOpen(false);
    setEditingId(null);
    setFormErrors({});
  };

  const resetForms = () => {
    setBuyerForm(EMPTY_BUYER_FORM);
    setSupplierForm(EMPTY_SUPPLIER_FORM);
    setYarnForm(EMPTY_YARN_FORM);
    setMachineForm(EMPTY_MACHINE_FORM);
  };

  const openCreate = () => {
    resetForms();
    setEditingId(null);
    setFormErrors({});
    setDialogOpen(true);
  };

  const openEdit = (row: Buyer | Supplier | YarnType | Machine) => {
    resetForms();
    if (currentType === 'buyers') {
      const r = row as Buyer;
      setBuyerForm({
        name: r.name,
        contactName: r.contactName ?? '',
        phone: r.phone ?? '',
        email: r.email ?? '',
        address: r.address ?? '',
      });
    } else if (currentType === 'suppliers') {
      const r = row as Supplier;
      setSupplierForm({ name: r.name, contactName: r.contactName ?? '', phone: r.phone ?? '', email: r.email ?? '' });
    } else if (currentType === 'yarns') {
      const r = row as YarnType;
      setYarnForm({
        code: r.code,
        name: r.name,
        colour: r.colour,
        countLabel: r.countLabel ?? '',
        reorderLevelKg: String(r.reorderLevelKg),
      });
    } else {
      const r = row as Machine;
      setMachineForm({ code: r.code, name: r.name, stage: r.stage, ratePerMetre: String(r.ratePerMetre) });
    }
    setEditingId(row.id);
    setFormErrors({});
    setDialogOpen(true);
  };

  const reloadCurrent = () => {
    if (currentType === 'buyers') reloadBuyers();
    if (currentType === 'suppliers') reloadSuppliers();
    if (currentType === 'yarns') reloadYarns();
    if (currentType === 'machines') reloadMachines();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      if (deleteTarget.type === 'buyers') {
        await deleteBuyer(deleteTarget.id);
        reloadBuyers();
      } else if (deleteTarget.type === 'suppliers') {
        await deleteSupplier(deleteTarget.id);
        reloadSuppliers();
      } else if (deleteTarget.type === 'yarns') {
        await deleteYarnType(deleteTarget.id);
        reloadYarns();
      } else {
        await deleteMachine(deleteTarget.id);
        reloadMachines();
      }
      showToast(`"${deleteTarget.label}" deleted.`, 'success');
      setDeleteTarget(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete record.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Trailing edit / delete buttons, shown per the user's permissions.
  function actionsColumn<T extends Buyer | Supplier | YarnType | Machine>(
    type: MasterType,
    getLabel: (row: T) => string
  ): Column<T>[] {
    if (!canCreate && !canDelete) return [];
    return [
      {
        key: 'actions',
        header: '',
        align: 'right',
        render: (r) => (
          <div className="flex justify-end gap-1">
            {canCreate && (
              <button
                type="button"
                onClick={() => openEdit(r)}
                className="p-1 text-(--color-text-muted) hover:text-(--color-accent) rounded hover:bg-(--color-surface-sunken) transition-colors"
                title="Edit"
                aria-label={`Edit ${getLabel(r)}`}
              >
                <PencilSquareIcon className="w-4 h-4" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  setDeleteError('');
                  setDeleteTarget({ type, id: r.id, label: getLabel(r) });
                }}
                className="p-1 text-(--color-text-muted) hover:text-(--color-danger) rounded hover:bg-(--color-danger-light) transition-colors"
                title="Delete"
                aria-label={`Delete ${getLabel(r)}`}
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        ),
      },
    ];
  }

  // Blank optional fields are sent as '' so an edit can clear them; the server stores null.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setIsSubmitting(true);

    try {
      if (currentType === 'buyers') {
        if (!buyerForm.name.trim()) throw new Error('Buyer name is required.');
        const input = {
          name: buyerForm.name.trim(),
          contactName: buyerForm.contactName.trim(),
          phone: buyerForm.phone.trim(),
          email: buyerForm.email.trim(),
          address: buyerForm.address.trim(),
        };
        if (editingId) await updateBuyer(editingId, input);
        else await createBuyer(input);
        showToast(`Buyer "${input.name}" ${editingId ? 'updated' : 'created'}!`, 'success');
        setBuyerForm(EMPTY_BUYER_FORM);
        reloadBuyers();
      } else if (currentType === 'suppliers') {
        if (!supplierForm.name.trim()) throw new Error('Supplier name is required.');
        const input = {
          name: supplierForm.name.trim(),
          contactName: supplierForm.contactName.trim(),
          phone: supplierForm.phone.trim(),
          email: supplierForm.email.trim(),
        };
        if (editingId) await updateSupplier(editingId, input);
        else await createSupplier(input);
        showToast(`Supplier "${input.name}" ${editingId ? 'updated' : 'created'}!`, 'success');
        setSupplierForm(EMPTY_SUPPLIER_FORM);
        reloadSuppliers();
      } else if (currentType === 'yarns') {
        if (!yarnForm.code.trim()) throw new Error('Yarn code is required.');
        if (!yarnForm.name.trim()) throw new Error('Yarn name is required.');
        if (!yarnForm.colour.trim()) throw new Error('Yarn colour is required.');
        const reorderVal = parseFloat(yarnForm.reorderLevelKg) || 0;
        const input = {
          code: yarnForm.code.trim().toUpperCase(),
          name: yarnForm.name.trim(),
          colour: yarnForm.colour.trim(),
          countLabel: yarnForm.countLabel.trim(),
          reorderLevelKg: reorderVal,
        };
        if (editingId) await updateYarnType(editingId, input);
        else await createYarnType(input);
        showToast(`Yarn type "${input.code}" ${editingId ? 'updated' : 'created'}!`, 'success');
        setYarnForm(EMPTY_YARN_FORM);
        reloadYarns();
      } else if (currentType === 'machines') {
        if (!machineForm.code.trim()) throw new Error('Machine code is required.');
        if (!machineForm.name.trim()) throw new Error('Machine name is required.');
        const rateVal = parseFloat(machineForm.ratePerMetre) || 0;
        const input = {
          code: machineForm.code.trim().toUpperCase(),
          name: machineForm.name.trim(),
          ratePerMetre: rateVal,
        };
        if (editingId) await updateMachine(editingId, input);
        else await createMachine({ ...input, stage: machineForm.stage });
        showToast(`Machine "${input.code}" ${editingId ? 'updated' : 'registered'}!`, 'success');
        setMachineForm(EMPTY_MACHINE_FORM);
        reloadMachines();
      }

      setDialogOpen(false);
      setEditingId(null);
    } catch (err: any) {
      // Server validation errors carry per-field messages in details.
      const message =
        err.details?.[0]?.message || err.message || `Failed to ${editingId ? 'update' : 'create'} record.`;
      setFormErrors({ general: message });
      showToast(message, 'error');
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
          <span className="font-semibold text-(--color-text)">{r.name}</span>
          {r.address && <p className="text-xs text-(--color-text-muted)">{r.address}</p>}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Person',
      render: (r) => <span className="font-medium text-sm text-(--color-text)">{r.contactName || '—'}</span>,
    },
    {
      key: 'phone',
      header: 'Phone Number',
      render: (r) => <span className="font-mono text-xs text-(--color-text)">{r.phone || '—'}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (r) => <span className="text-xs text-(--color-text-muted)">{r.email || '—'}</span>,
    },
    ...actionsColumn<Buyer>('buyers', (r) => r.name),
  ];

  // --- Supplier Table Columns ---
  const supplierCols: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Supplier / Vendor',
      render: (r) => (
        <div>
          <span className="font-semibold text-(--color-text)">{r.name}</span>
          {r.contactName && <p className="text-xs text-(--color-text-muted)">Attn: {r.contactName}</p>}
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Contact Phone',
      render: (r) => <span className="font-mono text-xs text-(--color-text)">{r.phone || '—'}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (r) => <span className="text-xs text-(--color-text-muted)">{r.email || '—'}</span>,
    },
    ...actionsColumn<Supplier>('suppliers', (r) => r.name),
  ];

  // --- Yarn Table Columns ---
  const yarnCols: Column<YarnType>[] = [
    {
      key: 'code',
      header: 'Code & Count',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold bg-(--color-surface-sunken) px-2 py-0.5 rounded border border-(--color-border) text-(--color-text)">
            {r.code}
          </span>
          {r.countLabel && <span className="text-xs text-(--color-text-muted)">({r.countLabel})</span>}
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Yarn Material',
      render: (r) => (
        <div>
          <span className="font-semibold text-sm text-(--color-text)">{r.name}</span>
          <p className="text-xs text-(--color-text-muted)">Shade: {r.colour}</p>
        </div>
      ),
    },
    {
      key: 'reorder',
      header: 'Reorder Level (kg)',
      align: 'right',
      render: (r) => (
        <span className="font-semibold text-sm text-(--color-text) block text-right">
          {r.reorderLevelKg.toLocaleString('en-IN')} kg
        </span>
      ),
    },
    {
      key: 'available',
      header: 'Current Available',
      align: 'right',
      render: (r) => (
        <span className="text-sm font-medium text-(--color-success) block text-right">
          {(r.availableKg ?? 0).toLocaleString('en-IN')} kg
        </span>
      ),
    },
    ...actionsColumn<YarnType>('yarns', (r) => r.code),
  ];

  // --- Machine Table Columns ---
  const machineCols: Column<Machine>[] = [
    {
      key: 'code',
      header: 'Machine Code',
      render: (r) => (
        <span className="font-mono text-xs font-semibold bg-(--color-surface-sunken) px-2 py-0.5 rounded border border-(--color-border) text-(--color-text)">
          {r.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Machine Name',
      render: (r) => <span className="font-medium text-(--color-text)">{r.name}</span>,
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
        <span className="font-semibold text-sm text-(--color-text) block text-right">
          {formatCurrency(r.ratePerMetre)}/m
        </span>
      ),
    },
    ...actionsColumn<Machine>('machines', (r) => r.code),
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
    return [];
  })();

  const activeLoading =
    currentType === 'buyers' ? loadingBuyers :
    currentType === 'suppliers' ? loadingSuppliers :
    currentType === 'yarns' ? loadingYarns :
    loadingMachines;

  const activeError =
    currentType === 'buyers' ? errorBuyers :
    currentType === 'suppliers' ? errorSuppliers :
    currentType === 'yarns' ? errorYarns :
    errorMachines;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-(--color-text)">Masters Management</h1>
          <p className="text-sm text-(--color-text-muted) mt-0.5">
            Everest Textile Mills core master data for entities, inventory catalogs and machines.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={reloadCurrent}
            title="Refresh current list"
          >
            <ArrowPathIcon className="w-4 h-4 text-(--color-text-muted)" />
          </Button>

          {canCreate && (
            <Button
              variant="primary"
              size="md"
              onClick={openCreate}
            >
              <PlusIcon className="w-4 h-4" />
              Add {currentTabInfo.label.replace(/s$/, '')}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-(--color-border) overflow-x-auto pb-px">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === currentType;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-(--color-accent) text-(--color-accent)'
                  : 'border-transparent text-(--color-text-muted) hover:text-(--color-text)'
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
          <MagnifyingGlassIcon className="w-4 h-4 text-(--color-text-muted) absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Search ${currentTabInfo.label.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-(--color-border) bg-white placeholder:text-(--color-text-subtle) focus:outline-none focus:ring-2 focus:ring-(--color-accent)/20 focus:border-(--color-accent)"
          />
        </div>

        <span className="text-xs text-(--color-text-muted)">
          Showing {filteredData.length} records
        </span>
      </div>

      {/* Table Area */}
      {activeError ? (
        <ErrorState message={activeError.message} code={activeError.code} onRetry={reloadCurrent} />
      ) : (
        <Card className="p-0 border border-(--color-border) overflow-hidden shadow-xs">
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
        </Card>
      )}

      {/* Create Dialog Modal */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={`${editingId ? 'Edit' : 'Add New'} ${currentTabInfo.label.replace(/s$/, '')}`}
        width="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formErrors.general && <Callout tone="danger">{formErrors.general}</Callout>}

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
                  disabled={editingId !== null}
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

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-(--color-border)">
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
              {editingId ? 'Save Changes' : 'Save Master Record'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        title={`Delete ${currentTabInfo.label.replace(/s$/, '')}`}
        width="max-w-md"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-(--color-text-muted)">
              Are you sure you want to delete{' '}
              <strong className="text-(--color-text)">&quot;{deleteTarget.label}&quot;</strong>?
              This action cannot be undone.
            </p>
            {deleteError && <Callout tone="danger">{deleteError}</Callout>}
            <div className="pt-3 border-t border-(--color-border) flex justify-end gap-2.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={isDeleting}
                onClick={handleDelete}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
