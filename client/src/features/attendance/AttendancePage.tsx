import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
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

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#E8E4DF]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[#1A1714] tracking-tight">
              Plant Attendance & Wage Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Shift Roster
            </span>
          </div>
          <p className="text-sm text-[#78716C] mt-1">
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
          <ArrowPathIcon className="w-4 h-4 text-[#78716C]" />
          Refresh
        </Button>
      </div>

      {/* SECTION 1: Daily Attendance Marker */}
      <section className="bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#F5F4F2]">
          <div className="flex items-center gap-2.5">
            <CalendarDaysIcon className="w-5 h-5 text-[#EA580C]" />
            <h2 className="text-base font-semibold text-[#1A1714]">
              Daily Attendance Roster
            </h2>
          </div>

          {/* Date Picker & Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="text-xs font-medium text-[#78716C]">Select Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-[#E8E4DF] bg-white py-1.5 px-3 text-xs font-medium text-[#1A1714] focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(formatApiDate(new Date()))}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#F5F4F2] text-[#44403C] hover:bg-[#E8E4DF] transition-colors"
            >
              Today
            </button>
          </div>
        </div>

        {/* Daily Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[#FBFBFA] rounded-xl border border-[#E8E4DF]">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-[#78716C]">
              Total Staff: <strong className="text-[#1A1714] font-mono">{records.length}</strong>
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
        {loadingDaily ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#78716C]">
            <Spinner />
            <p className="text-sm mt-3">Loading worker roster...</p>
          </div>
        ) : (
          <div className="border border-[#E8E4DF] rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F4F2] text-[#78716C] font-semibold border-b border-[#E8E4DF]">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Worker Name</th>
                  <th className="py-3 px-4">Role / Department</th>
                  <th className="py-3 px-4 text-right">Daily Wage</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Toggle Presence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F4F2]">
                {records.map((worker) => (
                  <tr
                    key={worker.workerId}
                    className={`hover:bg-[#FBFBFA] transition-colors ${
                      !worker.present ? 'bg-rose-50/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-[#1A1714]">
                      {worker.workerCode}
                    </td>

                    <td className="py-3 px-4 font-semibold text-sm text-[#1A1714]">
                      {worker.workerName}
                    </td>

                    <td className="py-3 px-4 text-[#78716C]">
                      {worker.workerRole}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-medium text-[#1A1714]">
                      {formatCurrency(worker.dailyWage)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {worker.present ? (
                        <Badge variant="success" label="PRESENT" dot />
                      ) : (
                        <Badge variant="danger" label="ABSENT" dot />
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => toggleStatus(worker.workerId)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          worker.present
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs hover:bg-emerald-700'
                            : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                        }`}
                      >
                        {worker.present ? 'Present' : 'Absent'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
      <section className="bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F5F4F2]">
          <div className="flex items-center gap-2.5">
            <BanknotesIcon className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-base font-semibold text-[#1A1714]">
                Monthly Wage Summary & Liabilities
              </h2>
              <p className="text-xs text-[#78716C]">
                Cumulative present days and payroll liability directly retrieved from attendance data.
              </p>
            </div>
          </div>

          {/* Month selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#78716C]">Month:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-lg border border-[#E8E4DF] bg-white py-1.5 px-3 text-xs font-medium text-[#1A1714] focus:outline-none focus:ring-1 focus:ring-[#EA580C]"
            />
          </div>
        </div>

        {/* Wage KPI Cards */}
        {wagesData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#FBFBFA] rounded-xl border border-[#E8E4DF] p-4">
              <span className="text-xs text-[#78716C] uppercase font-semibold">Active Workers</span>
              <div className="text-2xl font-bold text-[#1A1714] font-mono mt-1">
                {wagesData.activeWorkers}
              </div>
              <div className="text-[11px] text-[#A8A29E] mt-0.5">Staff on shift roster</div>
            </div>

            <div className="bg-[#FBFBFA] rounded-xl border border-[#E8E4DF] p-4">
              <span className="text-xs text-[#78716C] uppercase font-semibold">Total Shifts Worked</span>
              <div className="text-2xl font-bold text-[#1A1714] font-mono mt-1">
                {wagesData.totalPresentDays} <span className="text-xs font-sans text-[#78716C]">days</span>
              </div>
              <div className="text-[11px] text-[#A8A29E] mt-0.5">Accumulated for {wagesData.month}</div>
            </div>

            <div className="bg-emerald-50/40 rounded-xl border border-emerald-200 p-4">
              <span className="text-xs text-emerald-800 uppercase font-semibold">Total Wages Payable</span>
              <div className="text-2xl font-bold text-emerald-900 font-mono mt-1">
                {formatCurrency(wagesData.totalWages)}
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5">Calculated by server wage ledger</div>
            </div>
          </div>
        )}

        {/* Monthly Worker Breakdown Table */}
        {loadingWages ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#78716C]">
            <Spinner />
            <p className="text-sm mt-3">Compiling monthly wages...</p>
          </div>
        ) : !wagesData || wagesData.workers.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#78716C]">
            No attendance records found for {selectedMonth}.
          </div>
        ) : (
          <div className="border border-[#E8E4DF] rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F4F2] text-[#78716C] font-semibold border-b border-[#E8E4DF]">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Worker Name</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-right">Daily Rate</th>
                  <th className="py-3 px-4 text-right">Days Present</th>
                  <th className="py-3 px-4 text-right">Total Wage Entitlement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F4F2]">
                {wagesData.workers.map((w) => (
                  <tr key={w.workerId} className="hover:bg-[#FBFBFA]">
                    <td className="py-3 px-4 font-mono font-medium text-[#1A1714]">{w.workerCode}</td>
                    <td className="py-3 px-4 font-semibold text-[#1A1714]">{w.workerName}</td>
                    <td className="py-3 px-4 text-[#78716C]">{w.workerRole}</td>
                    <td className="py-3 px-4 text-right font-mono text-[#78716C]">
                      {formatCurrency(w.dailyWage)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#1A1714]">
                      {w.presentDays} days
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-sm text-emerald-800">
                      {formatCurrency(w.totalWage)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
