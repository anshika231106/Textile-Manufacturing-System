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
  retireMaster,
  restoreMaster,
  type MasterPath,
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
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { formatCurrency } from '../../lib/format';
import {
  PhoneIcon,
  EnvelopeIcon,
  UserIcon,
  XMarkIcon,
  UsersIcon,
  TruckIcon,
  CubeIcon,
  WrenchScrewdriverIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  TrashIcon,
  PencilSquareIcon,
  ArchiveBoxIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';

// Workers are managed in Staff Management (people) and Attendance (daily wages).
type MasterType = 'buyers' | 'suppliers' | 'yarns' | 'machines';

interface DeleteTarget {
  type: MasterType;
  id: string;
  label: string;
}

// Mirrors the server's code prefixes, to preview the generated code.
const MACHINE_CODE_PREFIX = { SPINNING: 'SPIN', WEAVING: 'WEAVE', DYEING: 'DYE' } as const;

const API_PATHS: Record<MasterType, MasterPath> = {
  buyers: 'buyers',
  suppliers: 'suppliers',
  yarns: 'yarn-types',
  machines: 'machines',
};

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

// --- Shared cell renderers: fewer, richer columns instead of many sparse ones ---

const TILE_TONES = [
  'bg-(--color-accent-light) text-(--color-accent)',
  'bg-(--color-info-light) text-(--color-info)',
  'bg-(--color-success-light) text-(--color-success)',
  'bg-(--color-warning-light) text-(--color-warning)',
];

function tileTone(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return TILE_TONES[Math.abs(hash) % TILE_TONES.length];
}

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  return ((words[0]?.[0] ?? '?') + (words.length > 1 ? words[1][0] : '')).toUpperCase();
}

function EntityCell({ name, sub }: { name: string; sub?: string | null }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${tileTone(name)}`}
        aria-hidden
      >
        {initialsOf(name)}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-(--color-text) truncate">{name}</p>
        {sub && <p className="text-xs text-(--color-text-muted) truncate">{sub}</p>}
      </div>
    </div>
  );
}

function ContactCell({ person, phone, email }: { person?: string | null; phone?: string | null; email?: string | null }) {
  if (!person && !phone && !email) {
    return <span className="text-xs italic text-(--color-text-subtle)">No contact details</span>;
  }
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {person && (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-(--color-text)">
          <UserIcon className="w-3.5 h-3.5 text-(--color-text-subtle)" />
          {person}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-(--color-text-muted)">
        {phone && (
          <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums hover:text-(--color-accent)">
            <PhoneIcon className="w-3.5 h-3.5 text-(--color-text-subtle)" />
            {phone}
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 whitespace-nowrap hover:text-(--color-accent)">
            <EnvelopeIcon className="w-3.5 h-3.5 text-(--color-text-subtle)" />
            {email}
          </a>
        )}
      </div>
    </div>
  );
}

// Available stock on one line: a slim meter (with a reorder-level tick) and the amount.
function StockCell({ availableKg, reorderLevelKg }: { availableKg: number; reorderLevelKg: number }) {
  const low = availableKg < reorderLevelKg;
  const tight = !low && availableKg < reorderLevelKg * 1.5;
  const scale = Math.max(availableKg, reorderLevelKg * 2, 1);
  const tone = low ? 'bg-(--color-danger)' : tight ? 'bg-(--color-warning)' : 'bg-(--color-success)';
  return (
    <div className="flex items-center justify-end gap-3 whitespace-nowrap">
      <div className="relative hidden xl:block h-1.5 w-24 rounded-full bg-(--color-surface-sunken)">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${(availableKg / scale) * 100}%` }} />
        <span
          className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-(--color-text-muted)"
          style={{ left: `${(reorderLevelKg / scale) * 100}%` }}
          aria-hidden
        />
      </div>
      {low && <Badge variant="danger" label="Low" />}
      <span
        className={`min-w-16 text-right text-sm font-semibold tabular-nums ${low ? 'text-(--color-danger)' : 'text-(--color-text)'}`}
      >
        {availableKg.toLocaleString('en-IN')} kg
      </span>
    </div>
  );
}

