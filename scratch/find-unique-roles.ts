import { PrismaClient } from '../services/auth-service/src/generated/index.js';

const prisma = new PrismaClient();

async function run() {
  console.log('--- Listing Unique Roles in AuditLog ---');

  try {
    const roles = await prisma.auditLog.groupBy({
      by: ['role'],
      _count: {
        role: true
      }
    });

    console.log('Unique roles and counts:');
    console.log(roles);
  } catch (err: any) {
    console.error('Prisma query failed:');
    console.error(err);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
