import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatCard, StatGrid } from '../../components/ui/StatCard';
import { Table, type Column } from '../../components/ui/Table';
import { formatCurrency, formatApiDate, formatApiMonth } from '../../lib/format';
import {
  getAttendance,
  saveAttendance,
  getWages,
  type WorkerAttendanceRecord,
  type MonthlyWagesResponse,
} from './attendance.api';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  BanknotesIcon,
  UsersIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

export function AttendancePage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const isSupervisorOrAdmin =
    user?.role === 'SUPERVISOR' || user?.role === 'OWNER' || user?.role === 'OFFICE';

  // Date states
  const [selectedDate, setSelectedDate] = useState<string>(formatApiDate(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<string>(formatApiMonth(new Date()));

  // Daily attendance state
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [records, setRecords] = useState<WorkerAttendanceRecord[]>([]);
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Monthly summary state
  const [loadingWages, setLoadingWages] = useState(true);
  const [wagesData, setWagesData] = useState<MonthlyWagesResponse | null>(null);

  // Load daily attendance
  const loadDailyAttendance = async (dateStr: string) => {
    try {
      setLoadingDaily(true);
      const res = await getAttendance(dateStr);
      setRecords(res.records);
    } catch (err) {
      console.error('Failed to load daily attendance:', err);
    } finally {
      setLoadingDaily(false);
    }
  };

  // Load monthly wage summary
  const loadMonthlyWages = async (monthStr: string) => {
    try {
      setLoadingWages(true);
      const res = await getWages(monthStr);
      setWagesData(res);
    } catch (err) {
      console.error('Failed to load monthly wages:', err);
    } finally {
      setLoadingWages(false);
    }
  };

  useEffect(() => {
    loadDailyAttendance(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    loadMonthlyWages(selectedMonth);
  }, [selectedMonth]);

  // Toggle present status for worker
  const toggleStatus = (workerId: string) => {
    setRecords((prev) =>
      prev.map((r) => (r.workerId === workerId ? { ...r, present: !r.present } : r))
    );
  };

  // Quick mark all present or all absent
  const setAllStatus = (present: boolean) => {
    setRecords((prev) => prev.map((r) => ({ ...r, present })));
  };

  const handleSaveAttendance = async () => {
    try {
      setSavingAttendance(true);
      await saveAttendance({
        date: selectedDate,
        records: records.map((r) => ({
          workerId: r.workerId,
          present: r.present,
        })),
      });

      showToast(`Attendance for ${selectedDate} saved successfully`, 'success');
      // Refresh wages for the month
      await loadMonthlyWages(selectedMonth);
    } catch (err: any) {
      showToast(err.message || 'Failed to save attendance', 'error');
    } finally {
      setSavingAttendance(false);
    }
  };

  const presentCount = records.filter((r) => r.present).length;
  const absentCount = records.length - presentCount;

  const dailyColumns: Column<WorkerAttendanceRecord>[] = [
    { key: 'code', header: 'Code', render: (w) => <span className="font-mono font-semibold text-(--color-text)">{w.workerCode}</span> },
    { key: 'name', header: 'Worker Name', render: (w) => <span className="font-semibold text-sm text-(--color-text)">{w.workerName}</span> },
    { key: 'role', header: 'Role / Department', render: (w) => <span className="text-(--color-text-muted)">{w.workerRole}</span> },
    { key: 'wage', header: 'Daily Wage', align: 'right', render: (w) => <span className="font-mono font-medium text-(--color-text)">{formatCurrency(w.dailyWage)}</span> },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (w) => (w.present ? <Badge variant="success" label="PRESENT" dot /> : <Badge variant="danger" label="ABSENT" dot />),
    },
    {
      key: 'toggle',
      header: 'Toggle Presence',
      align: 'right',
      render: (w) => (
        <button
          type="button"
          onClick={() => toggleStatus(w.workerId)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            w.present
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs hover:bg-emerald-700'
              : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
          }`}
        >
          {w.present ? 'Present' : 'Absent'}
        </button>
      ),
    },
  ];

  const wageColumns: Column<MonthlyWagesResponse['workers'][number]>[] = [
    { key: 'code', header: 'Code', render: (w) => <span className="font-mono font-medium text-(--color-text)">{w.workerCode}</span> },
    { key: 'name', header: 'Worker Name', render: (w) => <span className="font-semibold text-(--color-text)">{w.workerName}</span> },
    { key: 'role', header: 'Role', render: (w) => <span className="text-(--color-text-muted)">{w.workerRole}</span> },
    { key: 'rate', header: 'Daily Rate', align: 'right', render: (w) => <span className="font-mono text-(--color-text-muted)">{formatCurrency(w.dailyWage)}</span> },
    { key: 'days', header: 'Days Present', align: 'right', render: (w) => <span className="font-mono font-bold text-(--color-text)">{w.presentDays} days</span> },
    { key: 'total', header: 'Total Wage Entitlement', align: 'right', render: (w) => <span className="font-mono font-bold text-sm text-emerald-800">{formatCurrency(w.totalWage)}</span> },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-(--color-border)">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-(--color-text) tracking-tight">
              Plant Attendance & Wage Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Shift Roster
            </span>
          </div>
          <p className="text-sm text-(--color-text-muted) mt-1">
            Mark daily floor worker presence, calculate daily wage entitlements, and review monthly wage liabilities.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            loadDailyAttendance(selectedDate);
            loadMonthlyWages(selectedMonth);
          }}
          className="text-xs self-start sm:self-auto"
        >
          <ArrowPathIcon className="w-4 h-4 text-(--color-text-muted)" />
          Refresh
        </Button>
      </div>

      {/* SECTION 1: Daily Attendance Marker */}
      <section className="bg-white rounded-2xl border border-(--color-border) p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-(--color-surface-sunken)">
          <div className="flex items-center gap-2.5">
            <CalendarDaysIcon className="w-5 h-5 text-(--color-accent)" />
            <h2 className="text-base font-semibold text-(--color-text)">
              Daily Attendance Roster
            </h2>
          </div>

          {/* Date Picker & Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="text-xs font-medium text-(--color-text-muted)">Select Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-(--color-border) bg-white py-1.5 px-3 text-xs font-medium text-(--color-text) focus:outline-none focus:ring-1 focus:ring-(--color-accent)"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(formatApiDate(new Date()))}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-(--color-surface-sunken) text-(--color-text-dark) hover:bg-(--color-border) transition-colors"
            >
              Today
            </button>
          </div>
        </div>

        {/* Daily Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-(--color-surface-alt) rounded-xl border border-(--color-border)">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-(--color-text-muted)">
              Total Staff: <strong className="text-(--color-text) font-mono">{records.length}</strong>
            </span>
            <span className="text-emerald-700 font-medium">
              Present: <strong className="font-mono">{presentCount}</strong>
            </span>
            <span className="text-rose-700 font-medium">
              Absent: <strong className="font-mono">{absentCount}</strong>
            </span>
          </div>

          {isSupervisorOrAdmin && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAllStatus(true)}
                className="text-xs px-2.5 py-1 rounded border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
              >
                Mark All Present
              </button>
              <button
                type="button"
                onClick={() => setAllStatus(false)}
                className="text-xs px-2.5 py-1 rounded border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 transition-colors"
              >
                Mark All Absent
              </button>
            </div>
          )}
        </div>

        {/* Worker Attendance Table */}
        <Table columns={dailyColumns} rows={records} loading={loadingDaily} rowKey={(w) => w.workerId} />

        {/* Save Attendance Submit Button */}
        <div className="flex justify-end pt-2">
          <Button
            variant="primary"
            loading={savingAttendance}
            onClick={handleSaveAttendance}
            className="shadow-xs text-xs py-2.5 px-5"
          >
            <CheckCircleIcon className="w-4 h-4" />
            Save {selectedDate} Attendance
          </Button>
        </div>
      </section>

      {/* SECTION 2: Monthly Summary & Wage Calculation */}
      <section className="bg-white rounded-2xl border border-(--color-border) p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-(--color-surface-sunken)">
          <div className="flex items-center gap-2.5">
            <BanknotesIcon className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-base font-semibold text-(--color-text)">
                Monthly Wage Summary & Liabilities
              </h2>
              <p className="text-xs text-(--color-text-muted)">
                Cumulative present days and payroll liability directly retrieved from attendance data.
              </p>
            </div>
          </div>

          {/* Month selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-(--color-text-muted)">Month:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-lg border border-(--color-border) bg-white py-1.5 px-3 text-xs font-medium text-(--color-text) focus:outline-none focus:ring-1 focus:ring-(--color-accent)"
            />
          </div>
        </div>

        {/* Wage KPI Cards */}
        {wagesData && (
          <StatGrid columns={3}>
            <StatCard icon={UsersIcon} label="Active Workers" value={wagesData.activeWorkers} sub="Staff on shift roster" tone="neutral" />
            <StatCard icon={ClockIcon} label="Total Shifts Worked" value={`${wagesData.totalPresentDays} days`} sub={`Accumulated for ${wagesData.month}`} tone="neutral" />
            <StatCard icon={BanknotesIcon} label="Total Wages Payable" value={formatCurrency(wagesData.totalWages)} sub="Calculated by server wage ledger" tone="success" />
          </StatGrid>
        )}

        {/* Monthly Worker Breakdown Table */}
        <Table
          columns={wageColumns}
          rows={wagesData?.workers ?? []}
          loading={loadingWages}
          rowKey={(w) => w.workerId}
          emptyTitle="No records"
          emptyDescription={`No attendance records found for ${selectedMonth}.`}
        />
      </section>
    </div>
  );
}
