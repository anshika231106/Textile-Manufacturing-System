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
import { Spinner } from '../../components/ui/Spinner';
import {
  UserPlusIcon,
  EnvelopeIcon,
  TrashIcon,
  CheckCircleIcon,
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
  { value: 'SUPERVISOR', label: 'Floor Supervisor (Production & QC)' },
  { value: 'OFFICE', label: 'Office Staff (Orders & Invoices)' },
  { value: 'STOREKEEPER', label: 'Storekeeper (Yarn Stock & Dispatch)' },
];

const ROLE_BADGE_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  OWNER: 'neutral',
  OFFICE: 'info',
  SUPERVISOR: 'warning',
  STAFF: 'neutral',
  STOREKEEPER: 'success',
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E4DF]">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1714] tracking-tight">Staff & Employee Management</h1>
          <p className="mt-1 text-sm text-[#78716C]">
            Manage authorized staff members. New employees automatically receive login credentials via email.
          </p>
        </div>
        <Button
          onClick={handleOpenModal}
          variant="primary"
          className="flex items-center gap-2 self-start sm:self-auto shadow-xs"
        >
          <UserPlusIcon className="w-4 h-4" />
          Add Employee
        </Button>
      </div>

      {/* Success banner after creation - never displays password */}
      {latestCreated && (
        <div className="rounded-xl bg-[#F0FDF4] border border-[#86EFAC] p-4 text-[#166534] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="w-6 h-6 text-[#16A34A] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">
                Employee added successfully: {latestCreated.name} ({latestCreated.role})
              </p>
              <p className="text-xs text-[#15803D] mt-0.5 flex items-center gap-1.5">
                <EnvelopeIcon className="w-4 h-4" />
                Login credentials have been automatically dispatched to <strong>{latestCreated.email}</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={() => setLatestCreated(null)}
            className="text-xs text-[#166534] hover:text-[#14532D] underline font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] p-4 text-sm text-[#DC2626]">
          {error}
        </div>
      )}

      {/* Staff Table */}
      <div className="bg-white rounded-xl border border-[#E8E4DF] shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-sm text-[#78716C]">
            <Spinner size="md" />
            <span>Loading staff members from database...</span>
          </div>
        ) : staff.length === 0 ? (
          <div className="text-center py-16 px-4">
            <ShieldCheckIcon className="w-12 h-12 mx-auto text-[#A8A29E] mb-3" />
            <h3 className="text-base font-medium text-[#1A1714]">No staff members found</h3>
            <p className="text-sm text-[#78716C] mt-1">Get started by creating your first employee account.</p>
            <Button onClick={handleOpenModal} variant="secondary" className="mt-4">
              Add First Staff
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-[#FBFBF9] border-b border-[#E8E4DF] text-xs font-semibold text-[#78716C] uppercase tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4DF]/70">
                {staff.map((u) => {
                  const isCurrent = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-[#FAFAF8] transition-colors">
                      <td className="py-3.5 px-4 font-medium text-[#1A1714]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#EA580C]/10 text-[#EA580C] font-semibold flex items-center justify-center text-xs">
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div>{u.name}</div>
                            {isCurrent && (
                              <span className="text-[10px] text-[#EA580C] font-semibold uppercase tracking-wider">
                                (You)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#44403C] font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <EnvelopeIcon className="w-4 h-4 text-[#A8A29E]" />
                          {u.email}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={ROLE_BADGE_VARIANT[u.role] || 'neutral'}
                          label={u.role}
                        />
                      </td>
                      <td className="py-3.5 px-4 text-[#78716C] text-xs">
                        {new Date(u.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {!isCurrent && u.role !== 'OWNER' && (
                          <button
                            onClick={() => handleDelete(u.id, u.name)}
                            className="p-1 text-[#78716C] hover:text-[#DC2626] rounded hover:bg-[#FEF2F2] transition-colors"
                            title="Remove employee"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      <Dialog
        open={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        title="Add New Employee"
        width="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-[#78716C]">
            A secure temporary login password will be automatically generated and sent to the employee's email.
          </p>

          {formError && (
            <div className="rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] p-3 text-xs text-[#DC2626]">
              {formError}
            </div>
          )}

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

          <div className="pt-3 border-t border-[#E8E4DF] flex justify-end gap-2.5">
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
