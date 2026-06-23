import { PrismaClient } from '../services/auth-service/src/generated/index.js';
import { SignJWT } from 'jose';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Read env variables directly or use fallback values matching auth-service/.env
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || '8fa61f0d3a3d4a49f95ca91c76f311ed4758e259207fdea7d5f4bafcfe9c92ed863677d5fd29673badf2237e1ceae6e5e55219f0e3b48eeae45285ef8f2c44ed';
const AUTH_SERVICE_PORT = process.env.AUTH_SERVICE_PORT || '3001';

function hashToken(plainToken: string): string {
  return crypto.createHash('sha256').update(plainToken).digest('hex');
}

async function run() {
  console.log('--- Testing Audit Log Filters & Search via REST API ---');

  // 1. Find a super_admin in the DB
  const admin = await prisma.adminUser.findFirst({
    where: { role: 'super_admin' }
  });

  if (!admin) {
    console.error('No super_admin user found in DB to perform test!');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`Using admin user: ${admin.email} (id: ${admin.id}, role: ${admin.role})`);

  // 2. Create a session row
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const tempSession = await prisma.adminSession.create({
    data: {
      adminUserId: admin.id,
      tokenHash: 'pending',
      expiresAt,
    },
  });

  // 3. Sign JWT
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(ADMIN_JWT_SECRET);
  const jwt = await new SignJWT({
    sub: admin.id,
    role: admin.role,
    sessionId: tempSession.id,
    countryScope: admin.countryScope || [],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey);

  // 4. Update session row with tokenHash
  const tokenHash = hashToken(jwt);
  await prisma.adminSession.update({
    where: { id: tempSession.id },
    data: { tokenHash },
  });

  console.log('Session created successfully.');

  const baseUrl = `http://localhost:${AUTH_SERVICE_PORT}`;

  async function testRequest(urlPath: string, description: string) {
    console.log(`\nTesting: ${description}`);
    console.log(`GET ${baseUrl}${urlPath}`);
    try {
      const res = await fetch(`${baseUrl}${urlPath}`, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Accept': 'application/json'
        }
      });
      console.log(`Response Status: ${res.status}`);
      const data: any = await res.json();
      if (!res.ok) {
        console.error('Error:', data);
        return;
      }
      console.log(`Success! logs count: ${data.data?.logs?.length ?? 0}, total: ${data.data?.total ?? 0}`);
      if (data.data?.logs?.length > 0) {
        console.log('First log role in result:', data.data.logs[0].role);
        console.log('First log action in result:', data.data.logs[0].action);
      }
    } catch (err: any) {
      console.error('Request failed:', err.message);
    }
  }

  // 5. Test cases
  // A. Dropdown Filters (role)
  await testRequest('/admin/audit-logs?role=super_admin&limit=5', 'Role filter: super_admin (lowercase)');
  await testRequest('/admin/audit-logs?role=SUPER_ADMIN&limit=5', 'Role filter: SUPER_ADMIN (uppercase)');
  await testRequest('/admin/audit-logs?role=finance&limit=5', 'Role filter: finance (lowercase)');
  await testRequest('/admin/audit-logs?role=FiNaNcE&limit=5', 'Role filter: FiNaNcE (mixedcase)');

  // B. General Search (q)
  await testRequest('/admin/audit-logs?q=super_admin&limit=5', 'Search query: q=super_admin (lowercase)');
  await testRequest('/admin/audit-logs?q=SUPER_ADMIN&limit=5', 'Search query: q=SUPER_ADMIN (uppercase)');
  await testRequest('/admin/audit-logs?q=finance&limit=5', 'Search query: q=finance (lowercase)');
  await testRequest('/admin/audit-logs?q=FINANCE&limit=5', 'Search query: q=FINANCE (uppercase)');

  // 6. Clean up
  await prisma.adminSession.delete({
    where: { id: tempSession.id }
  });
  console.log('\nCleaned up session.');
  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
