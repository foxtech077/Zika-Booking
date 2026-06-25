import { PrismaClient } from '../services/auth-service/src/generated/index.js';

const prisma = new PrismaClient();

async function run() {
  console.log('--- Testing Immutability Trigger ---');

  // 1. Get an existing AuditLog entry
  const log = await prisma.auditLog.findFirst();
  if (!log) {
    console.log('No audit log entries found to test. Please perform an action or run seed first.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found log entry ID: ${log.id}`);

  // 2. Try to UPDATE the log entry
  try {
    console.log('Attempting to UPDATE the log entry...');
    await prisma.auditLog.update({
      where: { id: log.id },
      data: { action: 'malicious_update' },
    });
    console.error('ERROR: Update succeeded! Immutability trigger failed.');
  } catch (err: any) {
    console.log('SUCCESS: Update was blocked as expected.');
    console.log(`Blocked with error message: ${err.message || err}`);
  }

  // 3. Try to DELETE the log entry
  try {
    console.log('Attempting to DELETE the log entry...');
    await prisma.auditLog.delete({
      where: { id: log.id },
    });
    console.error('ERROR: Delete succeeded! Immutability trigger failed.');
  } catch (err: any) {
    console.log('SUCCESS: Delete was blocked as expected.');
    console.log(`Blocked with error message: ${err.message || err}`);
  }

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Unhandled script error:', err);
});
