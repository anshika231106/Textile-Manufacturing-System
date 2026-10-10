import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { formatCurrency, formatApiMonth } from '../../lib/format';
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

export function AttendancePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const today = plantToday();
  const isStaff = user?.role === 'STAFF';
  const canMarkAttendance = user?.role === 'SUPERVISOR';
  const canSeeWages = user?.role === 'OFFICE' || user?.role === 'OWNER' || isStaff;

  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(formatApiMonth(new Date()));
  const [records, setRecords] = useState<WorkerAttendanceRecord[]>([]);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyError, setDailyError] = useState('');
  const [saving, setSaving] = useState(false);
  const [wagesData, setWagesData] = useState<MonthlyWagesResponse | null>(null);
  const [wagesLoading, setWagesLoading] = useState(canSeeWages);
  const [wagesError, setWagesError] = useState('');

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
    void loadDaily(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
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
    if (records.some((record) => record.present === null)) {
      showToast('Mark every staff member present or absent before saving.', 'error');
      return;
    }

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

  const presentCount = records.filter((record) => record.present === true).length;
  const absentCount = records.filter((record) => record.present === false).length;
  const unmarkedCount = records.filter((record) => record.present === null).length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#E8E4DF]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[#1A1714] tracking-tight">Attendance & Wages</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {isStaff ? 'My Attendance' : canMarkAttendance ? 'Daily Roster' : 'Staff Roster'}
            </span>
          </div>
          <p className="text-sm text-[#78716C] mt-1">
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
          <ArrowPathIcon className="w-4 h-4 text-[#78716C]" />
          Refresh
        </Button>
      </div>

      <section className="bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#F5F4F2]">
          <div className="flex items-center gap-2.5">
            <CalendarDaysIcon className="w-5 h-5 text-[#EA580C]" />
            <h2 className="text-base font-semibold text-[#1A1714]">
              {isStaff ? 'My Daily Attendance' : canMarkAttendance ? 'Mark Today’s Attendance' : 'Daily Attendance'}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <label htmlFor="attendance-date" className="text-xs font-medium text-[#78716C]">
              {canMarkAttendance ? 'Attendance Date:' : 'Select Date:'}
            </label>
            <input
              id="attendance-date"
              type="date"
              value={selectedDate}
              max={canMarkAttendance ? today : undefined}
              disabled={canMarkAttendance}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="rounded-lg border border-[#E8E4DF] bg-white py-1.5 px-3 text-xs font-medium text-[#1A1714] focus:outline-none focus:ring-1 focus:ring-[#EA580C] disabled:bg-[#F5F4F2]"
            />
            {canMarkAttendance && (
              <span className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#F5F4F2] text-[#44403C]">
                Today
              </span>
            )}
          </div>
        </div>

        {!dailyLoading && !dailyError && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[#FBFBFA] rounded-xl border border-[#E8E4DF]">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="text-[#78716C]">
                Total Staff: <strong className="text-[#1A1714] font-mono">{records.length}</strong>
              </span>
              <span className="text-emerald-700 font-medium">
                Present: <strong className="font-mono">{presentCount}</strong>
              </span>
              <span className="text-rose-700 font-medium">
                Absent: <strong className="font-mono">{absentCount}</strong>
              </span>
              {unmarkedCount > 0 && (
                <span className="text-amber-700 font-medium">
                  Not marked: <strong className="font-mono">{unmarkedCount}</strong>
                </span>
              )}
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

        {dailyError && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700" role="alert">
            {dailyError}
          </div>
        )}

        {dailyLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#78716C]">
            <Spinner />
            <p className="text-sm mt-3">Loading attendance...</p>
          </div>
        ) : !dailyError && records.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#78716C]">No staff attendance records are available.</div>
        ) : !dailyError ? (
          <div className="border border-[#E8E4DF] rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F4F2] text-[#78716C] font-semibold border-b border-[#E8E4DF]">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Worker Name</th>
                  <th className="py-3 px-4">Role / Department</th>
                  {canSeeWages && <th className="py-3 px-4 text-right">Daily Wage</th>}
                  <th className="py-3 px-4 text-center">Status</th>
                  {canMarkAttendance && <th className="py-3 px-4 text-right">Toggle Presence</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F4F2]">
                {records.map((record) => (
                  <tr
                    key={record.workerId}
                    className={`hover:bg-[#FBFBFA] transition-colors ${
                      record.present === false ? 'bg-rose-50/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-[#1A1714]">{record.workerCode}</td>
                    <td className="py-3 px-4 font-semibold text-sm text-[#1A1714]">{record.workerName}</td>
                    <td className="py-3 px-4 text-[#78716C]">{record.workerRole}</td>
                    {canSeeWages && (
                      <td className="py-3 px-4 text-right font-mono font-medium text-[#1A1714]">
                        {formatCurrency(record.dailyWage ?? 0)}
                      </td>
                    )}
                    <td className="py-3 px-4 text-center">
                      {record.present === true ? (
                        <Badge variant="success" label="PRESENT" dot />
                      ) : record.present === false ? (
                        <Badge variant="danger" label="ABSENT" dot />
                      ) : (
                        <Badge variant="warning" label="NOT MARKED" dot />
                      )}
                    </td>
                    {canMarkAttendance && (
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => toggleStatus(record.workerId)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            record.present === true
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs hover:bg-emerald-700'
                              : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                          }`}
                        >
                          {record.present === true ? 'Present' : record.present === false ? 'Absent' : 'Mark Present'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {canMarkAttendance && !dailyError && (
          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              loading={saving}
              disabled={dailyLoading || records.length === 0 || unmarkedCount > 0}
              onClick={handleSave}
              className="shadow-xs text-xs py-2.5 px-5"
            >
              <CheckCircleIcon className="w-4 h-4" />
              Save {selectedDate} Attendance
            </Button>
          </div>
        )}
      </section>

      {canSeeWages && (
        <section className="bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F5F4F2]">
            <div className="flex items-center gap-2.5">
              <BanknotesIcon className="w-5 h-5 text-emerald-600" />
              <div>
                <h2 className="text-base font-semibold text-[#1A1714]">
                  {isStaff ? 'My Monthly Wages' : 'Monthly Wage Summary'}
                </h2>
                <p className="text-xs text-[#78716C]">
                  Wages are calculated as daily wage × recorded days present.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="attendance-month" className="text-xs font-medium text-[#78716C]">Month:</label>
              <input
                id="attendance-month"
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="rounded-lg border border-[#E8E4DF] bg-white py-1.5 px-3 text-xs font-medium text-[#1A1714] focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
              />
            </div>
          </div>

          {wagesError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700" role="alert">
              {wagesError}
            </div>
          )}

          {wagesLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#78716C]">
              <Spinner />
              <p className="text-sm mt-3">Calculating monthly wages...</p>
            </div>
          ) : wagesError ? null : !wagesData || wagesData.workers.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#78716C]">
              No wage records are available for {selectedMonth}.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#FBFBFA] rounded-xl border border-[#E8E4DF] p-4">
                  <span className="text-xs text-[#78716C] uppercase font-semibold">
                    {isStaff ? 'Staff Member' : 'Active Staff'}
                  </span>
                  <div className="text-2xl font-bold text-[#1A1714] font-mono mt-1">
                    {wagesData.activeWorkers}
                  </div>
                </div>
                <div className="bg-[#FBFBFA] rounded-xl border border-[#E8E4DF] p-4">
                  <span className="text-xs text-[#78716C] uppercase font-semibold">Days Present</span>
                  <div className="text-2xl font-bold text-[#1A1714] font-mono mt-1">
                    {wagesData.totalPresentDays}
                  </div>
                </div>
                <div className="bg-emerald-50/40 rounded-xl border border-emerald-200 p-4">
                  <span className="text-xs text-emerald-800 uppercase font-semibold">Wages Earned</span>
                  <div className="text-2xl font-bold text-emerald-900 font-mono mt-1">
                    {formatCurrency(wagesData.totalWages)}
                  </div>
                </div>
              </div>

              <div className="border border-[#E8E4DF] rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F5F4F2] text-[#78716C] font-semibold border-b border-[#E8E4DF]">
                    <tr>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Worker Name</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4 text-right">Daily Rate</th>
                      <th className="py-3 px-4 text-right">Days Present</th>
                      <th className="py-3 px-4 text-right">Days Absent</th>
                      <th className="py-3 px-4 text-right">Wages Earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F4F2]">
                    {wagesData.workers.map((worker) => (
                      <tr key={worker.workerId} className="hover:bg-[#FBFBFA]">
                        <td className="py-3 px-4 font-mono font-medium text-[#1A1714]">{worker.workerCode}</td>
                        <td className="py-3 px-4 font-semibold text-[#1A1714]">{worker.workerName}</td>
                        <td className="py-3 px-4 text-[#78716C]">{worker.workerRole}</td>
                        <td className="py-3 px-4 text-right font-mono text-[#78716C]">
                          {formatCurrency(worker.dailyWage)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          {worker.presentDays}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-rose-700">{worker.absentDays}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-sm text-emerald-800">
                          {formatCurrency(worker.totalWage)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
