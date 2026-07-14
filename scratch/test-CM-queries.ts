import { PrismaClient } from '../services/auth-service/src/generated/index.js';

const prisma = new PrismaClient();

async function run() {
  console.log('Testing Super Admin Recent Activity raw query...');

  try {
    const activities = await prisma.$queryRaw<any[]>`
      SELECT
        id::text as id,
        'audit' as type,
        action,
        "adminId" as actor,
        timestamp,
        jsonb_build_object('role', role, 'target', "targetType") as metadata
      FROM auth."AuditLog"

      UNION ALL

      SELECT
        id::text as id,
        'moderation' as type,
        action,
        actor_id as actor,
        created_at as timestamp,
        to_jsonb(metadata) as metadata
      FROM listing.listing_moderation_log

      UNION ALL

      SELECT
        id::text as id,
        'refund' as type,
        'refund_issued' as action,
        'system' as actor,
        "created_at" as timestamp,
        jsonb_build_object('paymentId', "payment_id", 'amount', amount) as metadata
      FROM payments."Refund"
      WHERE status = 'succeeded'
      
      ORDER BY timestamp DESC
      LIMIT 15 OFFSET 0
    `;
    console.log('Query succeeded! Result count:', activities.length);
  } catch (err: any) {
    console.error('Super Admin query failed with error:');
    console.error(err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch(console.error);
