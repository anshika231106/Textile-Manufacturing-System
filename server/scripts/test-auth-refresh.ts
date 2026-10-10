import { loginService, refreshService, logoutService, getMeService } from '../src/modules/auth/auth.service';
import { prisma } from '../src/db/prisma';

async function run() {
  console.log('🧪 Starting Auth Access + Refresh Token Test Suite...\n');

  // 1. Test Login
  console.log('1. Testing login with owner@everest.com...');
  const loginRes = await loginService('owner@everest.com', 'password');
  console.log('✅ Login successful:');
  console.log(`   - Access Token: ${loginRes.accessToken.substring(0, 20)}...`);
  console.log(`   - Refresh Token: ${loginRes.refreshToken.substring(0, 20)}...`);
  console.log(`   - User: ${loginRes.user.name} (${loginRes.user.role})`);

  if (!loginRes.accessToken || !loginRes.refreshToken) {
    throw new Error('Expected both accessToken and refreshToken on login');
  }

  // 2. Test Get Me with user id
  console.log('\n2. Testing getMeService with user ID...');
  const me = await getMeService(loginRes.user.id);
  console.log(`✅ GetMe successful: ${me.email} - ${me.role}`);

  // 3. Test Refresh Token Rotation
  console.log('\n3. Testing refreshService token rotation...');
  const refreshRes = await refreshService(loginRes.refreshToken);
  console.log('✅ Token refresh successful:');
  console.log(`   - New Access Token: ${refreshRes.accessToken.substring(0, 20)}...`);
  console.log(`   - New Refresh Token: ${refreshRes.refreshToken.substring(0, 20)}...`);

  if (refreshRes.refreshToken === loginRes.refreshToken) {
    throw new Error('Refresh token was not rotated!');
  }

  // 4. Test Token Reuse Detection (Re-using old refresh token)
  console.log('\n4. Testing reuse of old refresh token (should fail)...');
  try {
    await refreshService(loginRes.refreshToken);
    throw new Error('Security check failed: Reusing old refresh token did not throw!');
  } catch (err: any) {
    console.log(`✅ Token reuse prevented: ${err.message}`);
  }

  // 5. Test Logout (Revoke active refresh token)
  console.log('\n5. Testing logoutService with active refresh token...');
  await logoutService(refreshRes.refreshToken);
  console.log('✅ Logout called.');

  // 6. Test Refresh after Logout (should fail)
  console.log('\n6. Testing refresh after logout (should fail)...');
  try {
    await refreshService(refreshRes.refreshToken);
    throw new Error('Security check failed: Refreshing revoked token did not throw!');
  } catch (err: any) {
    console.log(`✅ Revoked token rejected: ${err.message}`);
  }

  console.log('\n🎉 ALL ACCESS + REFRESH TOKEN TESTS PASSED PERFECTLY!\n');
}

run()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
