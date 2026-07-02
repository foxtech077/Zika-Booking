import { PrismaClient } from '../services/auth-service/src/generated/index.js';

process.env.DATABASE_URL = "postgresql://zika_user:aakopass123@localhost:5432/zika_booking?schema=auth";

const prisma = new PrismaClient();

async function run() {
  console.log('Querying columns for auth."Accreditation" table on port 5432...');

  try {
    const columns = await prisma.$queryRaw<any[]>`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'auth' AND table_name = 'Accreditation'
    `;
    console.log('Columns of auth.Accreditation:');
    console.table(columns);
  } catch (err: any) {
    console.error('Failed to query columns:', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch(console.error);
