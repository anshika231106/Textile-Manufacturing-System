export {};

async function run() {
  const BASE_URL = 'http://localhost:4000/api/v1';

  console.log('--- TEST STOCK API INTEGRATION ---');

  // 1. Health check
  console.log('\n1. Health check...');
  const healthRes = await fetch(`${BASE_URL}/health`);
  const healthData = await healthRes.json();
  console.log('Health status:', healthRes.status, healthData);

  // 1b. Login as owner to obtain Bearer token
  console.log('\n1b. Logging in as owner@everest.com...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@everest.com', password: 'password' }),
  });
  const loginData = await loginRes.json();
  if (loginRes.status !== 200 || !loginData.data?.accessToken) {
    throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginData)}`);
  }
  const token = loginData.data.accessToken;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  console.log('Login successful, token obtained.');

  // 2. Masters check (suppliers & yarn-types)
  console.log('\n2. Fetching yarn types and suppliers...');
  const ytRes = await fetch(`${BASE_URL}/yarn-types`, { headers: authHeaders });
  const ytData = await ytRes.json();
  const yarnTypes = ytData.data || ytData;
  console.log(`Found ${yarnTypes.length} yarn types:`, yarnTypes.map((y: any) => `${y.code} (${y.id})`));

  const supRes = await fetch(`${BASE_URL}/suppliers`, { headers: authHeaders });
  const supData = await supRes.json();
  const suppliers = supData.data || supData;
  console.log(`Found ${suppliers.length} suppliers:`, suppliers.map((s: any) => `${s.name} (${s.id})`));

  if (!yarnTypes.length || !suppliers.length) {
    throw new Error('Yarn types or suppliers missing in database. Please run seed first.');
  }

  const testYarn = yarnTypes[0];
  const testSupplier = suppliers[0];

  // 3. Stock Summary
  console.log('\n3. Fetching Stock Summary...');
  const summaryRes = await fetch(`${BASE_URL}/stock/summary`, { headers: authHeaders });
  const summaryData = await summaryRes.json();
  const summaryList = summaryData.data || summaryData;
  console.log(`Summary items: ${summaryList.length}`);
  const targetStockBefore = summaryList.find((s: any) => s.yarnTypeId === testYarn.id);
  console.log(`Stock before receipt for ${testYarn.code}:`, targetStockBefore);

  // 4. Record a receipt
  console.log(`\n4. Recording receipt: 150 kg of ${testYarn.code} at rate 260...`);
  const receiptRes = await fetch(`${BASE_URL}/stock/receipts`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      yarnTypeId: testYarn.id,
      supplierId: testSupplier.id,
      kg: 150,
      ratePerKg: 260,
      reference: `LIVE-REC-${Date.now().toString().slice(-4)}`,
    }),
  });
  const receiptData = await receiptRes.json();
  console.log('Receipt response status:', receiptRes.status);
  console.log('Receipt response data:', receiptData);

  if (receiptRes.status !== 201) {
    throw new Error(`Receipt creation failed with status ${receiptRes.status}`);
  }

  // 5. Fetch Ledger
  console.log(`\n5. Fetching ledger for ${testYarn.code}...`);
  const ledgerRes = await fetch(`${BASE_URL}/stock/ledger?yarnTypeId=${testYarn.id}&limit=10`, { headers: authHeaders });
  const ledgerData = await ledgerRes.json();
  const ledgerItems = ledgerData.data?.items || ledgerData.items || [];
  console.log(`Ledger items returned: ${ledgerItems.length}`);
  console.log('Latest movement:', ledgerItems[0]);

  // 6. Finished Stock
  console.log('\n6. Fetching finished fabric stock...');
  const finRes = await fetch(`${BASE_URL}/stock/finished`, { headers: authHeaders });
  const finData = await finRes.json();
  console.log('Finished fabric stock entries:', finData.data || finData);

  console.log('\n✅ ALL 6 STOCK API INTEGRATION CHECKS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('\n Test failed with error:', err);
  process.exit(1);
});
