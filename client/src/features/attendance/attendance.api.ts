import { api } from '../../lib/api';

export interface WorkerAttendanceRecord {
  workerId: string;
  workerCode: string;
  workerName: string;
  workerRole: string;
  dailyWage?: number;
  present: boolean;
}

export interface DailyAttendanceResponse {
  date: string;
  records: WorkerAttendanceRecord[];
}

export interface SaveAttendanceInput {
  date: string;
  records: {
    workerId: string;
    present: boolean;
  }[];
}

export interface WorkerWageSummary {
  workerId: string;
  workerCode: string;
  workerName: string;
  workerRole: string;
  dailyWage: number;
  presentDays: number;
  absentDays: number;
  totalWage: number;
}

export interface MonthlyWagesResponse {
  month: string;
  workers: WorkerWageSummary[];
  totalWages: number;
  totalPresentDays: number;
  activeWorkers: number;
}

export interface EmployeeSalarySummary {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  role: 'SUPERVISOR' | 'OFFICE';
  /** null until the owner sets a salary */
  monthlySalary: number | null;
  /** Calendar days on a salaried role this month (less after joining, promotion, or removal mid-month). */
  paidDays: number;
  daysInMonth: number;
  salaryDue: number;
}

export interface MonthlySalariesResponse {
  month: string;
  employees: EmployeeSalarySummary[];
  totalSalaries: number;
  salaryNotSet: number;
}

export function getAttendance(date: string): Promise<DailyAttendanceResponse> {
  return api<DailyAttendanceResponse>(`/attendance?date=${encodeURIComponent(date)}`);
}

export function saveAttendance(input: SaveAttendanceInput): Promise<DailyAttendanceResponse> {
  return api<DailyAttendanceResponse>('/attendance', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getWages(month: string): Promise<MonthlyWagesResponse> {
  return api<MonthlyWagesResponse>(`/attendance/wages?month=${encodeURIComponent(month)}`);
}

export function updateDailyWage(staffId: string, dailyWage: number): Promise<{ staffId: string; dailyWage: number }> {
  return api<{ staffId: string; dailyWage: number }>(`/attendance/staff/${staffId}/wage`, {
    method: 'PATCH',
    body: JSON.stringify({ dailyWage }),
  });
}

export function getSalaries(month: string): Promise<MonthlySalariesResponse> {
  return api<MonthlySalariesResponse>(`/attendance/salaries?month=${encodeURIComponent(month)}`);
}

export function updateMonthlySalary(staffId: string, monthlySalary: number): Promise<{ staffId: string; monthlySalary: number }> {
  return api<{ staffId: string; monthlySalary: number }>(`/attendance/staff/${staffId}/salary`, {
    method: 'PATCH',
    body: JSON.stringify({ monthlySalary }),
  });
}
