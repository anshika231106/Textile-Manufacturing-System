/**
 * End-to-end smoke test for the whole MillTrace workflow (MVP Section 4 / 15):
 *
 *   auth -> masters -> yarn receipt -> feasibility -> order -> start production
 *   -> spinning / weaving / dyeing jobs and logs -> rolls -> QC -> buyer tracking
 *   -> dispatch + invoice -> payments -> attendance + wages -> month-end report
 *
 * Fixtures (throwaway users, buyer, supplier, yarn type, machines) are created
 * directly through Prisma with a unique per-run suffix; every workflow step goes
 * through the real HTTP API. By default the Express app is booted in-process on a
 * random port, so the code under test is the code in this checkout. Set
 * SMOKE_BASE_URL (e.g. http://localhost:4000/api/v1) to target a running server.
 *
 * Everything the run creates is deleted at the end (SMOKE_KEEP=1 keeps it for
 * inspection). Counters (ORD-/DSP-/INV- numbers) still advance.
 *
 * Usage:  npm run smoke
 */
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

type Role = 'OWNER' | 'OFFICE' | 'SUPERVISOR';
interface ApiResult {
  status: number;
  body: any;
}

const RUN = Date.now().toString(36).toUpperCase();
const PASSWORD = `smoke-${randomUUID()}`;
const KEEP = process.env.SMOKE_KEEP === '1';

// ---------------------------------------------------------------- reporting

const results: { section: string; name: string; ok: boolean; detail?: string }[] = [];
let section = '';

function heading(title: string) {
  section = title;
  console.log(`\n== ${title}`);
}

