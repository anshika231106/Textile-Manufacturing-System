import { api } from '../../lib/api';

export interface Buyer {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone: string;
  email?: string;
}

export interface YarnType {
  id: string;
  code: string;
  name: string;
  colour: string;
  countLabel: string;
  reorderLevelKg: number;
  availableKg?: number;
}

export interface Machine {
  id: string;
  code: string;
  name: string;
  stage: 'SPINNING' | 'WEAVING' | 'DYEING';
  status: 'IDLE' | 'RUNNING' | 'BREAKDOWN';
  ratePerMetre: number;
}

export interface Worker {
  id: string;
  name: string;
  phone: string;
  role: string;
  dailyWage: number;
}

export const MOCK_BUYERS: Buyer[] = [
  { id: 'b_1', name: 'Nimesh Pathak Textiles', contactName: 'Nimesh Pathak', phone: '9876543210', email: 'nimesh@pathaktextiles.in' },
  { id: 'b_2', name: 'Raymond Apparel Ltd', contactName: 'Rajesh Sharma', phone: '9822012345', email: 'r.sharma@raymond.com' },
  { id: 'b_3', name: 'Bombay Dyeing & Mfg', contactName: 'Sunil Wadia', phone: '9819055443', email: 'sunil@bombaydyeing.com' },
  { id: 'b_4', name: 'Arvind Garments Hub', contactName: 'Mehul Lalbhai', phone: '9845099887', email: 'mehul@arvindmills.com' },
];

export const MOCK_YARN_TYPES: YarnType[] = [
  { id: 'yt_1', code: 'COT-40-WHT', name: 'Cotton 40s Comb', colour: 'White', countLabel: '40s', reorderLevelKg: 100, availableKg: 450 },
  { id: 'yt_2', code: 'COT-30-NAT', name: 'Cotton 30s Carded', colour: 'Natural', countLabel: '30s', reorderLevelKg: 150, availableKg: 80 },
  { id: 'yt_3', code: 'POLY-60-BLK', name: 'Polyester 60s Spun', colour: 'Black', countLabel: '60s', reorderLevelKg: 80, availableKg: 320 },
  { id: 'yt_4', code: 'LIN-20-RAW', name: 'Linen 20s Slub', colour: 'Raw Beige', countLabel: '20s', reorderLevelKg: 50, availableKg: 15 },
  { id: 'yt_5', code: 'VIS-30-RED', name: 'Viscose 30s Rayon', colour: 'Crimson Red', countLabel: '30s', reorderLevelKg: 60, availableKg: 200 },
];

export async function listBuyers(): Promise<Buyer[]> {
  try {
    const res = await api<Buyer[]>('/masters/buyers');
    if (Array.isArray(res) && res.length > 0) return res;
    return MOCK_BUYERS;
  } catch {
    return MOCK_BUYERS;
  }
}

export async function listYarnTypes(): Promise<YarnType[]> {
  try {
    const res = await api<YarnType[]>('/masters/yarn-types');
    if (Array.isArray(res) && res.length > 0) return res;
    return MOCK_YARN_TYPES;
  } catch {
    return MOCK_YARN_TYPES;
  }
}
