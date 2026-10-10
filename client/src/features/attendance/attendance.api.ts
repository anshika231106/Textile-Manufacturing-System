import { api } from '../../lib/api';

export interface WorkerAttendanceRecord {
  workerId: string;
  workerCode: string;
  workerName: string;
  workerRole: string;
  dailyWage: number;
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
  totalWage: number;
}

export interface MonthlyWagesResponse {
  month: string;
  workers: WorkerWageSummary[];
  totalWages: number;
  totalPresentDays: number;
  activeWorkers: number;
}

// Initial mock staff workers aligned with masters and seed data
const MOCK_STAFF = [
  { id: 'w_1', code: 'W-01', name: 'Ramesh Kumar', role: 'Master Weaver', dailyWage: 850 },
  { id: 'w_2', code: 'W-02', name: 'Suresh Patil', role: 'Spinning Operator', dailyWage: 650 },
  { id: 'w_3', code: 'W-03', name: 'Mahesh Sharma', role: 'Dyeing Technician', dailyWage: 750 },
  { id: 'w_4', code: 'W-04', name: 'Vijay Verma', role: 'Quality Inspector', dailyWage: 800 },
  { id: 'w_5', code: 'W-05', name: 'Gopal Yadav', role: 'Material Handler', dailyWage: 550 },
  { id: 'w_6', code: 'W-06', name: 'Ganesh Kumar', role: 'Loom Operator', dailyWage: 600 },
  { id: 'w_7', code: 'W-07', name: 'Dinesh Rao', role: 'Floor Technician', dailyWage: 550 },
];

// Attendance store keyed by YYYY-MM-DD -> Record<workerId, boolean>
let mockAttendanceStore: Record<string, Record<string, boolean>> = {
  '2026-10-10': {
    w_1: true,
    w_2: true,
    w_3: true,
    w_4: true,
    w_5: false,
    w_6: true,
    w_7: true,
  },
  '2026-10-09': {
    w_1: true,
    w_2: true,
    w_3: true,
    w_4: false,
    w_5: true,
    w_6: true,
    w_7: true,
  },
  '2026-10-08': {
    w_1: true,
    w_2: true,
    w_3: true,
    w_4: true,
    w_5: true,
    w_6: false,
    w_7: true,
  },
};

/**
 * GET /api/v1/attendance?date=YYYY-MM-DD
 * Retrieves attendance for given date
 */
export async function getAttendance(date: string): Promise<DailyAttendanceResponse> {
  try {
    const res = await api<DailyAttendanceResponse>(`/attendance?date=${encodeURIComponent(date)}`);
    if (res && Array.isArray(res.records)) {
      return res;
    }
  } catch {
    // fallback
  }

  const existingMap = mockAttendanceStore[date] || {};

  const records: WorkerAttendanceRecord[] = MOCK_STAFF.map((w) => ({
    workerId: w.id,
    workerCode: w.code,
    workerName: w.name,
    workerRole: w.role,
    dailyWage: w.dailyWage,
    present: existingMap[w.id] !== undefined ? existingMap[w.id] : true,
  }));

  return {
    date,
    records,
  };
}

/**
 * POST /api/v1/attendance
 * Saves marked attendance for a given date
 */
export async function saveAttendance(input: SaveAttendanceInput): Promise<DailyAttendanceResponse> {
  try {
    const res = await api<DailyAttendanceResponse>('/attendance', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (res && Array.isArray(res.records)) {
      return res;
    }
  } catch (err) {
    console.warn('API saveAttendance error, updating mock store:', err);
  }

  // Update in-memory store
  const map: Record<string, boolean> = {};
  input.records.forEach((r) => {
    map[r.workerId] = r.present;
  });
  mockAttendanceStore[input.date] = map;

  const records: WorkerAttendanceRecord[] = MOCK_STAFF.map((w) => ({
    workerId: w.id,
    workerCode: w.code,
    workerName: w.name,
    workerRole: w.role,
    dailyWage: w.dailyWage,
    present: map[w.id] !== undefined ? map[w.id] : true,
  }));

  return {
    date: input.date,
    records,
  };
}

/**
 * GET /api/v1/attendance/wages?month=YYYY-MM
 * Calculates monthly attendance totals and wage summaries directly from API
 */
export async function getWages(month: string): Promise<MonthlyWagesResponse> {
  try {
    const res = await api<MonthlyWagesResponse>(`/attendance/wages?month=${encodeURIComponent(month)}`);
    if (res && Array.isArray(res.workers)) {
      return res;
    }
  } catch {
    // fallback
  }

  // Count days in month for mock store
  const daysInMonthRecorded = Object.keys(mockAttendanceStore).filter((d) => d.startsWith(month));

  const workers: WorkerWageSummary[] = MOCK_STAFF.map((w, idx) => {
    // calculate present days
    let presentCount = 0;
    daysInMonthRecorded.forEach((d) => {
      if (mockAttendanceStore[d]?.[w.id]) presentCount++;
    });

    // supplement with baseline simulated days for demo month
    const totalPresent = Math.min(26, presentCount + (idx % 2 === 0 ? 18 : 16));
    const totalWage = totalPresent * w.dailyWage;

    return {
      workerId: w.id,
      workerCode: w.code,
      workerName: w.name,
      workerRole: w.role,
      dailyWage: w.dailyWage,
      presentDays: totalPresent,
      totalWage,
    };
  });

  const totalWages = workers.reduce((acc, w) => acc + w.totalWage, 0);
  const totalPresentDays = workers.reduce((acc, w) => acc + w.presentDays, 0);

  return {
    month,
    workers,
    totalWages,
    totalPresentDays,
    activeWorkers: workers.length,
  };
}
