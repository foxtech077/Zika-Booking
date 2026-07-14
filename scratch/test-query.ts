import { PrismaClient } from '../services/auth-service/src/generated/index.js';

const prisma = new PrismaClient();

async function run() {
  const countryScope = ['IN', 'US'];
  const limit = 50;
  const offset = 0;

  try {
    console.log('Running country-manager recent-activity query...');
    const activities = await prisma.$queryRaw<any[]>`
      SELECT 
        m.id::text as id, 
        'moderation' as type, 
        m.action, 
        m.actor_id as actor, 
        m.created_at as timestamp, 
        m.metadata::jsonb as metadata 
      FROM listing.listing_moderation_log m
      JOIN listing.listings l ON m.listing_id = l.id
      WHERE l.country = ANY(${countryScope})
      
      UNION ALL
      
      SELECT 
        r.id::text as id, 
        'refund' as type, 
        'refund_issued' as action, 
        'system' as actor, 
        r."created_at" as timestamp, 
        json_build_object('paymentId', r."payment_id", 'amount', r.amount)::jsonb as metadata 
      FROM payments."Refund" r
      JOIN payments."Payment" p ON r."payment_id" = p.id
      JOIN listing.bookings b ON p."bookingId" = b.id
      JOIN listing.listings l ON b.listing_id = l.id
      WHERE r.status = 'succeeded' AND l.country = ANY(${countryScope})
      
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    console.log('Query succeeded! Total results:', activities.length);
  } catch (err: any) {
    console.error('Query failed with error:');
    console.error(err);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
