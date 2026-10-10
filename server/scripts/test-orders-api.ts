export {};

async function run() {
  const BASE_URL = 'http://localhost:4000/api/v1';

  console.log('--- TEST ORDERS API INTEGRATION ---');

  // 1. Health check
  console.log('\n1. Health check...');
  const healthRes = await fetch(`${BASE_URL}/health`);
  const healthData = await healthRes.json();
  console.log('Health status:', healthRes.status, healthData);

  // 2. Fetch master records (buyer and yarn)
  console.log('\n2. Fetching buyers and yarn types...');
  const buyersRes = await fetch(`${BASE_URL}/buyers`);
  const buyersData = await buyersRes.json();
  const buyers = buyersData.data || buyersData;
  console.log(`Found ${buyers.length} buyers:`, buyers.map((b: any) => `${b.name} (${b.id})`));

  const ytRes = await fetch(`${BASE_URL}/yarn-types`);
  const ytData = await ytRes.json();
  const yarnTypes = ytData.data || ytData;
  console.log(`Found ${yarnTypes.length} yarn types:`, yarnTypes.map((y: any) => `${y.code} (${y.id})`));

  if (!buyers.length || !yarnTypes.length) {
    throw new Error('Database missing buyers or yarn types. Please run seed.');
  }

  const testBuyer = buyers[0];
  const testYarn = yarnTypes[0];

  // 3. Feasibility preview
  console.log(`\n3. Checking feasibility for 500m needing 0.15 kg/m of ${testYarn.code}...`);
  const feasRes = await fetch(`${BASE_URL}/orders/feasibility`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      metres: 500,
      lines: [{ yarnTypeId: testYarn.id, kgPerMetre: 0.15 }],
    }),
  });
  const feasData = await feasRes.json();
  console.log('Feasibility status:', feasRes.status);
  console.log('Feasibility result:', feasData);

  if (feasRes.status !== 200 || !feasData.data.canStart) {
    throw new Error('Feasibility check failed');
  }

  // 4. Create Order
  console.log(`\n4. Creating order for ${testBuyer.name}...`);
  const createRes = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      buyerId: testBuyer.id,
      fabricType: 'Cotton Twill Premium',
      colour: 'Deep Indigo',
      metres: 500,
      ratePerMetre: 140,
      deadline: '2026-10-31',
      lines: [{ yarnTypeId: testYarn.id, kgPerMetre: 0.15 }],
    }),
  });
  const createData = await createRes.json();
  console.log('Create order status:', createRes.status);
  const createdOrder = createData.data;
  console.log('Created order:', {
    id: createdOrder.id,
    orderNo: createdOrder.orderNo,
    status: createdOrder.status,
    trackingToken: createdOrder.trackingToken,
  });

  if (createRes.status !== 201) {
    throw new Error(`Order creation failed with status ${createRes.status}`);
  }

  // 5. List Orders
  console.log('\n5. Listing orders...');
  const listRes = await fetch(`${BASE_URL}/orders`);
  const listData = await listRes.json();
  const orders = listData.data || listData.items || [];
  console.log(`Total orders returned: ${orders.length}`);
  const foundOrder = orders.find((o: any) => o.id === createdOrder.id);
  if (!foundOrder) {
    throw new Error('Newly created order was not found in list response');
  }
  console.log('Order found in list:', foundOrder.orderNo, foundOrder.status);

  // 6. Get Order Detail
  console.log(`\n6. Fetching detail for order ${createdOrder.id}...`);
  const detailRes = await fetch(`${BASE_URL}/orders/${createdOrder.id}`);
  const detailData = await detailRes.json();
  console.log('Detail response status:', detailRes.status);
  console.log('Detail requirements:', detailData.data.requirements);

  // 7. Start Production
  console.log(`\n7. Starting production on order ${createdOrder.id}...`);
  const startRes = await fetch(`${BASE_URL}/orders/${createdOrder.id}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const startData = await startRes.json();
  console.log('Start production status:', startRes.status);
  console.log('Order status after start:', startData.data.status, startData.data.canonicalStatus);

  if (startRes.status !== 200 || startData.data.status !== 'IN_PRODUCTION') {
    throw new Error('Order status was not updated to IN_PRODUCTION');
  }

  // 8. Test Duplicate Start Guard (Should return 409)
  console.log('\n8. Testing duplicate start guard (expecting 409 ALREADY_STARTED)...');
  const dupRes = await fetch(`${BASE_URL}/orders/${createdOrder.id}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const dupData = await dupRes.json();
  console.log('Duplicate start status:', dupRes.status, dupData.error?.code);

  if (dupRes.status !== 409) {
    throw new Error(`Expected status 409, got ${dupRes.status}`);
  }

  console.log('\n ALL 8 ORDERS API INTEGRATION CHECKS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('\n Test failed with error:', err);
  process.exit(1);
});