// Best-effort swatch colour from a shade name like "Crimson Red" or "Raw Beige".
const SHADE_SWATCHES: [RegExp, string][] = [
  [/white|bleach/i, '#FFFFFF'],
  [/black|charcoal/i, '#1F1F1F'],
  [/red|crimson|maroon/i, '#B91C1C'],
  [/blue|navy|indigo/i, '#1D4ED8'],
  [/green|olive/i, '#15803D'],
  [/yellow|mustard/i, '#EAB308'],
  [/grey|gray/i, '#9CA3AF'],
  [/natural|raw|beige|ecru|cream/i, '#E7DCC5'],
];

function shadeSwatch(colour: string) {
  return SHADE_SWATCHES.find(([pattern]) => pattern.test(colour))?.[1];
}

const STAGE_VARIANT: Record<string, 'info' | 'warning' | 'success'> = {
  SPINNING: 'info',
  WEAVING: 'warning',
  DYEING: 'success',
};

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
  // Set when the server refuses a delete because the record is in use; offers Retire instead.
  const [deleteInUse, setDeleteInUse] = useState(false);
  const [showRetired, setShowRetired] = useState(false);

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
    useApi(() => listBuyers(showRetired), [currentType, showRetired]);
  const { data: suppliers, loading: loadingSuppliers, error: errorSuppliers, reload: reloadSuppliers } =
    useApi(() => listSuppliers(showRetired), [currentType, showRetired]);
  const { data: yarns, loading: loadingYarns, error: errorYarns, reload: reloadYarns } =
    useApi(() => listYarnTypes(showRetired), [currentType, showRetired]);
  const { data: machines, loading: loadingMachines, error: errorMachines, reload: reloadMachines } =
    useApi(() => listMachines(showRetired), [currentType, showRetired]);

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

  const reloadType = (t: MasterType) => {
    if (t === 'buyers') reloadBuyers();
    if (t === 'suppliers') reloadSuppliers();
    if (t === 'yarns') reloadYarns();
    if (t === 'machines') reloadMachines();
  };
  const reloadCurrent = () => reloadType(currentType);

  const handleRetire = async (t: MasterType, id: string, label: string, restore = false) => {
    try {
      if (restore) await restoreMaster(API_PATHS[t], id);
      else await retireMaster(API_PATHS[t], id);
      showToast(`"${label}" ${restore ? 'restored' : 'retired'}.`, 'success');
      reloadType(t);
      return true;
    } catch (err: any) {
      showToast(err.message || `Failed to ${restore ? 'restore' : 'retire'} record.`, 'error');
      return false;
    }
  };

  // Retire from the delete dialog after the server reported the record is in use.
  const handleRetireInstead = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const done = await handleRetire(deleteTarget.type, deleteTarget.id, deleteTarget.label);
    setIsDeleting(false);
    if (done) setDeleteTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    setDeleteInUse(false);
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
      setDeleteInUse(err.code === 'MASTER_IN_USE');
    } finally {
      setIsDeleting(false);
    }
  };

  // Trailing row actions, shown per the user's permissions. Retired rows can only be restored.
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
        render: (r) =>
          r.retiredAt ? (
            <div className="flex justify-end items-center gap-2">
              <Badge variant="neutral" label="Retired" />
              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleRetire(type, r.id, getLabel(r), true)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-(--color-text-muted) hover:text-(--color-accent) hover:bg-(--color-accent-light) transition-colors"
                  title="Restore"
                  aria-label={`Restore ${getLabel(r)}`}
                >
                  <ArrowUturnLeftIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
          // Muted until the row is hovered or focused, so the row end never looks empty.
          <div className="flex justify-end gap-1 transition-opacity duration-150 [@media(hover:hover)]:opacity-50 group-hover/row:opacity-100 focus-within:opacity-100">
            {canCreate && (
              <button
                type="button"
                onClick={() => openEdit(r)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-(--color-text-muted) hover:text-(--color-accent) hover:bg-(--color-accent-light) transition-colors"
                title="Edit"
                aria-label={`Edit ${getLabel(r)}`}
              >
                <PencilSquareIcon className="w-4 h-4" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => handleRetire(type, r.id, getLabel(r))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-(--color-text-muted) hover:text-(--color-accent) hover:bg-(--color-accent-light) transition-colors"
                title="Retire (hide from lists, keep history)"
                aria-label={`Retire ${getLabel(r)}`}
              >
                <ArchiveBoxIcon className="w-4 h-4" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  setDeleteError('');
                  setDeleteInUse(false);
                  setDeleteTarget({ type, id: r.id, label: getLabel(r) });
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-(--color-text-muted) hover:text-(--color-danger) hover:bg-(--color-danger-light) transition-colors"
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
        if (!machineForm.name.trim()) throw new Error('Machine name is required.');
        const rateVal = parseFloat(machineForm.ratePerMetre) || 0;
        const input = {
          name: machineForm.name.trim(),
          ratePerMetre: rateVal,
        };
        const saved = editingId
          ? await updateMachine(editingId, input)
          : await createMachine({ ...input, stage: machineForm.stage });
        showToast(`Machine "${saved.code}" ${editingId ? 'updated' : 'registered'}!`, 'success');
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
      header: 'Company / Mill',
      render: (r) => <EntityCell name={r.name} sub={r.address} />,
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (r) => <ContactCell person={r.contactName} phone={r.phone} email={r.email} />,
    },
    ...actionsColumn<Buyer>('buyers', (r) => r.name),
  ];

  // --- Supplier Table Columns ---
  const supplierCols: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Supplier / Vendor',
      render: (r) => <EntityCell name={r.name} />,
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (r) => <ContactCell person={r.contactName} phone={r.phone} email={r.email} />,
    },
    ...actionsColumn<Supplier>('suppliers', (r) => r.name),
  ];

  // --- Yarn Table Columns (one line per row) ---
  const yarnCols: Column<YarnType>[] = [
    {
      key: 'name',
      header: 'Yarn',
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <span className="shrink-0 whitespace-nowrap font-mono text-[11px] font-semibold bg-(--color-surface-sunken) px-2 py-0.5 rounded-md border border-(--color-border) text-(--color-text)">
            {r.code}
          </span>
          {/* Wraps only when the table runs out of room; count shows inline where its own column is hidden */}
          <span className="text-sm">
            <span className="font-semibold text-(--color-text)">{r.name}</span>
            {r.countLabel && (
              <span className="xl:hidden whitespace-nowrap text-xs text-(--color-text-muted)"> · {r.countLabel}</span>
            )}
          </span>
        </div>
      ),
    },
    {
      key: 'count',
      header: 'Count',
      className: 'hidden xl:table-cell',
      render: (r) => <span className="text-sm text-(--color-text-muted)">{r.countLabel || '—'}</span>,
    },
    {
      key: 'shade',
      header: 'Shade',
      render: (r) => {
        const swatch = shadeSwatch(r.colour);
        return (
          <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-(--color-text)">
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-(--color-border)"
              style={{ backgroundColor: swatch ?? 'transparent' }}
              aria-hidden
            />
            {r.colour}
          </span>
        );
      },
    },
    {
      key: 'available',
      header: 'Available',
      align: 'right',
      render: (r) => <StockCell availableKg={r.availableKg ?? 0} reorderLevelKg={r.reorderLevelKg} />,
    },
    {
      key: 'reorder',
      header: 'Reorder',
      align: 'right',
      render: (r) => (
        <span className="whitespace-nowrap text-sm text-(--color-text-muted) tabular-nums">
          {r.reorderLevelKg.toLocaleString('en-IN')} kg
        </span>
      ),
    },
    ...actionsColumn<YarnType>('yarns', (r) => r.code),
  ];

  // --- Machine Table Columns ---
  const machineCols: Column<Machine>[] = [
    {
      key: 'machine',
      header: 'Machine',
      render: (r) => (
        <div className="min-w-0">
          <span className="font-mono text-[11px] font-semibold bg-(--color-surface-sunken) px-2 py-0.5 rounded-md border border-(--color-border) text-(--color-text)">
            {r.code}
          </span>
          <p className="mt-1 font-medium text-sm text-(--color-text) truncate">{r.name}</p>
        </div>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      render: (r) => <Badge variant={STAGE_VARIANT[r.stage] ?? 'info'} label={r.stage.charAt(0) + r.stage.slice(1).toLowerCase()} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge
          variant={r.status === 'RUNNING' ? 'success' : r.status === 'BREAKDOWN' ? 'danger' : 'neutral'}
          label={r.status.charAt(0) + r.status.slice(1).toLowerCase()}
          dot
        />
      ),
    },
    {
      key: 'rate',
      header: 'Rate / Metre',
      align: 'right',
      render: (r) => (
        <span className="font-semibold text-sm text-(--color-text) tabular-nums">
          {formatCurrency(r.ratePerMetre)}
          <span className="text-xs font-normal text-(--color-text-muted)"> /m</span>
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

  const tabCounts: Partial<Record<MasterType, number>> = {
    buyers: buyers?.length,
    suppliers: suppliers?.length,
    yarns: yarns?.length,
    machines: machines?.length,
  };

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
              className="whitespace-nowrap"
              onClick={openCreate}
            >
              <PlusIcon className="w-4 h-4" />
              Add {currentTabInfo.label.replace(/s$/, '')}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs (with record counts) + search, on one row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="overflow-x-auto -mx-1 px-1">
          <SegmentedControl
            value={currentType}
            onChange={handleTabChange}
            options={TABS.map((tab) => ({
              value: tab.id,
              label: tab.label,
              icon: tab.icon,
              count: tabCounts[tab.id],
            }))}
          />
        </div>

        <div className="relative w-full lg:max-w-xs">
          <MagnifyingGlassIcon className="w-4 h-4 text-(--color-text-muted) absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Search ${currentTabInfo.label.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-20 py-2 text-sm rounded-full border border-(--color-border) bg-(--color-surface) placeholder:text-(--color-text-subtle) focus:outline-none focus:ring-2 focus:ring-(--color-accent)/20 focus:border-(--color-accent) transition-shadow"
          />
          {searchQuery && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="text-[11px] text-(--color-text-muted) tabular-nums">
                {filteredData.length} of {tabCounts[currentType] ?? 0}
              </span>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-(--color-text-muted) hover:bg-(--color-surface-sunken) hover:text-(--color-text)"
                aria-label="Clear search"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="-mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-(--color-text-muted)">{currentTabInfo.description}</p>
        {canDelete && (
          <label className="flex shrink-0 items-center gap-2 text-xs text-(--color-text-muted) cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showRetired}
              onChange={(e) => setShowRetired(e.target.checked)}
              className="accent-(--color-accent)"
            />
            Show retired
          </label>
        )}
      </div>

      {/* Table Area */}
      {activeError ? (
        <ErrorState message={activeError.message} code={activeError.code} onRetry={reloadCurrent} />
      ) : (
        <Card className="p-0 overflow-hidden rounded-2xl! shadow-xs [&>div]:border-0 [&>div]:rounded-none">
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
                  value={editingId ? machineForm.code : `${MACHINE_CODE_PREFIX[machineForm.stage]}-##`}
                  disabled
                  hint={editingId ? 'Codes are fixed once assigned' : 'Assigned automatically on save'}
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
            {deleteInUse && (
              <p className="text-sm text-(--color-text-muted)">
                You can retire it instead: it will be hidden from lists and dropdowns, its history is kept, and it
                can be restored later from &quot;Show retired&quot;.
              </p>
            )}
            <div className="pt-3 border-t border-(--color-border) flex justify-end gap-2.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              {deleteInUse ? (
                <Button type="button" variant="primary" loading={isDeleting} onClick={handleRetireInstead}>
                  <ArchiveBoxIcon className="w-4 h-4" />
                  Retire instead
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="danger"
                  loading={isDeleting}
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
