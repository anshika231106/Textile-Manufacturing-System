import { api } from '../../lib/api';

export interface WorkerAttendanceRecord {
  workerId: string;
  workerCode: string;
  workerName: string;
  workerRole: string;
  dailyWage?: number;
  present: boolean | null;
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
