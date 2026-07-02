import { PrismaClient } from '../services/listing-service/src/generated/index.js';

const prisma = new PrismaClient();

async function run() {
  const listingId = '80b305ca-f355-4a0c-b6d3-56881fcea041';
  const start = new Date('2026-07-02');
  const end = new Date('2026-07-03');
  const pendingExpiry = new Date(Date.now() - 300000); // 5 mins ago

  console.log(`Running checkAvailability query...`);

  try {
    const result = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*) AS count
      FROM listing.bookings
      WHERE listing_id = $1
        AND (
          status = 'confirmed'
          OR status = 'checked_in'
          OR (status = 'pending_payment' AND created_at > $2)
        )
        AND (
          (check_in IS NOT NULL     AND check_in     < $4 AND check_out      > $3)
          OR (pickup_datetime IS NOT NULL AND pickup_datetime < $4 AND return_datetime > $3)
        )
    `, listingId, pendingExpiry, start, end);

    console.log('Query executed successfully! count result:', result);
  } catch (err: any) {
    console.error('checkAvailability query failed with error:');
    console.error(err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch(console.error);
