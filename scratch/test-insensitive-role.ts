import { PrismaClient } from '../services/auth-service/src/generated/index.js';

const prisma = new PrismaClient();

async function run() {
  console.log('--- Testing AuditLog Insensitive Role Filter ---');

  try {
    const role1 = 'SUPER_ADMIN';
    const logs1 = await prisma.auditLog.findMany({
      where: {
        role: { equals: role1, mode: 'insensitive' }
      },
      take: 2
    });
    console.log(`Insensitive equalsSUPER_ADMIN worked! Found: ${logs1.length}`);

    const role2 = 'super admin';
    const logs2 = await prisma.auditLog.findMany({
      where: {
        role: { contains: role2, mode: 'insensitive' }
      },
      take: 2
    });
    console.log(`Insensitive contains 'super admin' worked! Found: ${logs2.length}`);
  } catch (err: any) {
    console.error('Prisma query failed:');
    console.error(err);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
