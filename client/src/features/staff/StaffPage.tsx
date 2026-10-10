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
  const [staff, setStaff] = useState<StaffUser[]>([]);
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

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove staff member "${name}"?`)) {
      return;
    }

    try {
      await api(`/staff/${id}`, { method: 'DELETE' });
      setStaff((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete staff member');
    }
  };

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
          !isCurrent &&
          u.role !== 'OWNER' && (
            <button
              onClick={() => handleDelete(u.id, u.name)}
              className="p-1 text-(--color-text-muted) hover:text-(--color-danger) rounded hover:bg-(--color-danger-light) transition-colors"
              title="Remove employee"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )
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

      {/* Staff Table */}
      {staff.length === 0 && !loading ? (
        <div className="bg-white rounded-xl border border-(--color-border) shadow-xs text-center py-16 px-4">
          <ShieldCheckIcon className="w-12 h-12 mx-auto text-(--color-text-subtle) mb-3" />
          <h3 className="text-base font-medium text-(--color-text)">No staff members found</h3>
          <p className="text-sm text-(--color-text-muted) mt-1">Get started by creating your first employee account.</p>
          <Button onClick={handleOpenModal} variant="secondary" className="mt-4">
            Add First Staff
          </Button>
        </div>
      ) : (
        <Table columns={columns} rows={staff} loading={loading} rowKey={(u) => u.id} />
      )}

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
