import { randomUUID } from 'crypto';

const BASE_URL = 'http://localhost:4000/api/v1';

async function request(url: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${url}`, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runAudit() {
  console.log('====================================================');
  console.log('   FULL SYSTEM END-TO-END FUNCTIONALITY AUDIT       ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, stepName: string, detail?: any) {
    if (condition) {
      console.log(`[PASS] ${stepName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${stepName}`, detail ?? '');
      failed++;
    }
  }

  // 1. HEALTH & DB CHECK
  console.log('\n--- 1. Health & Database Connectivity ---');
  const health = await request('/health');
  assert(health.status === 200 && health.data?.data?.db === 'ok', 'GET /health -> Database reachable', health.data);

  // 2. AUTHENTICATION & TOKEN ROTATION
  console.log('\n--- 2. Authentication & JWT Tokens ---');
  const loginRes = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@everest.com', password: 'password' }),
  });
  assert(loginRes.status === 200 && !!loginRes.data?.data?.accessToken, 'POST /auth/login -> Owner Login & Token Generation', loginRes.data);
  const ownerToken = loginRes.data?.data?.accessToken;
  const refreshToken = loginRes.data?.data?.refreshToken;
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` };

  // Token refresh
  const refreshRes = await request('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  assert(refreshRes.status === 200 && !!refreshRes.data?.data?.accessToken, 'POST /auth/refresh -> Access token rotation', refreshRes.data);
  const refreshedToken = refreshRes.data?.data?.accessToken;
  const activeHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${refreshedToken}` };

  // Current user me
  const meRes = await request('/auth/me', { headers: activeHeaders });
  assert(meRes.status === 200 && meRes.data?.data?.role === 'OWNER', 'GET /auth/me -> Correct user & role returned', meRes.data);

  // Supervisor login for supervisor-specific endpoints
  const supLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'supervisor@everest.com', password: 'password' }),
  });
  const supToken = supLogin.data?.data?.accessToken;
  const supHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${supToken}` };

  // 3. MASTERS APIS
  console.log('\n--- 3. Master Data Synchronization ---');
  const buyersRes = await request('/masters/buyers', { headers: activeHeaders });
  assert(buyersRes.status === 200 && Array.isArray(buyersRes.data?.data), 'GET /masters/buyers -> Buyers loaded', buyersRes.data);
  const buyers = buyersRes.data?.data || [];

  const suppliersRes = await request('/masters/suppliers', { headers: activeHeaders });
  assert(suppliersRes.status === 200 && Array.isArray(suppliersRes.data?.data), 'GET /masters/suppliers -> Suppliers loaded', suppliersRes.data);
  const suppliers = suppliersRes.data?.data || [];

  const yarnTypesRes = await request('/masters/yarn-types', { headers: activeHeaders });
  assert(
    yarnTypesRes.status === 200 &&
      Array.isArray(yarnTypesRes.data?.data) &&
      yarnTypesRes.data.data.length > 0 &&
      typeof yarnTypesRes.data.data[0].availableKg === 'number',
    'GET /masters/yarn-types -> Yarn types enriched with live availableKg & stock balances',
    yarnTypesRes.data?.data?.[0]
  );
  const yarnTypes = yarnTypesRes.data?.data || [];

  const machinesRes = await request('/masters/machines', { headers: activeHeaders });
  assert(machinesRes.status === 200 && Array.isArray(machinesRes.data?.data), 'GET /masters/machines -> Machines loaded', machinesRes.data);
  const machines = machinesRes.data?.data || [];

  const workersRes = await request('/masters/workers', { headers: activeHeaders });
  assert(workersRes.status === 200 && Array.isArray(workersRes.data?.data), 'GET /masters/workers -> Workers loaded', workersRes.data);

  // 4. STOCK & INVENTORY
  console.log('\n--- 4. Stock & Inventory Management ---');
  const summaryRes = await request('/stock/summary', { headers: activeHeaders });
  assert(summaryRes.status === 200 && Array.isArray(summaryRes.data?.data), 'GET /stock/summary -> Stock balances retrieved', summaryRes.data);

  const selectedYarn = yarnTypes[0];
  const selectedSupplier = suppliers[0];
  const receiptRes = await request('/stock/receipts', {
    method: 'POST',
    headers: activeHeaders,
    body: JSON.stringify({
      yarnTypeId: selectedYarn.id,
      supplierId: selectedSupplier.id,
      kg: 100,
      ratePerKg: 250,
      reference: `AUDIT-REC-${Date.now().toString().slice(-4)}`,
    }),
  });
  assert(receiptRes.status === 201 && !!receiptRes.data?.data?.movement, 'POST /stock/receipts -> Yarn receipt recorded', receiptRes.data);

  const ledgerRes = await request(`/stock/ledger?yarnTypeId=${selectedYarn.id}&limit=5`, { headers: activeHeaders });
  assert(ledgerRes.status === 200 && Array.isArray(ledgerRes.data?.data?.items), 'GET /stock/ledger -> Audit ledger trail verified', ledgerRes.data);

  const finishedStockRes = await request('/stock/finished', { headers: activeHeaders });
  assert(finishedStockRes.status === 200 && Array.isArray(finishedStockRes.data?.data), 'GET /stock/finished -> Finished fabric stock balances', finishedStockRes.data);

  // 5. ORDERS & FEASIBILITY
  console.log('\n--- 5. Orders & Feasibility Preview ---');
  const feasRes = await request('/orders/feasibility', {
    method: 'POST',
    headers: activeHeaders,
    body: JSON.stringify({
      yarnRequirements: [{ yarnTypeId: selectedYarn.id, requiredKg: 50 }],
    }),
  });
  assert(feasRes.status === 200 && typeof feasRes.data?.data?.isFeasible === 'boolean', 'POST /orders/feasibility -> Real-time stock reservation feasibility', feasRes.data);

  const createOrderRes = await request('/orders', {
    method: 'POST',
    headers: activeHeaders,
    body: JSON.stringify({
      buyerId: buyers[0].id,
      fabricType: 'Cotton Twill 2/1',
      colour: 'Bleached White',
      metres: 300,
      ratePerMetre: 160,
      deadline: '2026-11-30',
      yarnRequirements: [{ yarnTypeId: selectedYarn.id, requiredKg: 40 }],
    }),
  });
  assert(createOrderRes.status === 201 && !!createOrderRes.data?.data?.id, 'POST /orders -> Order created with tracking token', createOrderRes.data);
  const createdOrder = createOrderRes.data?.data;

  const getOrderRes = await request(`/orders/${createdOrder.id}`, { headers: activeHeaders });
  assert(getOrderRes.status === 200 && getOrderRes.data?.data?.id === createdOrder.id, 'GET /orders/:id -> Order detail retrieved', getOrderRes.data);

  // Start production on order
  const startOrderRes = await request(`/orders/${createdOrder.id}/start`, {
    method: 'POST',
    headers: activeHeaders,
  });
  assert(startOrderRes.status === 200 && startOrderRes.data?.data?.status === 'IN_PRODUCTION', 'POST /orders/:id/start -> Production started & yarn issued', startOrderRes.data);

  // 6. FLOOR MANAGEMENT
  console.log('\n--- 6. Floor Management & Machine Operations ---');
  const floorBoardRes = await request('/floor/board', { headers: activeHeaders });
  assert(floorBoardRes.status === 200 && Array.isArray(floorBoardRes.data?.data?.machines), 'GET /floor/board -> Live floor board with utilization stats', floorBoardRes.data?.data?.stats);

  const floorStaffRes = await request('/floor/staff', { headers: activeHeaders });
  assert(floorStaffRes.status === 200 && Array.isArray(floorStaffRes.data?.data), 'GET /floor/staff -> Floor staff operators', floorStaffRes.data);

  // 7. QC & ROLLS
  console.log('\n--- 7. Quality Control Queue & Roll Inspections ---');
  const qcQueueRes = await request('/qc/queue', { headers: activeHeaders });
  assert(qcQueueRes.status === 200 && Array.isArray(qcQueueRes.data?.data), 'GET /qc/queue -> QC inspection queue retrieved', qcQueueRes.data);

  // 7b. Roll Traceability (API-33 / US-15)
  console.log('\n--- 7b. Roll Traceability (API-33 / US-15) ---');
  const rollTraceRes = await request('/rolls/ROLL-0001/trace', { headers: activeHeaders });
  assert(
    rollTraceRes.status === 200 &&
      rollTraceRes.data?.data?.roll?.rollNo === 'ROLL-0001' &&
      Array.isArray(rollTraceRes.data?.data?.yarnIssued) &&
      Array.isArray(rollTraceRes.data?.data?.stageJobs) &&
      Array.isArray(rollTraceRes.data?.data?.qcHistory),
    'GET /rolls/:id/trace -> Full roll genealogy with order, machines, yarn & QC history',
    rollTraceRes.data?.data?.roll
  );

  // 8. DISPATCH & INVOICING
  console.log('\n--- 8. Dispatch Validation, Invoicing & Payments ---');
  const dispatchGoodsRes = await request('/dispatch/goods', { headers: activeHeaders });
  assert(dispatchGoodsRes.status === 200 && Array.isArray(dispatchGoodsRes.data?.data), 'GET /dispatch/goods -> Finished rolls for dispatch', dispatchGoodsRes.data);

  const validateCodeRes = await request('/dispatch/validate?code=ROLL-0001', { headers: activeHeaders });
  assert(validateCodeRes.status === 200 && typeof validateCodeRes.data?.data?.valid === 'boolean', 'GET /dispatch/validate -> Roll QR/Barcode validation logic', validateCodeRes.data);

  const invoicesRes = await request('/invoices', { headers: activeHeaders });
  assert(invoicesRes.status === 200 && Array.isArray(invoicesRes.data?.data), 'GET /invoices -> Customer invoices listed', invoicesRes.data);

  // 9. ATTENDANCE & WAGES
  console.log('\n--- 9. Attendance & Wages ---');
  const todayStr = new Date().toISOString().slice(0, 10);
  const attendanceRes = await request(`/attendance?date=${todayStr}`, { headers: activeHeaders });
  assert(attendanceRes.status === 200 && Array.isArray(attendanceRes.data?.data?.records), 'GET /attendance -> Daily staff attendance list', attendanceRes.data);

  const currentMonth = todayStr.slice(0, 7);
  const wagesRes = await request(`/attendance/wages?month=${currentMonth}`, { headers: activeHeaders });
  assert(wagesRes.status === 200 && typeof wagesRes.data?.data?.totalWages === 'number', 'GET /attendance/wages -> Monthly wage calculation', wagesRes.data);

  // 10. REPORTS & PUBLIC TRACKING
  console.log('\n--- 10. Reports & Public Tracking ---');
  const dashboardRes = await request('/reports/dashboard', { headers: activeHeaders });
  assert(dashboardRes.status === 200 && !!dashboardRes.data?.data, 'GET /reports/dashboard -> Factory operational dashboard metrics', dashboardRes.data);

  const monthEndRes = await request(`/reports/month-end?month=${currentMonth}`, { headers: activeHeaders });
  assert(monthEndRes.status === 200 && typeof monthEndRes.data?.data?.profit === 'number', 'GET /reports/month-end -> Financial month-end P&L report', monthEndRes.data);

  const publicTrackRes = await request(`/public/track/${createdOrder.trackingToken}`);
  assert(publicTrackRes.status === 200 && publicTrackRes.data?.data?.orderNumber === createdOrder.orderNumber, 'GET /public/track/:token -> Public buyer tracker (Zero auth needed)', publicTrackRes.data);

  // 11. STAFF MANAGEMENT
  console.log('\n--- 11. Staff Management (Admin) ---');
  const staffRes = await request('/staff', { headers: activeHeaders });
  assert(staffRes.status === 200 && Array.isArray(staffRes.data?.data), 'GET /staff -> Staff administrative list', staffRes.data);

  console.log('\n====================================================');
  console.log(` AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
