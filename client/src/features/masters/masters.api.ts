import { api } from '../../lib/api';

export interface Buyer {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  createdAt?: string;
}

export interface YarnType {
  id: string;
  code: string;
  name: string;
  colour: string;
  countLabel?: string;
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


export let MOCK_BUYERS: Buyer[] = [
  { id: 'b_1', name: 'Nimesh Pathak Textiles', contactName: 'Nimesh Pathak', phone: '9876543210', email: 'nimesh@pathaktextiles.in' },
  { id: 'b_2', name: 'Raymond Apparel Ltd', contactName: 'Rajesh Sharma', phone: '9822012345', email: 'r.sharma@raymond.com' },
  { id: 'b_3', name: 'Bombay Dyeing & Mfg', contactName: 'Sunil Wadia', phone: '9819055443', email: 'sunil@bombaydyeing.com' },
  { id: 'b_4', name: 'Arvind Garments Hub', contactName: 'Mehul Lalbhai', phone: '9845099887', email: 'mehul@arvindmills.com' },
];

export let MOCK_SUPPLIERS: Supplier[] = [
  { id: 'sup_1', name: 'Vardhman Yarns Ltd', contactName: 'Anil Oswal', phone: '9814012345', email: 'sales@vardhman.com' },
  { id: 'sup_2', name: 'Reliance Petro Yarns', contactName: 'Kishore Ambani', phone: '9820055443', email: 'yarns@ril.com' },
  { id: 'sup_3', name: 'Grasim Industries', contactName: 'Ramesh Birla', phone: '9833077665', email: 'contact@grasim.adityabirla.com' },
  { id: 'sup_4', name: 'Nahar Spinning Mills', contactName: 'Dinesh Oswal', phone: '9815044332', email: 'nahar.spg@nahargroup.com' },
];

export let MOCK_YARN_TYPES: YarnType[] = [
  { id: 'yt_1', code: 'COT-40-WHT', name: 'Cotton 40s Comb', colour: 'White', countLabel: '40s', reorderLevelKg: 100, availableKg: 70 },
  { id: 'yt_2', code: 'COT-30-NAT', name: 'Cotton 30s Carded', colour: 'Natural', countLabel: '30s', reorderLevelKg: 150, availableKg: 80 },
  { id: 'yt_3', code: 'POLY-60-BLK', name: 'Polyester 60s Spun', colour: 'Black', countLabel: '60s', reorderLevelKg: 80, availableKg: 200 },
  { id: 'yt_4', code: 'LIN-20-RAW', name: 'Linen 20s Slub', colour: 'Raw Beige', countLabel: '20s', reorderLevelKg: 50, availableKg: 15 },
  { id: 'yt_5', code: 'VIS-30-RED', name: 'Viscose 30s Rayon', colour: 'Crimson Red', countLabel: '30s', reorderLevelKg: 60, availableKg: 200 },
];

export let MOCK_MACHINES: Machine[] = [
  { id: 'm_1', code: 'SPIN-01', name: 'Spinning Ring Frame 1', stage: 'SPINNING', status: 'RUNNING', ratePerMetre: 12.5 },
  { id: 'm_2', code: 'SPIN-02', name: 'Spinning Ring Frame 2', stage: 'SPINNING', status: 'IDLE', ratePerMetre: 12.5 },
  { id: 'm_3', code: 'LOOM-01', name: 'Air-Jet Loom 1', stage: 'WEAVING', status: 'RUNNING', ratePerMetre: 28.0 },
  { id: 'm_4', code: 'LOOM-02', name: 'Rapier Loom 2', stage: 'WEAVING', status: 'IDLE', ratePerMetre: 32.0 },
  { id: 'm_5', code: 'LOOM-03', name: 'Air-Jet Loom 3', stage: 'WEAVING', status: 'BREAKDOWN', ratePerMetre: 28.0 },
  { id: 'm_6', code: 'DYE-01', name: 'Soft-Flow Jet Dyeing 1', stage: 'DYEING', status: 'RUNNING', ratePerMetre: 45.0 },
  { id: 'm_7', code: 'DYE-02', name: 'Jigger Dyeing Machine 2', stage: 'DYEING', status: 'IDLE', ratePerMetre: 38.0 },
];


// Rows from the MOCK_* fallbacks have local ids (e.g. "b_1"), not database UUIDs.
const isMockId = (id: string) => !/^[0-9a-f-]{36}$/i.test(id);

// --- Buyers ---
export async function listBuyers(): Promise<Buyer[]> {
  try {
    const res = await api<Buyer[]>('/masters/buyers');
    if (Array.isArray(res) && res.length > 0) return res;
    return MOCK_BUYERS;
  } catch {
    return MOCK_BUYERS;
  }
}

export async function createBuyer(input: {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
}): Promise<Buyer> {
  try {
    const res = await api<Buyer>('/masters/buyers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (res && res.id) return res;
  } catch (err) {
    console.warn('API create buyer error, updating mock store:', err);
  }

  const created: Buyer = {
    id: `b_${Date.now()}`,
    ...input,
    createdAt: new Date().toISOString(),
  };
  MOCK_BUYERS = [created, ...MOCK_BUYERS];
  return created;
}

export async function deleteBuyer(id: string): Promise<void> {
  if (isMockId(id)) {
    MOCK_BUYERS = MOCK_BUYERS.filter((r) => r.id !== id);
    return;
  }
  await api(`/masters/buyers/${id}`, { method: 'DELETE' });
}

// --- Suppliers ---
export async function listSuppliers(): Promise<Supplier[]> {
  try {
    const res = await api<Supplier[]>('/masters/suppliers');
    if (Array.isArray(res) && res.length > 0) return res;
    return MOCK_SUPPLIERS;
  } catch {
    return MOCK_SUPPLIERS;
  }
}

export async function createSupplier(input: {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
}): Promise<Supplier> {
  try {
    const res = await api<Supplier>('/masters/suppliers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (res && res.id) return res;
  } catch (err) {
    console.warn('API create supplier error, updating mock store:', err);
  }

  const created: Supplier = {
    id: `sup_${Date.now()}`,
    ...input,
    createdAt: new Date().toISOString(),
  };
  MOCK_SUPPLIERS = [created, ...MOCK_SUPPLIERS];
  return created;
}

export async function deleteSupplier(id: string): Promise<void> {
  if (isMockId(id)) {
    MOCK_SUPPLIERS = MOCK_SUPPLIERS.filter((r) => r.id !== id);
    return;
  }
  await api(`/masters/suppliers/${id}`, { method: 'DELETE' });
}

// --- Yarn Types ---
export async function listYarnTypes(): Promise<YarnType[]> {
  try {
    const res = await api<YarnType[]>('/masters/yarn-types');
    if (Array.isArray(res) && res.length > 0) return res;
    return MOCK_YARN_TYPES;
  } catch {
    return MOCK_YARN_TYPES;
  }
}

export async function createYarnType(input: {
  code: string;
  name: string;
  colour: string;
  countLabel?: string;
  reorderLevelKg: number;
}): Promise<YarnType> {
  try {
    const res = await api<YarnType>('/masters/yarn-types', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (res && res.id) return res;
  } catch (err) {
    console.warn('API create yarn type error, updating mock store:', err);
  }

  const created: YarnType = {
    id: `yt_${Date.now()}`,
    ...input,
    availableKg: 0,
    createdAt: new Date().toISOString(),
  };
  MOCK_YARN_TYPES = [created, ...MOCK_YARN_TYPES];
  return created;
}

export async function deleteYarnType(id: string): Promise<void> {
  if (isMockId(id)) {
    MOCK_YARN_TYPES = MOCK_YARN_TYPES.filter((r) => r.id !== id);
    return;
  }
  await api(`/masters/yarn-types/${id}`, { method: 'DELETE' });
}

// --- Machines ---
export async function listMachines(): Promise<Machine[]> {
  try {
    const res = await api<Machine[]>('/masters/machines');
    if (Array.isArray(res) && res.length > 0) return res;
    return MOCK_MACHINES;
  } catch {
    return MOCK_MACHINES;
  }
}

export async function createMachine(input: {
  code: string;
  name: string;
  stage: 'SPINNING' | 'WEAVING' | 'DYEING';
  status?: 'IDLE' | 'RUNNING' | 'BREAKDOWN';
  ratePerMetre: number;
}): Promise<Machine> {
  try {
    const res = await api<Machine>('/masters/machines', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (res && res.id) return res;
  } catch (err) {
    console.warn('API create machine error, updating mock store:', err);
  }

  const created: Machine = {
    id: `m_${Date.now()}`,
    code: input.code,
    name: input.name,
    stage: input.stage,
    status: input.status || 'IDLE',
    ratePerMetre: input.ratePerMetre,
    createdAt: new Date().toISOString(),
  };
  MOCK_MACHINES = [created, ...MOCK_MACHINES];
  return created;
}