function check(name: string, ok: boolean, detail?: unknown): boolean {
  const text = detail === undefined ? undefined : typeof detail === 'string' ? detail : JSON.stringify(detail);
  results.push({ section, name, ok, detail: ok ? undefined : text });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && text ? `\n        -> ${text}` : ''}`);
  return ok;
}

function expectStatus(name: string, res: ApiResult, status: number, code?: string): boolean {
  const gotCode = res.body?.error?.code;
  const ok = res.status === status && (!code || gotCode === code);
  return check(name, ok, `expected ${status}${code ? ` ${code}` : ''}, got ${res.status} ${gotCode ?? JSON.stringify(res.body).slice(0, 300)}`);
}

function near(a: number, b: number, eps = 0.01) {
  return Math.abs(a - b) <= eps;
}

// ---------------------------------------------------------------- http

let baseUrl = process.env.SMOKE_BASE_URL ?? '';
const tokens: Partial<Record<Role, string>> = {};

async function api(method: string, path: string, opts: { as?: Role; token?: string; body?: unknown } = {}): Promise<ApiResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = opts.token ?? (opts.as ? tokens[opts.as] : undefined);
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // keep raw text
  }
  return { status: res.status, body };
}

const get = (path: string, as?: Role) => api('GET', path, { as });
const post = (path: string, body: unknown, as?: Role) => api('POST', path, { as, body });
const patch = (path: string, body: unknown, as?: Role) => api('PATCH', path, { as, body });

// ---------------------------------------------------------------- fixtures

const fx = {
  users: {} as Record<Role, { id: string; email: string }>,
  buyerId: '',
  supplierId: '',
  yarnTypeId: '',
  yarnCode: `SMK-${RUN}`,
  machines: {} as Record<'SPINNING' | 'WEAVING' | 'DYEING', { id: string; code: string; rate: number }>,
  orderIds: [] as string[],
  attendanceSnapshot: [] as { staffId: string; date: Date; present: boolean; markedById: string }[],
  attendanceDate: null as Date | null,
};

async function createFixtures() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  for (const role of ['OWNER', 'OFFICE', 'SUPERVISOR'] as Role[]) {
    const email = `smoke-${role.toLowerCase()}-${RUN.toLowerCase()}@smoke.local`;
    const user = await prisma.user.create({
      data: { email, name: `Smoke ${role} ${RUN}`, passwordHash, role },
    });
    fx.users[role] = { id: user.id, email };
  }
  fx.buyerId = (await prisma.buyer.create({ data: { name: `Smoke Buyer ${RUN}`, phone: '9000000000' } })).id;
  fx.supplierId = (await prisma.supplier.create({ data: { name: `Smoke Supplier ${RUN}` } })).id;
  fx.yarnTypeId = (
    await prisma.yarnType.create({
      data: { code: fx.yarnCode, name: 'Smoke Cotton', colour: 'Grey', countLabel: '30s', reorderLevelKg: 50 },
    })
  ).id;
  const rates = { SPINNING: 2, WEAVING: 3, DYEING: 1.5 } as const;
  for (const stage of ['SPINNING', 'WEAVING', 'DYEING'] as const) {
    const code = `SMK-${stage.slice(0, 4)}-${RUN}`;
    const m = await prisma.machine.create({
      data: { code, name: `Smoke ${stage} ${RUN}`, stage, status: 'IDLE', ratePerMetre: rates[stage] },
    });
    fx.machines[stage] = { id: m.id, code, rate: rates[stage] };
  }
}

async function cleanup() {
  const smokeUserIds = Object.values(fx.users).map((u) => u.id);
  const machineIds = Object.values(fx.machines).map((m) => m.id);
  const orderIds = fx.orderIds;
  const rollIds = (await prisma.roll.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })).map((r) => r.id);
  const invoiceIds = (await prisma.invoice.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })).map((i) => i.id);

  await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  await prisma.dispatchItem.deleteMany({ where: { rollId: { in: rollIds } } });
  await prisma.dispatch.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.qcRecord.deleteMany({ where: { rollId: { in: rollIds } } });
  await prisma.roll.deleteMany({ where: { id: { in: rollIds } } });
  await prisma.productionLog.deleteMany({
    where: { OR: [{ orderId: { in: orderIds } }, { machineId: { in: machineIds } }] },
  });
  // A job on a real machine (start production may grab any idle spinner) must free that machine.
  const realMachineJobs = await prisma.stageJob.findMany({
    where: { orderId: { in: orderIds }, status: 'RUNNING', machineId: { notIn: machineIds } },
    select: { machineId: true },
  });
  for (const job of realMachineJobs) {
    await prisma.machine.update({ where: { id: job.machineId }, data: { status: 'IDLE' } });
  }
  await prisma.stageJob.deleteMany({
    where: { OR: [{ orderId: { in: orderIds } }, { machineId: { in: machineIds } }] },
  });
  await prisma.stockMovement.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { yarnTypeId: fx.yarnTypeId }] } });
  await prisma.orderYarnRequirement.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.machine.deleteMany({ where: { id: { in: machineIds } } });
  if (fx.yarnTypeId) await prisma.yarnType.deleteMany({ where: { id: fx.yarnTypeId } });
  if (fx.buyerId) await prisma.buyer.deleteMany({ where: { id: fx.buyerId } });
  if (fx.supplierId) await prisma.supplier.deleteMany({ where: { id: fx.supplierId } });

  // Attendance: drop rows this run created, restore who marked the ones that already existed.
  if (fx.attendanceDate) {
    const before = new Map(fx.attendanceSnapshot.map((a) => [a.staffId, a]));
    const now = await prisma.attendance.findMany({ where: { date: fx.attendanceDate } });
    for (const row of now) {
      const prev = before.get(row.staffId);
      if (!prev) await prisma.attendance.delete({ where: { id: row.id } });
      else await prisma.attendance.update({ where: { id: row.id }, data: { present: prev.present, markedById: prev.markedById } });
    }
  }

  await prisma.machine.updateMany({ where: { statusUpdatedById: { in: smokeUserIds } }, data: { statusUpdatedById: null } });
  await prisma.user.deleteMany({ where: { id: { in: smokeUserIds } } }); // refresh tokens cascade
}

// ---------------------------------------------------------------- helpers

function plantToday(): string {
  // Attendance is keyed on the plant's (IST) calendar date.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const utcMonth = new Date().toISOString().slice(0, 7);

async function monthEnd() {
  const res = await get(`/reports/month-end?month=${utcMonth}`, 'OWNER');
  return res.body?.data;
}

async function track(token: string) {
  return (await get(`/public/track/${encodeURIComponent(token)}`)).body?.data;
}

// ---------------------------------------------------------------- workflow

async function workflow() {
  // ------------------------------------------------------------ health
  heading('Health');
  const health = await get('/health');
  check('GET /health is 200 with db ok', health.status === 200 && health.body?.data?.db === 'ok', health);

  // ------------------------------------------------------------ auth
  heading('Auth');
  for (const role of ['OWNER', 'OFFICE', 'SUPERVISOR'] as Role[]) {
    const res = await post('/auth/login', { email: fx.users[role].email, password: PASSWORD });
    const d = res.body?.data;
    if (check(`login as ${role}`, res.status === 200 && !!d?.accessToken && d?.user?.role === role, res)) {
      tokens[role] = d.accessToken;
    }
  }
  if (!tokens.OWNER || !tokens.OFFICE || !tokens.SUPERVISOR) throw new Error('Cannot continue without logins');

  expectStatus('login with wrong password is 401', await post('/auth/login', { email: fx.users.OWNER.email, password: 'wrong' }), 401);
  expectStatus('login with malformed email is 400', await post('/auth/login', { email: 'nope', password: 'x' }), 400, 'VALIDATION_ERROR');
  const me = await get('/auth/me', 'OFFICE');
  check('GET /auth/me returns the logged-in user', me.status === 200 && me.body?.data?.email === fx.users.OFFICE.email, me);
  expectStatus('protected route without token is 401', await get('/orders'), 401);
  expectStatus('protected route with garbage token is 401', await api('GET', '/orders', { token: 'not.a.jwt' }), 401);

  const login2 = (await post('/auth/login', { email: fx.users.OWNER.email, password: PASSWORD })).body.data;
  const refreshed = await post('/auth/refresh', { refreshToken: login2.refreshToken });
  check('refresh issues a new access + refresh token', refreshed.status === 200 && !!refreshed.body?.data?.accessToken && refreshed.body.data.refreshToken !== login2.refreshToken, refreshed);
  if (refreshed.status === 200) {
    const viaRefreshed = await api('GET', '/auth/me', { token: refreshed.body.data.accessToken });
    check('refreshed access token works', viaRefreshed.status === 200, viaRefreshed);
    expectStatus('reusing a rotated refresh token is 401', await post('/auth/refresh', { refreshToken: login2.refreshToken }), 401);
    expectStatus('reuse detection revoked the newer refresh token too', await post('/auth/refresh', { refreshToken: refreshed.body.data.refreshToken }), 401);
  }
  const login3 = (await post('/auth/login', { email: fx.users.OWNER.email, password: PASSWORD })).body.data;
  check('logout succeeds', (await post('/auth/logout', { refreshToken: login3.refreshToken })).status === 200);
  expectStatus('refresh after logout is 401', await post('/auth/refresh', { refreshToken: login3.refreshToken }), 401);

  // ------------------------------------------------------------ masters
  heading('Masters');
  const before = await monthEnd();
  check('month-end report readable before the run', !!before, before);

  const buyers = await get('/buyers', 'OFFICE');
  check('GET /buyers lists the fixture buyer', buyers.body?.data?.some((b: any) => b.id === fx.buyerId), buyers.status);
  const suppliers = await get('/suppliers', 'OFFICE');
  check('GET /suppliers lists the fixture supplier', suppliers.body?.data?.some((s: any) => s.id === fx.supplierId), suppliers.status);
  const machines = await get('/machines', 'OFFICE');
  check('GET /machines lists the 3 fixture machines', Object.values(fx.machines).every((m) => machines.body?.data?.some((x: any) => x.id === m.id)), machines.status);
  const yt0 = (await get('/yarn-types', 'OFFICE')).body?.data?.find((y: any) => y.id === fx.yarnTypeId);
  check('new yarn type has 0 kg on hand and is flagged low', yt0?.onHandKg === 0 && yt0?.isLow === true, yt0);
  check('GET /workers responds', (await get('/workers', 'OFFICE')).status === 200);

  // ------------------------------------------------------------ yarn receipt + feasibility
  heading('Yarn receipt, stock and feasibility');
  const ORDER_METRES = 400;
  const KG_PER_METRE = 0.25;
  const REQUIRED_KG = ORDER_METRES * KG_PER_METRE; // 100 kg
  const line = { yarnTypeId: fx.yarnTypeId, kgPerMetre: KG_PER_METRE };

  const feas0 = await post('/orders/feasibility', { metres: ORDER_METRES, lines: [line] }, 'OFFICE');
  check('feasibility with no stock: canStart=false, shortfall 100 kg', feas0.status === 200 && feas0.body?.data?.canStart === false && near(feas0.body.data.lines?.[0]?.shortfallKg, REQUIRED_KG), feas0.body);

  expectStatus('receipt with negative kg is rejected', await post('/stock/receipts', { yarnTypeId: fx.yarnTypeId, supplierId: fx.supplierId, kg: -5, ratePerKg: 300 }, 'SUPERVISOR'), 400, 'VALIDATION_ERROR');
  const r1 = await post('/stock/receipts', { yarnTypeId: fx.yarnTypeId, supplierId: fx.supplierId, kg: 80, ratePerKg: 300, reference: `GRN-${RUN}-1` }, 'SUPERVISOR');
  check('record receipt 80 kg @ 300 -> on hand 80', r1.status === 201 && near(r1.body?.data?.onHandKg, 80, 0.001), r1.body);

  expectStatus('SUPERVISOR cannot create orders (403)', await post('/orders', {}, 'SUPERVISOR'), 403);
  const orderBody = {
    buyerId: fx.buyerId,
    fabricType: `Smoke Twill ${RUN}`,
    colour: 'Grey',
    metres: ORDER_METRES,
    ratePerMetre: 150,
    deadline: '2026-12-31',
    lines: [line],
  };
  expectStatus('create order with missing fields is 400', await post('/orders', { buyerId: fx.buyerId }, 'OFFICE'), 400);
  const created = await post('/orders', orderBody, 'OFFICE');
  const order = created.body?.data;
  if (!check('create order (OFFICE) -> 201, status PENDING', created.status === 201 && order?.status === 'PENDING', created.body)) {
    throw new Error('Cannot continue without an order');
  }
  fx.orderIds.push(order.id);
  check('order has ORD- number and tracking token', /^ORD-/.test(order.orderNo) && !!order.trackingToken, order);

  const startEarly = await post(`/orders/${order.id}/start`, {}, 'OFFICE');
  expectStatus('start production with 80/100 kg is 422 INSUFFICIENT_YARN', startEarly, 422, 'INSUFFICIENT_YARN');

  const r2 = await post('/stock/receipts', { yarnTypeId: fx.yarnTypeId, supplierId: fx.supplierId, kg: 60, ratePerKg: 320, reference: `GRN-${RUN}-2` }, 'SUPERVISOR');
  check('record receipt 60 kg @ 320 -> on hand 140', r2.status === 201 && near(r2.body?.data?.onHandKg, 140, 0.001), r2.body);

  const summary1 = (await get('/stock/summary', 'OFFICE')).body?.data?.find((s: any) => s.yarnTypeId === fx.yarnTypeId);
  check('stock summary: 140 on hand, 100 reserved by the unstarted order, 40 available', near(summary1?.onHandKg, 140) && near(summary1?.reservedKg, REQUIRED_KG) && near(summary1?.availableKg, 40), summary1);
  check('stock summary: low-stock warning (40 available < 50 reorder level)', summary1?.isLow === true, summary1);

  const feasOther = await post('/orders/feasibility', { metres: ORDER_METRES, lines: [line] }, 'OFFICE');
  check('a second identical order is NOT feasible (yarn reserved by first)', feasOther.body?.data?.canStart === false && near(feasOther.body.data.lines?.[0]?.availableKg, 40), feasOther.body);

  const detail0 = (await get(`/orders/${order.id}`, 'OFFICE')).body?.data;
  check('order detail feasibility: canStart=true (own reservation excluded)', detail0?.feasibility?.canStart === true, detail0?.feasibility);
  const listed = await get('/orders?status=PENDING', 'OFFICE');
  check('GET /orders?status=PENDING includes the order', listed.body?.data?.some?.((o: any) => o.id === order.id) || listed.body?.data?.items?.some?.((o: any) => o.id === order.id), listed.status);

  // ------------------------------------------------------------ buyer tracking (before start)
  heading('Buyer tracking link');
  const t0 = await track(order.trackingToken);
  check('public tracking by token works without login, status PENDING', t0?.orderNo === order.orderNo && t0?.status === 'PENDING', t0);
  check('public tracking by order number works', (await track(order.orderNo))?.orderNo === order.orderNo);
  expectStatus('unknown tracking token is 404', await get('/public/track/does-not-exist-xyz'), 404);
  // API-46 / T-20: never returned - rates, costs, yarn, invoices, internal IDs, buyer contact details.
  const forbidden = ['ratePerMetre', 'totalAmount', 'requirements', 'yarnRequirements', 'feasibility', 'buyerPhone', 'buyerId', 'id'];
  const leaked = forbidden.filter((k) => t0 && t0[k] !== undefined && t0[k] !== null);
  check('[spec API-46] tracking payload hides rates, yarn, contact details and internal IDs', !!t0 && leaked.length === 0, `leaked: ${leaked.join(', ')}`);

  // ------------------------------------------------------------ start production
  heading('Start production');
  const started = await post(`/orders/${order.id}/start`, {}, 'OFFICE');
  check('start production -> 200, IN_PRODUCTION', started.status === 200 && started.body?.data?.status === 'IN_PRODUCTION', started.body);
  expectStatus('second start is 409 ALREADY_STARTED', await post(`/orders/${order.id}/start`, {}, 'OFFICE'), 409, 'ALREADY_STARTED');

  const avgRate = Math.round(((80 * 300 + 60 * 320) / 140) * 100) / 100; // 308.57
  const ledger = (await get(`/stock/ledger?yarnTypeId=${fx.yarnTypeId}`, 'OFFICE')).body?.data;
  const ledgerItems: any[] = Array.isArray(ledger) ? ledger : ledger?.items ?? [];
  const issue = ledgerItems.find((m) => m.type === 'ISSUE');
  check(`yarn ISSUE of 100 kg at weighted avg rate ${avgRate} recorded`, !!issue && near(issue.kg, REQUIRED_KG) && near(issue.ratePerKg, avgRate), issue ?? ledgerItems);
  const summary2 = (await get('/stock/summary', 'OFFICE')).body?.data?.find((s: any) => s.yarnTypeId === fx.yarnTypeId);
  check('after start: 40 on hand, 0 reserved', near(summary2?.onHandKg, 40) && near(summary2?.reservedKg, 0), summary2);
  check('tracking shows IN_PRODUCTION', (await track(order.trackingToken))?.status === 'IN_PRODUCTION');

  // ------------------------------------------------------------ floor: spinning
  heading('Production floor');
  const logged = { SPINNING: 0, WEAVING: 0, DYEING: 0 };
  const jobs: Partial<Record<keyof typeof logged, { id: string; machineId: string }>> = {};

  // Start production auto-assigns an idle spinner; fall back to ours if it did not.
  const afterStart = (await get(`/orders/${order.id}`, 'SUPERVISOR')).body?.data;
  const spinStage = afterStart?.stages?.find((s: any) => s.stage === 'SPINNING');
  let spinMachineId: string = spinStage?.machineId;
  check('start production auto-assigned a spinning machine', !!spinMachineId, spinStage);
  if (!spinMachineId) {
    const sj = await post('/floor/jobs', { machineId: fx.machines.SPINNING.id, orderId: order.id, stage: 'SPINNING' }, 'SUPERVISOR');
    check('start spinning job manually', sj.status === 200, sj.body);
    spinMachineId = fx.machines.SPINNING.id;
  }
  const board1 = (await get('/floor/board', 'SUPERVISOR')).body?.data;
  const spinOnBoard = board1?.machines?.find((m: any) => m.id === spinMachineId);
  check('machine board shows the spinner RUNNING this order', spinOnBoard?.status === 'RUNNING' && spinOnBoard?.currentJob?.orderId === order.id, spinOnBoard);
  jobs.SPINNING = { id: spinOnBoard?.currentJob?.id, machineId: spinMachineId };

  // Spec 14.3 stage rules: weaving requires spinning output > 0.
  const weaveTooEarly = await post('/floor/jobs', { machineId: fx.machines.WEAVING.id, orderId: order.id, stage: 'WEAVING' }, 'SUPERVISOR');
  check('[spec 14.3] weaving job before any spinning output is refused (STAGE_NOT_READY)', weaveTooEarly.status >= 400 && weaveTooEarly.body?.error?.code === 'STAGE_NOT_READY', `got ${weaveTooEarly.status} ${JSON.stringify(weaveTooEarly.body).slice(0, 200)}`);
  if (weaveTooEarly.status === 200) {
    jobs.WEAVING = { id: weaveTooEarly.body.data.currentJobId, machineId: fx.machines.WEAVING.id };
  }

  expectStatus('production log with 0 metres is 400', await post('/floor/logs', { machineId: spinMachineId, orderId: order.id, stage: 'SPINNING', shift: 'MORNING', metres: 0 }, 'SUPERVISOR'), 400);
  const spinLog = await post('/floor/logs', { machineId: spinMachineId, orderId: order.id, stage: 'SPINNING', shift: 'MORNING', metres: 400 }, 'SUPERVISOR');
  if (check('log 400 m spinning output', spinLog.status === 200 && spinLog.body?.data?.metres === 400, spinLog.body)) logged.SPINNING += 400;
  expectStatus('log with wrong stage for the job is rejected', await post('/floor/logs', { machineId: spinMachineId, orderId: order.id, stage: 'WEAVING', shift: 'MORNING', metres: 10 }, 'SUPERVISOR'), 400, 'STAGE_MISMATCH');
  const board2 = (await get('/floor/board', 'SUPERVISOR')).body?.data;
  const spin2 = board2?.machines?.find((m: any) => m.id === spinMachineId);
  check('board: spinner metresToday includes 400 and job progress = 400', spin2?.metresToday >= 400 && spin2?.currentJob?.producedMetres === 400, spin2);
  expectStatus('cannot mark machine IDLE while a job runs', await patch(`/floor/machines/${spinMachineId}/status`, { status: 'IDLE' }, 'SUPERVISOR'), 409, 'ACTIVE_JOB');
  const spinDone = await post(`/floor/jobs/${jobs.SPINNING.id}/complete`, {}, 'SUPERVISOR');
  check('complete spinning job -> machine IDLE', spinDone.status === 200, spinDone.body);
  expectStatus('completing it again is 409', await post(`/floor/jobs/${jobs.SPINNING.id}/complete`, {}, 'SUPERVISOR'), 409, 'JOB_NOT_ACTIVE');
  expectStatus('logging against a completed job is 409', await post('/floor/logs', { machineId: spinMachineId, orderId: order.id, stage: 'SPINNING', shift: 'EVENING', metres: 5 }, 'SUPERVISOR'), 409, 'ACTIVE_JOB_NOT_FOUND');

  // ------------------------------------------------------------ floor: weaving
  expectStatus('stage mismatch: DYEING job on a weaving machine is 400', await post('/floor/jobs', { machineId: fx.machines.WEAVING.id, orderId: order.id, stage: 'DYEING' }, 'SUPERVISOR'), 400, 'STAGE_MISMATCH');
  if (!jobs.WEAVING) {
    const wj = await post('/floor/jobs', { machineId: fx.machines.WEAVING.id, orderId: order.id, stage: 'WEAVING', shift: 'MORNING' }, 'SUPERVISOR');
    check('start weaving job', wj.status === 200 && !!wj.body?.data?.currentJobId, wj.body);
    jobs.WEAVING = { id: wj.body?.data?.currentJobId, machineId: fx.machines.WEAVING.id };
  }
  expectStatus('second job on a busy machine is 409', await post('/floor/jobs', { machineId: fx.machines.WEAVING.id, orderId: order.id, stage: 'WEAVING' }, 'SUPERVISOR'), 409, 'ACTIVE_JOB');
  const weaveLog = await post('/floor/logs', { machineId: fx.machines.WEAVING.id, orderId: order.id, stage: 'WEAVING', shift: 'EVENING', metres: 380 }, 'SUPERVISOR');
  if (check('log 380 m weaving output', weaveLog.status === 200, weaveLog.body)) logged.WEAVING += 380;
  // Spec 14.3: with ENFORCE_STAGE_CAP on, weaving may not exceed spinning (400).
  const overCap = await post('/floor/logs', { machineId: fx.machines.WEAVING.id, orderId: order.id, stage: 'WEAVING', shift: 'NIGHT', metres: 100 }, 'SUPERVISOR');
  check('[spec 14.3] weaving output above spinning output is refused (EXCEEDS_PREVIOUS_STAGE)', overCap.status === 422 && overCap.body?.error?.code === 'EXCEEDS_PREVIOUS_STAGE', `got ${overCap.status} ${JSON.stringify(overCap.body).slice(0, 200)}`);
  if (overCap.status === 200) logged.WEAVING += 100;
  check('complete weaving job', (await post(`/floor/jobs/${jobs.WEAVING.id}/complete`, {}, 'SUPERVISOR')).status === 200);

  // ------------------------------------------------------------ floor: breakdown + dyeing
  const dyeId = fx.machines.DYEING.id;
  const broke = await patch(`/floor/machines/${dyeId}/status`, { status: 'BREAKDOWN', note: 'smoke: belt snapped' }, 'SUPERVISOR');
  check('report breakdown with note', broke.status === 200 && broke.body?.data?.status === 'BREAKDOWN' && broke.body.data.statusNote === 'smoke: belt snapped', broke.body);
  expectStatus('cannot start a job on a broken-down machine', await post('/floor/jobs', { machineId: dyeId, orderId: order.id, stage: 'DYEING' }, 'SUPERVISOR'), 409, 'MACHINE_DAMAGED');
  const board3 = (await get('/floor/board', 'OWNER')).body?.data;
  check('board stats count the breakdown', board3?.stats?.breakdown >= 1 && board3.machines.find((m: any) => m.id === dyeId)?.status === 'BREAKDOWN', board3?.stats);
  check('repair: mark machine IDLE again', (await patch(`/floor/machines/${dyeId}/status`, { status: 'IDLE' }, 'SUPERVISOR')).body?.data?.status === 'IDLE');

  const dj = await post('/floor/jobs', { machineId: dyeId, orderId: order.id, stage: 'DYEING' }, 'SUPERVISOR');
  check('start dyeing job', dj.status === 200, dj.body);
  jobs.DYEING = { id: dj.body?.data?.currentJobId, machineId: dyeId };
  const dyeLog = await post('/floor/logs', { machineId: dyeId, orderId: order.id, stage: 'DYEING', shift: 'NIGHT', metres: 360 }, 'SUPERVISOR');
  if (check('log 360 m dyeing output', dyeLog.status === 200, dyeLog.body)) logged.DYEING += 360;
  check('complete dyeing job', (await post(`/floor/jobs/${jobs.DYEING.id}/complete`, {}, 'SUPERVISOR')).status === 200);

  const logs = (await get('/floor/logs?limit=100', 'SUPERVISOR')).body?.data ?? [];
  check('production log list contains all 3 stage logs for the order', ['SPINNING', 'WEAVING', 'DYEING'].every((s) => logs.some((l: any) => l.orderId === order.id && l.stage === s)), logs.length);
  const detail1 = (await get(`/orders/${order.id}`, 'SUPERVISOR')).body?.data;
  check('order detail: all 3 stages COMPLETED', detail1?.stages?.every((s: any) => s.status === 'COMPLETED'), detail1?.stages);

  // ------------------------------------------------------------ rolls + QC
  heading('Rolls and QC');
  const rollBody = (metres: number) => ({ orderId: order.id, metres, weavingMachineId: fx.machines.WEAVING.id, dyeingMachineId: dyeId });
  expectStatus('roll with a spinning machine as weaving machine is 400', await post('/qc/rolls', { ...rollBody(10), weavingMachineId: spinMachineId }, 'SUPERVISOR'), 400, 'INVALID_MACHINE');
  const roll1 = await post('/qc/rolls', rollBody(150), 'SUPERVISOR');
  check('create roll 1 (150 m) -> PENDING_QC, numbered <ORD>-R01', roll1.status === 201 && roll1.body?.data?.status === 'PENDING_QC' && roll1.body.data.rollNo === `${order.orderNo}-R01`, roll1.body);
  check('tracking shows QC once a roll is waiting', (await track(order.trackingToken))?.status === 'QC');
  const roll2 = await post('/qc/rolls', rollBody(150), 'SUPERVISOR');
  check('create roll 2 (150 m)', roll2.status === 201, roll2.body);
  const tooMuch = await post('/qc/rolls', rollBody(100), 'SUPERVISOR');
  expectStatus('roll exceeding dyeing output (300+100 > 360) is 422', tooMuch, 422, 'EXCEEDS_STAGE_OUTPUT');
  check('…and reports 60 m remaining', tooMuch.body?.error?.details?.remainingMetres === 60, tooMuch.body?.error?.details);
  const roll3 = await post('/qc/rolls', rollBody(60), 'SUPERVISOR');
  check('create roll 3 (60 m, uses the remaining output)', roll3.status === 201, roll3.body);
  const [R1, R2, R3] = [roll1, roll2, roll3].map((r) => r.body?.data);

  const queue = (await get('/qc/queue', 'SUPERVISOR')).body?.data ?? [];
  check('QC queue lists the 3 rolls with machine traceability', [R1, R2, R3].every((r) => queue.some((q: any) => q.id === r?.id && q.weavingMachineId === fx.machines.WEAVING.id && q.dyeingMachineId === dyeId)));

  check('R1 PASS', (await post(`/qc/rolls/${R1.id}/result`, { result: 'PASS' }, 'SUPERVISOR')).body?.data?.status === 'PASSED');
  expectStatus('REWORK without a defect type is 400', await post(`/qc/rolls/${R2.id}/result`, { result: 'REWORK' }, 'SUPERVISOR'), 400);
  const rw = await post(`/qc/rolls/${R2.id}/result`, { result: 'REWORK', defectType: 'HOLE', notes: 'smoke hole' }, 'SUPERVISOR');
  check('R2 REWORK (HOLE)', rw.body?.data?.status === 'REWORK' && rw.body.data.defectType === 'HOLE', rw.body);
  check('tracking still QC while a roll is in rework', (await track(order.trackingToken))?.status === 'QC');
  check('R2 re-inspected -> PASS', (await post(`/qc/rolls/${R2.id}/result`, { result: 'PASS' }, 'SUPERVISOR')).body?.data?.status === 'PASSED');
  const rj = await post(`/qc/rolls/${R3.id}/result`, { result: 'REJECT', defectType: 'COLOUR_MISMATCH' }, 'SUPERVISOR');
  check('R3 REJECT (COLOUR_MISMATCH)', rj.body?.data?.status === 'REJECTED', rj.body);
  expectStatus('a PASSED roll cannot be inspected again', await post(`/qc/rolls/${R1.id}/result`, { result: 'REJECT', defectType: 'OTHER' }, 'SUPERVISOR'), 409, 'ROLL_NOT_INSPECTABLE');

  // Spec 14.3 case 6: dyeing done, PASSED + PASSED + REJECTED -> READY_TO_SHIP.
  const tReady = await track(order.trackingToken);
  check('[spec 14.3 #6] PASSED+PASSED+REJECTED with dyeing done -> READY (ready to ship)', tReady?.status === 'READY', { status: tReady?.status, canonicalStatus: tReady?.canonicalStatus });

  // ------------------------------------------------------------ dispatch + invoices
  heading('Dispatch and invoices');
  const v1 = (await get(`/dispatch/validate?code=${encodeURIComponent(R1.rollNo.toLowerCase())}&orderId=${order.id}`, 'SUPERVISOR')).body?.data;
  check('validate R1 (typed lower-case) -> valid', v1?.valid === true, v1);
  check('validate R3 -> NOT_PASSED', (await get(`/dispatch/validate?code=${R3.rollNo}`, 'SUPERVISOR')).body?.data?.errorCode === 'NOT_PASSED');
  check('validate unknown code -> UNKNOWN_ROLL', (await get('/dispatch/validate?code=NOPE-R99', 'SUPERVISOR')).body?.data?.errorCode === 'UNKNOWN_ROLL');
  check('validate R1 against another order -> WRONG_ORDER', (await get(`/dispatch/validate?code=${R1.rollNo}&orderId=${randomUUID()}`, 'SUPERVISOR')).body?.data?.errorCode === 'WRONG_ORDER');

  expectStatus('dispatching a rejected roll is 409', await post('/dispatch', { orderId: order.id, rollIds: [R3.id] }, 'SUPERVISOR'), 409, 'ROLL_NOT_DISPATCHABLE');
  expectStatus('duplicate roll ids in one dispatch are 400', await post('/dispatch', { orderId: order.id, rollIds: [R1.id, R1.id] }, 'SUPERVISOR'), 400, 'DUPLICATE_ROLLS');
  const d1 = await post('/dispatch', { orderId: order.id, rollIds: [R1.id], vehicleNo: `MH-SMK-${RUN}` }, 'SUPERVISOR');
  const inv1 = d1.body?.data?.invoice;
  check('dispatch R1 -> 201 with DSP- and INV- numbers', d1.status === 201 && /^DSP-/.test(d1.body?.data?.dispatch?.dispatchNo) && /^INV-/.test(inv1?.invoiceNo), d1.body);
  check('invoice 1 = 150 m x 150 = 22500, UNPAID, lists R1', inv1?.amount === 22500 && inv1?.status === 'UNPAID' && inv1?.rolls?.length === 1 && inv1.rolls[0].rollId === R1.id, inv1);
  expectStatus('dispatching R1 twice is 409', await post('/dispatch', { orderId: order.id, rollIds: [R1.id] }, 'SUPERVISOR'), 409, 'ROLL_NOT_DISPATCHABLE');
  const tPartial = await track(order.trackingToken);
  check('tracking shows partially dispatched', tPartial?.canonicalStatus === 'PARTIALLY_DISPATCHED', { status: tPartial?.status, canonicalStatus: tPartial?.canonicalStatus });

  // Two people confirm the same roll at the same moment: exactly one may win.
  const race = await Promise.all([
    post('/dispatch', { orderId: order.id, rollIds: [R2.id] }, 'SUPERVISOR'),
    post('/dispatch', { orderId: order.id, rollIds: [R2.id] }, 'OWNER'),
  ]);
  const winners = race.filter((r) => r.status === 201);
  check('concurrent dispatch of R2: exactly one 201, the other 409', winners.length === 1 && race.some((r) => r.status === 409), race.map((r) => `${r.status} ${r.body?.error?.code ?? ''}`));
  const inv2 = winners[0]?.body?.data?.invoice;
  check('validate R2 now -> ALREADY_DISPATCHED', (await get(`/dispatch/validate?code=${R2.rollNo}`, 'SUPERVISOR')).body?.data?.errorCode === 'ALREADY_DISPATCHED');

  const finished = (await get(`/stock/finished?orderId=${order.id}`, 'OFFICE')).body?.data?.[0];
  check('finished stock: 300 m dispatched, 0 on shelf, 0 in QC', finished?.dispatchedMetres === 300 && finished?.passedOnShelfMetres === 0 && finished?.pendingQcMetres === 0, finished);
  const goods = (await get(`/dispatch/goods?orderId=${order.id}`, 'OFFICE')).body?.data ?? [];
  check('dispatch goods lists 3 rolls for the order', goods.length === 3, goods.length);

  // Spec 14.3 case 11: all live (non-rejected) rolls dispatched -> fully dispatched.
  const tDone = await track(order.trackingToken);
  check('[spec 14.3 #11] DISPATCHED+DISPATCHED+REJECTED -> fully dispatched (COMPLETED)', tDone?.canonicalStatus === 'COMPLETED', { status: tDone?.status, canonicalStatus: tDone?.canonicalStatus });
  check('[spec 8 tracking] passedMetres counts PASSED+DISPATCHED (300), dispatchedMetres 300', tDone?.passedMetres === 300 && tDone?.dispatchedMetres === 300, { passedMetres: tDone?.passedMetres, dispatchedMetres: tDone?.dispatchedMetres });
  check(`[spec 8 tracking] producedMetres is the dyeing output (${logged.DYEING} m)`, tDone?.producedMetres === logged.DYEING, { producedMetres: tDone?.producedMetres, expected: logged.DYEING });

  // ------------------------------------------------------------ payments
  heading('Payments');
  const invoices = (await get('/invoices', 'OFFICE')).body?.data ?? [];
  check('GET /invoices lists both invoices of the order', [inv1?.id, inv2?.id].every((id) => invoices.some((i: any) => i.id === id)));
  expectStatus('SUPERVISOR cannot record payments (403)', await post(`/invoices/${inv1.id}/payments`, { amount: 1, paidOn: plantToday() }, 'SUPERVISOR'), 403);
  expectStatus('overpayment is 422', await post(`/invoices/${inv1.id}/payments`, { amount: 22500.01 + 1, paidOn: plantToday() }, 'OFFICE'), 422, 'PAYMENT_EXCEEDS_BALANCE');
  const p1 = await post(`/invoices/${inv1.id}/payments`, { amount: 10000, paidOn: plantToday(), method: 'NEFT' }, 'OFFICE');
  check('partial payment 10000 -> PARTIAL, outstanding 12500', p1.status === 201 && p1.body?.data?.status === 'PARTIAL' && p1.body.data.outstandingAmount === 12500, p1.body?.data);
  const p2 = await post(`/invoices/${inv1.id}/payments`, { amount: 12500, paidOn: plantToday(), method: 'UPI' }, 'OFFICE');
  check('remaining 12500 -> PAID, outstanding 0', p2.body?.data?.status === 'PAID' && p2.body.data.outstandingAmount === 0, p2.body?.data);
  expectStatus('any further payment is 422', await post(`/invoices/${inv1.id}/payments`, { amount: 1, paidOn: plantToday() }, 'OFFICE'), 422, 'PAYMENT_EXCEEDS_BALANCE');
  const invDetail = (await get(`/invoices/${inv1.id}`, 'OWNER')).body?.data;
  check('invoice detail shows 2 payments', invDetail?.payments?.length === 2, invDetail?.payments);

  // ------------------------------------------------------------ attendance + wages
  heading('Attendance and wages');
  const today = plantToday();
  fx.attendanceDate = new Date(`${today}T00:00:00.000Z`);
  fx.attendanceSnapshot = await prisma.attendance.findMany({
    where: { date: fx.attendanceDate },
    select: { staffId: true, date: true, present: true, markedById: true },
  });
  const att = await get(`/attendance?date=${today}`, 'SUPERVISOR');
  const roster: any[] = att.body?.data?.records ?? [];
  check('supervisor reads today\'s roster', att.status === 200 && roster.length > 0, att.body);
  if (roster.length > 0) {
    // Re-save the roster unchanged so the real attendance data is not altered.
    const records = roster.map((r) => ({ workerId: r.workerId, present: r.present }));
    const saved = await post('/attendance', { date: today, records }, 'SUPERVISOR');
    check('save full roster for today', saved.status === 200, saved.body);
    if (records.length > 1) {
      expectStatus('saving an incomplete roster is 400', await post('/attendance', { date: today, records: records.slice(1) }, 'SUPERVISOR'), 400, 'INCOMPLETE_ATTENDANCE_ROSTER');
    }
    expectStatus('saving a past date is 400', await post('/attendance', { date: '2020-01-01', records }, 'SUPERVISOR'), 400, 'ATTENDANCE_DATE_MUST_BE_TODAY');
    expectStatus('OFFICE cannot mark attendance (403)', await post('/attendance', { date: today, records }, 'OFFICE'), 403);
  }
  const wages = (await get(`/attendance/wages?month=${utcMonth}`, 'OFFICE')).body?.data;
  const wageSum = (wages?.workers ?? []).reduce((s: number, w: any) => s + w.presentDays * w.dailyWage, 0);
  check('wages total = sum(present days x daily wage)', wages && near(wages.totalWages, wageSum), wages);

  // ------------------------------------------------------------ month-end
  heading('Month-end report');
  const after = await monthEnd();
  const machineCost = logged.SPINNING * fx.machines.SPINNING.rate + logged.WEAVING * fx.machines.WEAVING.rate + logged.DYEING * fx.machines.DYEING.rate;
  const spinRate = spinMachineId === fx.machines.SPINNING.id ? fx.machines.SPINNING.rate : (await prisma.machine.findUnique({ where: { id: spinMachineId } }))!.ratePerMetre.toNumber();
  const expectedMachineCost = machineCost - logged.SPINNING * fx.machines.SPINNING.rate + logged.SPINNING * spinRate;
  const invoicedTotal = (inv1?.amount ?? 0) + (inv2?.amount ?? 0);
  if (before && after) {
    check('purchases grew by 43200 (80x300 + 60x320)', near(after.purchases - before.purchases, 43200), { before: before.purchases, after: after.purchases });
    check(`invoiced grew by ${invoicedTotal}`, near(after.invoiced - before.invoiced, invoicedTotal), { before: before.invoiced, after: after.invoiced });
    check('payments received grew by 22500', near(after.paymentsReceived - before.paymentsReceived, 22500), { before: before.paymentsReceived, after: after.paymentsReceived });
    check('profit = invoiced - purchases - wages', near(after.profit, after.invoiced - after.purchases - after.wages), after);
    check('month-end wages equal the wages screen total', wages && near(after.wages, wages.totalWages), { monthEnd: after.wages, wagesScreen: wages?.totalWages });
    const cpo = after.costPerOrder?.find((c: any) => c.orderId === order.id);
    const expectedYarnCost = Math.round(REQUIRED_KG * avgRate * 100) / 100;
    check(`cost per order: yarn cost ${expectedYarnCost}`, near(cpo?.yarnCost, expectedYarnCost), cpo);
    check(`cost per order: machine cost ${expectedMachineCost}`, near(cpo?.machineCost, expectedMachineCost), cpo);
    check(`cost per order: invoiced ${invoicedTotal}, margin = invoiced - yarn - machine`, near(cpo?.invoicedAmount, invoicedTotal) && near(cpo?.marginAmount, invoicedTotal - expectedYarnCost - expectedMachineCost), cpo);
    const mpm = (code: string) => after.metresPerMachine?.find((m: any) => m.machineCode === code)?.metresProduced;
    check('metres per machine match the logs', mpm(fx.machines.WEAVING.code) === logged.WEAVING && mpm(fx.machines.DYEING.code) === logged.DYEING, { weaving: mpm(fx.machines.WEAVING.code), dyeing: mpm(fx.machines.DYEING.code) });
  }
  expectStatus('SUPERVISOR cannot read month-end (403)', await get(`/reports/month-end?month=${utcMonth}`, 'SUPERVISOR'), 403);
  expectStatus('month-end with bad month format is 400', await get('/reports/month-end?month=2026-1', 'OWNER'), 400);

  // ------------------------------------------------------------ dashboard + landing + staff
  heading('Dashboard, landing page and staff');
  const dash = await get('/reports/dashboard', 'OWNER');
  check('owner dashboard responds 200', dash.status === 200 && !!dash.body?.data, dash.status);
  check('public stats respond 200', (await get('/public/stats')).status === 200);
  const samples = await get('/public/samples');
  check('public samples include the newest order', samples.status === 200 && samples.body?.data?.some((s: any) => s.code === order.orderNo), samples.status);
  check('OFFICE can list staff', (await get('/staff', 'OFFICE')).status === 200);
  expectStatus('SUPERVISOR cannot list staff (403)', await get('/staff', 'SUPERVISOR'), 403);
  expectStatus('unknown API route is 404', await get('/definitely-not-a-route', 'OWNER'), 404);
}

// ---------------------------------------------------------------- main

async function main() {
  console.log(`MillTrace smoke test - run ${RUN}`);
  let server: Server | undefined;
  if (!baseUrl) {
    const { createApp } = await import('../src/app');
    server = createApp().listen(0);
    await new Promise<void>((resolve) => server!.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  }
  console.log(`Target: ${baseUrl}`);

  let crashed: unknown;
  try {
    await createFixtures();
    await workflow();
  } catch (err) {
    crashed = err;
    check('workflow ran to completion', false, err instanceof Error ? `${err.message}\n${err.stack}` : String(err));
  } finally {
    if (KEEP) {
      console.log(`\nSMOKE_KEEP=1: leaving run ${RUN} data in the database.`);
    } else {
      try {
        await cleanup();
        console.log(`\nCleaned up run ${RUN} data.`);
      } catch (err) {
        console.error(`\nCleanup failed for run ${RUN}:`, err);
      }
    }
    server?.close();
    await prisma.$disconnect();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  - [${f.section}] ${f.name}`);
  }
  process.exit(failed.length || crashed ? 1 : 0);
}

main();
