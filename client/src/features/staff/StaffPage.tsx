import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { Role } from '../../lib/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Dialog } from '../../components/ui/Dialog';
import { Badge } from '../../components/ui/Badge';
import { Table, type Column } from '../../components/ui/Table';
import { Callout } from '../../components/ui/Callout';
import { PageHeader } from '../../components/ui/PageHeader';
import {
  UserPlusIcon,
  EnvelopeIcon,
  TrashIcon,
  ShieldCheckIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

const ROLE_OPTIONS = [
  { value: 'STAFF', label: 'Floor Staff (Production & Weaving)' },
  { value: 'SUPERVISOR', label: 'Floor Supervisor (Production, QC & Dispatch)' },
  { value: 'OFFICE', label: 'Office Staff (Orders & Invoices)' },
];

const ROLE_BADGE_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  OWNER: 'neutral',
  OFFICE: 'info',
  SUPERVISOR: 'warning',
  STAFF: 'neutral',
};

export function StaffPage() {
  const { user: currentUser } = useAuth();
  const isOwner = currentUser?.role === 'OWNER';
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'STAFF' as Role,
  });

  // Success alert state (does NOT expose the generated password)
  const [latestCreated, setLatestCreated] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffUser | null>(null);
  const [roleTarget, setRoleTarget] = useState<StaffUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>('STAFF');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchStaff = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api<StaffUser[]>('/staff');
      setStaff(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load staff list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleOpenModal = () => {
    setFormData({
      name: '',
      email: '',
      role: 'STAFF',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setFormError('Name and Email are required');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
      };

      const created = await api<StaffUser>('/staff', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setLatestCreated({
        name: created.name,
        email: created.email,
        role: created.role,
      });

      setModalOpen(false);
      fetchStaff();
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'CONFLICT_DUPLICATE') {
        setFormError('A user with this email address already exists.');
      } else {
        setFormError(err.message || 'Failed to add staff member.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionSubmitting(true);
    setActionError('');
    try {
      await api(`/staff/${deleteTarget.id}`, { method: 'DELETE' });
      setStaff((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete staff member.');
    } finally {
      setActionSubmitting(false);
    }
  };

  const openRoleDialog = (user: StaffUser) => {
    setRoleTarget(user);
    setSelectedRole(user.role === 'STAFF' ? 'SUPERVISOR' : 'STAFF');
    setActionError('');
  };

  const handleRoleChange = async () => {
    if (!roleTarget || roleTarget.role === selectedRole) return;
    setActionSubmitting(true);
    setActionError('');
    try {
      const updated = await api<StaffUser>(`/staff/${roleTarget.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: selectedRole }),
      });
      setStaff((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setRoleTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to change employee role.');
    } finally {
      setActionSubmitting(false);
    }
  };

  const filteredStaff = staff.filter((employee) => {
    const query = searchQuery.trim().toLowerCase();
    return !query || [employee.name, employee.email, employee.role].some((value) =>
      value.toLowerCase().includes(query),
    );
  });

  const columns: Column<StaffUser>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (u) => {
        const isCurrent = currentUser?.id === u.id;
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-(--color-accent)/10 text-(--color-accent) font-semibold flex items-center justify-center text-xs">
              {u.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-medium text-(--color-text)">{u.name}</div>
              {isCurrent && (
                <span className="text-[10px] text-(--color-accent) font-semibold uppercase tracking-wider">
                  (You)
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'email',
      header: 'Email Address',
      render: (u) => (
        <div className="flex items-center gap-1.5 text-(--color-text-dark) font-mono text-xs">
          <EnvelopeIcon className="w-4 h-4 text-(--color-text-subtle)" />
          {u.email}
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (u) => <Badge variant={ROLE_BADGE_VARIANT[u.role] || 'neutral'} label={u.role} />,
    },
    {
      key: 'joined',
      header: 'Joined Date',
      render: (u) => (
        <span className="text-(--color-text-muted) text-xs">
          {new Date(u.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (u) => {
        const isCurrent = currentUser?.id === u.id;
        return (
          <div className="flex justify-end items-center gap-2">
            {isOwner && !isCurrent && u.role !== 'OWNER' && (
              <button
                type="button"
                onClick={() => openRoleDialog(u)}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-(--color-accent) hover:bg-(--color-accent-light) transition-colors"
                title={`Change ${u.name}'s role`}
              >
                <PencilSquareIcon className="w-4 h-4" />
                Change role
              </button>
            )}
            {!isCurrent && u.role !== 'OWNER' && (
              <button
                type="button"
                onClick={() => {
                  setActionError('');
                  setDeleteTarget(u);
                }}
                className="p-1 text-(--color-text-muted) hover:text-(--color-danger) rounded hover:bg-(--color-danger-light) transition-colors"
                title="Remove employee"
                aria-label={`Remove ${u.name}`}
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & Employee Management"
        description="Manage authorized staff members. New employees automatically receive login credentials via email."
        actions={
          <Button
            onClick={handleOpenModal}
            variant="primary"
            className="flex items-center gap-2 shadow-xs"
          >
            <UserPlusIcon className="w-4 h-4" />
            Add Employee
          </Button>
        }
      />

      {/* Success banner after creation - never displays password */}
      {latestCreated && (
        <Callout tone="success">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-sm text-(--color-text)">
                Employee added successfully: {latestCreated.name} ({latestCreated.role})
              </p>
              <p className="text-xs mt-0.5 flex items-center gap-1.5">
                <EnvelopeIcon className="w-4 h-4" />
                Login credentials have been automatically dispatched to <strong>{latestCreated.email}</strong>.
              </p>
            </div>
            <button
              onClick={() => setLatestCreated(null)}
              className="text-xs hover:underline font-medium shrink-0"
            >
              Dismiss
            </button>
          </div>
        </Callout>
      )}

      {/* Error state */}
      {error && <Callout tone="danger">{error}</Callout>}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-sm w-full">
          <MagnifyingGlassIcon className="w-4 h-4 text-(--color-text-muted) absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search employees by name, email, or role..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-(--color-border) bg-white placeholder:text-(--color-text-subtle) focus:outline-none focus:ring-2 focus:ring-(--color-accent)/20 focus:border-(--color-accent)"
          />
        </div>
        <span className="text-xs text-(--color-text-muted)">
          Showing {filteredStaff.length} of {staff.length} employees
        </span>
      </div>

      {/* Staff Table */}
      {staff.length === 0 && !loading && searchQuery.trim() === '' ? (
        <div className="bg-white rounded-xl border border-(--color-border) shadow-xs text-center py-16 px-4">
          <ShieldCheckIcon className="w-12 h-12 mx-auto text-(--color-text-subtle) mb-3" />
          <h3 className="text-base font-medium text-(--color-text)">No staff members found</h3>
          <p className="text-sm text-(--color-text-muted) mt-1">Get started by creating your first employee account.</p>
          <Button onClick={handleOpenModal} variant="secondary" className="mt-4">
            Add First Staff
          </Button>
        </div>
      ) : (
        <Table
          columns={columns}
          rows={filteredStaff}
          loading={loading}
          rowKey={(u) => u.id}
          emptyTitle="No employees match your search"
          emptyDescription="Try a different name, email address, or role."
        />
      )}

      {/* Owner-only role confirmation */}
      <Dialog
        open={roleTarget !== null}
        onClose={() => !actionSubmitting && setRoleTarget(null)}
        title="Confirm Role Change"
        width="max-w-md"
      >
        {roleTarget && (
          <div className="space-y-4">
            <p className="text-sm text-(--color-text-muted)">
              Are you sure you want to change the role of <strong className="text-(--color-text)">{roleTarget.name}</strong>?
            </p>
            <div className="rounded-lg bg-(--color-surface-sunken) p-3 text-sm">
              <span className="text-(--color-text-muted)">Current role:</span>{' '}
              <strong className="text-(--color-text)">{roleTarget.role}</strong>
            </div>
            <Select
              id="change-staff-role"
              label="New role"
              options={ROLE_OPTIONS}
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as Role)}
              disabled={actionSubmitting}
            />
            {actionError && <Callout tone="danger">{actionError}</Callout>}
            <div className="pt-3 border-t border-(--color-border) flex justify-end gap-2.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRoleTarget(null)}
                disabled={actionSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={actionSubmitting}
                disabled={selectedRole === roleTarget.role}
                onClick={handleRoleChange}
              >
                Confirm Role Change
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Styled delete confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onClose={() => !actionSubmitting && setDeleteTarget(null)}
        title="Remove Employee"
        width="max-w-md"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-(--color-text-muted)">
              Are you sure you want to remove staff member{' '}
              <strong className="text-(--color-text)">&quot;{deleteTarget.name}&quot;</strong>?
              This action cannot be undone.
            </p>
            {actionError && <Callout tone="danger">{actionError}</Callout>}
            <div className="pt-3 border-t border-(--color-border) flex justify-end gap-2.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={actionSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={actionSubmitting}
                onClick={handleDelete}
              >
                Remove Employee
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Add Staff Modal */}
      <Dialog
        open={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        title="Add New Employee"
        width="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-(--color-text-muted)">
            A secure temporary login password will be automatically generated and sent to the employee's email.
          </p>

          {formError && <Callout tone="danger">{formError}</Callout>}

          <Input
            id="staff-name"
            label="Full Name"
            placeholder="e.g. Ramesh Patel"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            disabled={submitting}
          />

          <Input
            id="staff-email"
            type="email"
            label="Email Address"
            placeholder="ramesh@company.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            disabled={submitting}
          />

          <Select
            id="staff-role"
            label="Department / Role"
            options={ROLE_OPTIONS}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
            required
            disabled={submitting}
          />

          <div className="pt-3 border-t border-(--color-border) flex justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
            >
              Create & Send Credentials
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
