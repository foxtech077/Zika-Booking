import { PrismaClient } from '../services/auth-service/src/generated/index.js';

const prisma = new PrismaClient();

async function run() {
  console.log('--- Testing AuditLog Role Filter ---');

  try {
    const role = 'super_admin';
    const logs = await prisma.auditLog.findMany({
      where: {
        role: { equals: role }
      },
      include: {
        admin: { select: { name: true, email: true } },
      },
    });

    console.log(`Query succeeded! Found ${logs.length} logs for role ${role}`);
    if (logs.length > 0) {
      console.log('First log entry:', logs[0]);
    }
  } catch (err: any) {
    console.error('Prisma query failed:');
    console.error(err);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
