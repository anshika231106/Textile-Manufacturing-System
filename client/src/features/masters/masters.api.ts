import { api } from '../../lib/api';

export interface Buyer {
  id: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  createdAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  createdAt?: string;
}

export interface YarnType {
  id: string;
  code: string;
  name: string;
  colour: string;
  countLabel?: string | null;
  reorderLevelKg: number;
  availableKg?: number;
  onHandKg?: number;
  reservedKg?: number;
  createdAt?: string;
}


export interface Machine {
  id: string;
  code: string;
  name: string;
  stage: 'SPINNING' | 'WEAVING' | 'DYEING';
  status: 'IDLE' | 'RUNNING' | 'BREAKDOWN';
  ratePerMetre: number;
  createdAt?: string;
}


// Offline fallbacks used by the New Order page; the masters page always shows live data.
export const MOCK_BUYERS: Buyer[] = [
  { id: 'b_1', name: 'Nimesh Pathak Textiles', contactName: 'Nimesh Pathak', phone: '9876543210', email: 'nimesh@pathaktextiles.in' },
  { id: 'b_2', name: 'Raymond Apparel Ltd', contactName: 'Rajesh Sharma', phone: '9822012345', email: 'r.sharma@raymond.com' },
  { id: 'b_3', name: 'Bombay Dyeing & Mfg', contactName: 'Sunil Wadia', phone: '9819055443', email: 'sunil@bombaydyeing.com' },
  { id: 'b_4', name: 'Arvind Garments Hub', contactName: 'Mehul Lalbhai', phone: '9845099887', email: 'mehul@arvindmills.com' },
];

export const MOCK_YARN_TYPES: YarnType[] = [
  { id: 'yt_1', code: 'COT-40-WHT', name: 'Cotton 40s Comb', colour: 'White', countLabel: '40s', reorderLevelKg: 100, availableKg: 70 },
  { id: 'yt_2', code: 'COT-30-NAT', name: 'Cotton 30s Carded', colour: 'Natural', countLabel: '30s', reorderLevelKg: 150, availableKg: 80 },
  { id: 'yt_3', code: 'POLY-60-BLK', name: 'Polyester 60s Spun', colour: 'Black', countLabel: '60s', reorderLevelKg: 80, availableKg: 200 },
  { id: 'yt_4', code: 'LIN-20-RAW', name: 'Linen 20s Slub', colour: 'Raw Beige', countLabel: '20s', reorderLevelKg: 50, availableKg: 15 },
  { id: 'yt_5', code: 'VIS-30-RED', name: 'Viscose 30s Rayon', colour: 'Crimson Red', countLabel: '30s', reorderLevelKg: 60, availableKg: 200 },
];


// --- Buyers ---
export type BuyerInput = {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
};

export function listBuyers(): Promise<Buyer[]> {
  return api<Buyer[]>('/masters/buyers');
}

export function createBuyer(input: BuyerInput): Promise<Buyer> {
  return api<Buyer>('/masters/buyers', { method: 'POST', body: JSON.stringify(input) });
}

export function updateBuyer(id: string, input: Partial<BuyerInput>): Promise<Buyer> {
  return api<Buyer>(`/masters/buyers/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function deleteBuyer(id: string): Promise<void> {
  await api(`/masters/buyers/${id}`, { method: 'DELETE' });
}

// --- Suppliers ---
export type SupplierInput = {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
};

export function listSuppliers(): Promise<Supplier[]> {
  return api<Supplier[]>('/masters/suppliers');
}

export function createSupplier(input: SupplierInput): Promise<Supplier> {
  return api<Supplier>('/masters/suppliers', { method: 'POST', body: JSON.stringify(input) });
}

export function updateSupplier(id: string, input: Partial<SupplierInput>): Promise<Supplier> {
  return api<Supplier>(`/masters/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function deleteSupplier(id: string): Promise<void> {
  await api(`/masters/suppliers/${id}`, { method: 'DELETE' });
}

// --- Yarn Types ---
export type YarnTypeInput = {
  code: string;
  name: string;
  colour: string;
  countLabel?: string;
  reorderLevelKg: number;
};

export function listYarnTypes(): Promise<YarnType[]> {
  return api<YarnType[]>('/masters/yarn-types');
}

export function createYarnType(input: YarnTypeInput): Promise<YarnType> {
  return api<YarnType>('/masters/yarn-types', { method: 'POST', body: JSON.stringify(input) });
}

export function updateYarnType(id: string, input: Partial<YarnTypeInput>): Promise<YarnType> {
  return api<YarnType>(`/masters/yarn-types/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function deleteYarnType(id: string): Promise<void> {
  await api(`/masters/yarn-types/${id}`, { method: 'DELETE' });
}

// --- Machines ---
export type MachineInput = {
  code: string;
  name: string;
  stage: 'SPINNING' | 'WEAVING' | 'DYEING';
  status?: 'IDLE' | 'RUNNING' | 'BREAKDOWN';
  ratePerMetre: number;
};

// Stage and status cannot be edited: stage is fixed, status is set from the floor.
export type MachineUpdate = Partial<Pick<MachineInput, 'code' | 'name' | 'ratePerMetre'>>;

export function listMachines(): Promise<Machine[]> {
  return api<Machine[]>('/masters/machines');
}

export function createMachine(input: MachineInput): Promise<Machine> {
  return api<Machine>('/masters/machines', { method: 'POST', body: JSON.stringify(input) });
}

export function updateMachine(id: string, input: MachineUpdate): Promise<Machine> {
  return api<Machine>(`/masters/machines/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function deleteMachine(id: string): Promise<void> {
  await api(`/masters/machines/${id}`, { method: 'DELETE' });
}
