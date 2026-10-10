import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatCard, StatGrid } from '../../components/ui/StatCard';
import { Table, type Column } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Callout } from '../../components/ui/Callout';
import { formatCurrency, formatApiMonth } from '../../lib/format';
import {
  getAttendance,
  saveAttendance,
  getWages,
  updateDailyWage,
  type WorkerAttendanceRecord,
  type WorkerWageSummary,
  type MonthlyWagesResponse,
} from './attendance.api';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  BanknotesIcon,
  UsersIcon,
  ClockIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function plantToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

type AttendanceFilter = 'ALL' | 'PRESENT' | 'ABSENT';

export function AttendancePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const today = plantToday();
  const isStaff = user?.role === 'STAFF';
  const canMarkAttendance = user?.role === 'SUPERVISOR';
  const canSeeWages = user?.role === 'OFFICE' || user?.role === 'OWNER' || isStaff;
  const canEditWages = user?.role === 'OFFICE' || user?.role === 'OWNER';

  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(formatApiMonth(new Date()));
  const [dailyPage, setDailyPage] = useState(0);
  const [wagePage, setWagePage] = useState(0);
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>('ALL');
  const pageSize = 15;
  const [records, setRecords] = useState<WorkerAttendanceRecord[]>([]);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyError, setDailyError] = useState('');
  const [saving, setSaving] = useState(false);
  const [wagesData, setWagesData] = useState<MonthlyWagesResponse | null>(null);
  const [wagesLoading, setWagesLoading] = useState(canSeeWages);
  const [wagesError, setWagesError] = useState('');
  const [wageTarget, setWageTarget] = useState<WorkerWageSummary | null>(null);
  const [wageInput, setWageInput] = useState('');
  const [wageSaving, setWageSaving] = useState(false);
  const [wageEditError, setWageEditError] = useState('');

  const loadDaily = async (date: string) => {
    setDailyLoading(true);
    setDailyError('');
    try {
      const response = await getAttendance(date);
      setRecords(response.records);
    } catch (error) {
      setRecords([]);
      setDailyError(errorMessage(error, 'Unable to load attendance.'));
    } finally {
      setDailyLoading(false);
    }
  };

  const loadWages = async (month: string) => {
    if (!canSeeWages) return;
    setWagesLoading(true);
    setWagesError('');
    try {
      setWagesData(await getWages(month));
    } catch (error) {
      setWagesData(null);
      setWagesError(errorMessage(error, 'Unable to load wage summary.'));
    } finally {
      setWagesLoading(false);
    }
  };

  useEffect(() => {
    setDailyPage(0);
    void loadDaily(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    setWagePage(0);
    void loadWages(selectedMonth);
  }, [selectedMonth, canSeeWages]);

  const setAllStatus = (present: boolean) => {
    setRecords((current) => current.map((record) => ({ ...record, present })));
  };

  const toggleStatus = (workerId: string) => {
    setRecords((current) =>
      current.map((record) =>
        record.workerId === workerId
          ? { ...record, present: record.present === true ? false : true }
          : record,
      ),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await saveAttendance({
        date: selectedDate,
        records: records.map((record) => ({
          workerId: record.workerId,
          present: record.present === true,
        })),
      });
      setRecords(response.records);
      showToast(`Attendance for ${selectedDate} saved successfully`, 'success');
    } catch (error) {
      showToast(errorMessage(error, 'Failed to save attendance.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWage = async () => {
    if (!wageTarget) return;
    const amount = Number(wageInput);
    if (!wageInput.trim() || !Number.isFinite(amount) || amount < 0 || amount > 999999.99) {
      setWageEditError('Enter a valid daily wage from 0 to 999,999.99.');
      return;
    }

    setWageSaving(true);
    setWageEditError('');
    try {
      const updated = await updateDailyWage(wageTarget.workerId, Math.round(amount * 100) / 100);
      setRecords((current) => current.map((record) =>
        record.workerId === updated.staffId
          ? { ...record, dailyWage: updated.dailyWage }
          : record,
      ));
      await loadWages(selectedMonth);
      showToast(`${wageTarget.workerName}'s daily wage was updated.`, 'success');
      setWageTarget(null);
    } catch (error) {
      setWageEditError(errorMessage(error, 'Failed to update daily wage.'));
    } finally {
      setWageSaving(false);
    }
  };

  const presentCount = records.filter((record) => record.present === true).length;
  const absentCount = records.filter((record) => record.present === false).length;
  const filteredDailyRecords = records.filter((record) => {
    if (attendanceFilter === 'PRESENT') return record.present === true;
    if (attendanceFilter === 'ABSENT') return record.present === false;
    return true;
  });
  const dailyPageCount = Math.ceil(filteredDailyRecords.length / pageSize);
  const visibleDailyPage = Math.min(dailyPage, Math.max(dailyPageCount - 1, 0));
  const visibleDailyRecords = filteredDailyRecords.slice(
    visibleDailyPage * pageSize,
    (visibleDailyPage + 1) * pageSize,
  );
  const wageWorkers = wagesData?.workers ?? [];
  const wagePageCount = Math.ceil(wageWorkers.length / pageSize);
  const visibleWagePage = Math.min(wagePage, Math.max(wagePageCount - 1, 0));
  const visibleWageWorkers = wageWorkers.slice(
    visibleWagePage * pageSize,
    (visibleWagePage + 1) * pageSize,
  );

  const dailyColumns: Column<WorkerAttendanceRecord>[] = [
    { key: 'code', header: 'Code', render: (w) => <span className="font-mono font-semibold text-(--color-text)">{w.workerCode}</span> },
    { key: 'name', header: 'Worker Name', render: (w) => <span className="font-semibold text-sm text-(--color-text)">{w.workerName}</span> },
    { key: 'role', header: 'Role / Department', render: (w) => <span className="text-(--color-text-muted)">{w.workerRole}</span> },
    ...(canSeeWages
      ? [{
          key: 'wage',
          header: 'Daily Wage',
          align: 'right' as const,
          render: (w: WorkerAttendanceRecord) => (
            <span className="font-mono font-medium text-(--color-text)">{formatCurrency(w.dailyWage ?? 0)}</span>
          ),
        }]
      : []),
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (w) =>
        w.present === true ? (
          <Badge variant="success" label="PRESENT" dot />
        ) : (
          <Badge variant="danger" label="ABSENT" dot />
        ),
    },
    ...(canMarkAttendance
      ? [{
          key: 'toggle',
          header: 'Toggle Presence',
          align: 'right' as const,
          render: (w: WorkerAttendanceRecord) => (
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
        }]
      : []),
  ];

  const wageColumns: Column<MonthlyWagesResponse['workers'][number]>[] = [
    { key: 'code', header: 'Code', render: (w) => <span className="font-mono font-medium text-(--color-text)">{w.workerCode}</span> },
    { key: 'name', header: 'Worker Name', render: (w) => <span className="font-semibold text-(--color-text)">{w.workerName}</span> },
    { key: 'role', header: 'Role', render: (w) => <span className="text-(--color-text-muted)">{w.workerRole}</span> },
    { key: 'rate', header: 'Daily Rate', align: 'right', render: (w) => <span className="font-mono text-(--color-text-muted)">{formatCurrency(w.dailyWage)}</span> },
    { key: 'present', header: 'Days Present', align: 'right', render: (w) => <span className="font-mono font-bold text-emerald-700">{w.presentDays}</span> },
    { key: 'absent', header: 'Days Absent', align: 'right', render: (w) => <span className="font-mono text-rose-700">{w.absentDays}</span> },
    { key: 'total', header: 'Wages Earned', align: 'right', render: (w) => <span className="font-mono font-bold text-sm text-emerald-800">{formatCurrency(w.totalWage)}</span> },
    ...(canEditWages
      ? [{
          key: 'actions',
          header: 'Actions',
          align: 'right' as const,
          render: (w: WorkerWageSummary) => (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setWageTarget(w);
                setWageInput(String(w.dailyWage));
                setWageEditError('');
              }}
              className="text-xs"
            >
              <PencilSquareIcon className="w-4 h-4" />
              Edit daily wage
            </Button>
          ),
        }]
      : []),
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-(--color-border)">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-(--color-text) tracking-tight">
              Plant Attendance & Wage Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {isStaff ? 'My Attendance' : canMarkAttendance ? 'Daily Roster' : 'Staff Roster'}
            </span>
          </div>
          <p className="text-sm text-(--color-text-muted) mt-1">
            {isStaff
              ? 'View your recorded attendance and wages earned from days present.'
              : canMarkAttendance
                ? 'Record today’s attendance for every staff member.'
                : 'Review staff attendance and wages calculated from recorded present days.'}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void loadDaily(selectedDate);
            void loadWages(selectedMonth);
          }}
          className="text-xs self-start sm:self-auto"
        >
          <ArrowPathIcon className="w-4 h-4 text-(--color-text-muted)" />
          Refresh
        </Button>
      </div>

      {/* SECTION 1: Daily Attendance */}
      <section className="bg-white rounded-2xl border border-(--color-border) p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-(--color-surface-sunken)">
          <div className="flex items-center gap-2.5">
            <CalendarDaysIcon className="w-5 h-5 text-(--color-accent)" />
            <h2 className="text-base font-semibold text-(--color-text)">
              {isStaff ? 'My Daily Attendance' : canMarkAttendance ? 'Mark Today’s Attendance' : 'Daily Attendance'}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <label htmlFor="attendance-date" className="text-xs font-medium text-(--color-text-muted)">
              {canMarkAttendance ? 'Attendance Date:' : 'Select Date:'}
            </label>
            <input
              id="attendance-date"
              type="date"
              value={selectedDate}
              max={canMarkAttendance ? today : undefined}
              disabled={canMarkAttendance}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="rounded-lg border border-(--color-border) bg-white py-1.5 px-3 text-xs font-medium text-(--color-text) focus:outline-none focus:ring-1 focus:ring-(--color-accent) disabled:bg-(--color-surface-sunken)"
            />
            {canMarkAttendance ? (
              <span className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-(--color-surface-sunken) text-(--color-text-dark)">
                Today
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedDate(today)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-(--color-surface-sunken) text-(--color-text-dark) hover:bg-(--color-border) transition-colors"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {!dailyLoading && !dailyError && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-(--color-surface-alt) rounded-xl border border-(--color-border)">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="inline-flex items-center gap-1 rounded-lg border border-(--color-border) bg-white p-1" role="group" aria-label="Filter attendance by status">
                <button
                  type="button"
                  aria-pressed={attendanceFilter === 'ALL'}
                  onClick={() => {
                    setAttendanceFilter('ALL');
                    setDailyPage(0);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    attendanceFilter === 'ALL'
                      ? 'bg-(--color-accent-light) text-(--color-accent)'
                      : 'text-(--color-text-muted) hover:bg-(--color-bg)'
                  }`}
                >
                  Total Staff: <span className="font-mono font-semibold">{records.length}</span>
                </button>
                <button
                  type="button"
                  aria-pressed={attendanceFilter === 'PRESENT'}
                  onClick={() => {
                    setAttendanceFilter('PRESENT');
                    setDailyPage(0);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    attendanceFilter === 'PRESENT'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  Present: <span className="font-mono font-semibold">{presentCount}</span>
                </button>
                <button
                  type="button"
                  aria-pressed={attendanceFilter === 'ABSENT'}
                  onClick={() => {
                    setAttendanceFilter('ABSENT');
                    setDailyPage(0);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    attendanceFilter === 'ABSENT'
                      ? 'bg-rose-100 text-rose-800'
                      : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  Absent: <span className="font-mono font-semibold">{absentCount}</span>
                </button>
              </div>
            </div>

            {canMarkAttendance && (
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
        )}

        {dailyError ? (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700" role="alert">
            {dailyError}
          </div>
        ) : (
          <Table
            columns={dailyColumns}
            rows={visibleDailyRecords}
            loading={dailyLoading}
            rowKey={(w) => w.workerId}
            emptyTitle="No staff found"
            emptyDescription="No staff attendance records are available."
          />
        )}
        {!dailyError && (
          <Pagination
            page={visibleDailyPage}
            pageSize={pageSize}
            totalCount={filteredDailyRecords.length}
            itemLabel="staff members"
            onPageChange={setDailyPage}
          />
        )}

        {canMarkAttendance && !dailyError && (
          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              loading={saving}
              disabled={dailyLoading || records.length === 0}
              onClick={handleSave}
              className="shadow-xs text-xs py-2.5 px-5"
            >
              <CheckCircleIcon className="w-4 h-4" />
              Save {selectedDate} Attendance
            </Button>
          </div>
        )}
      </section>

      {/* SECTION 2: Monthly Wages */}
      {canSeeWages && (
        <section className="bg-white rounded-2xl border border-(--color-border) p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-(--color-surface-sunken)">
            <div className="flex items-center gap-2.5">
              <BanknotesIcon className="w-5 h-5 text-emerald-600" />
              <div>
                <h2 className="text-base font-semibold text-(--color-text)">
                  {isStaff ? 'My Monthly Wages' : 'Monthly Wage Summary'}
                </h2>
                <p className="text-xs text-(--color-text-muted)">
                  Wages are calculated as daily wage × recorded days present.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="attendance-month" className="text-xs font-medium text-(--color-text-muted)">Month:</label>
              <input
                id="attendance-month"
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="rounded-lg border border-(--color-border) bg-white py-1.5 px-3 text-xs font-medium text-(--color-text) focus:outline-none focus:ring-1 focus:ring-(--color-accent)"
              />
            </div>
          </div>

          {wagesData && !wagesError && (
            <StatGrid columns={3}>
              <StatCard
                icon={UsersIcon}
                label={isStaff ? 'Staff Member' : 'Active Staff'}
                value={wagesData.activeWorkers}
                sub="Staff on shift roster"
                tone="neutral"
              />
              <StatCard
                icon={ClockIcon}
                label="Days Present"
                value={`${wagesData.totalPresentDays} days`}
                sub={`Accumulated for ${wagesData.month}`}
                tone="neutral"
              />
              <StatCard
                icon={BanknotesIcon}
                label="Wages Earned"
                value={formatCurrency(wagesData.totalWages)}
                sub="Calculated by server wage ledger"
                tone="success"
              />
            </StatGrid>
          )}

          {wagesError ? (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700" role="alert">
              {wagesError}
            </div>
          ) : (
            <Table
              columns={wageColumns}
              rows={visibleWageWorkers}
              loading={wagesLoading}
              rowKey={(w) => w.workerId}
              emptyTitle="No records"
              emptyDescription={`No wage records are available for ${selectedMonth}.`}
            />
          )}
          {!wagesError && (
            <Pagination
              page={visibleWagePage}
              pageSize={pageSize}
              totalCount={wageWorkers.length}
              itemLabel="staff members"
              onPageChange={setWagePage}
            />
          )}
        </section>
      )}

      {canEditWages && (
        <Dialog
          open={wageTarget !== null}
          onClose={() => !wageSaving && setWageTarget(null)}
          title="Update Daily Wage"
          width="max-w-md"
        >
          {wageTarget && (
            <div className="space-y-4">
              <p className="text-sm text-(--color-text-muted)">
                Update the daily wage for <strong className="text-(--color-text)">{wageTarget.workerName}</strong>.
                Monthly wages are recalculated from this rate and recorded days present.
              </p>
              <Input
                id="staff-daily-wage"
                type="number"
                label="Daily wage"
                min="0"
                max="999999.99"
                step="0.01"
                value={wageInput}
                onChange={(event) => setWageInput(event.target.value)}
                disabled={wageSaving}
                required
              />
              {wageEditError && <Callout tone="danger">{wageEditError}</Callout>}
              <div className="pt-3 border-t border-(--color-border) flex justify-end gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setWageTarget(null)}
                  disabled={wageSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  loading={wageSaving}
                  onClick={handleSaveWage}
                >
                  Save Daily Wage
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
