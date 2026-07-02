import { PrismaClient } from '../services/auth-service/src/generated/index.js';

const prisma = new PrismaClient();

async function run() {
  const countryScope = ['KE'];
  console.log(`Testing Country Manager Pending Action Counts for scope: ${countryScope}`);

  try {
    // 1. Hotel approvals count
    const hotelData = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count FROM listing.listing_review_tasks t
      JOIN listing.listings l ON t.listing_id = l.id
      WHERE t.status = 'open' AND l.country = ANY(${countryScope})
    `;
    const hotelCount = Number(hotelData[0]?.count || 0);
    console.log('Hotel Approvals count:', hotelCount);

    // 2. Pending accreditations count
    const pendingAccreditations = await prisma.accreditation.count({
      where: {
        status: "pending",
        user: { country: { in: countryScope } }
      }
    });
    console.log('Pending Accreditations count:', pendingAccreditations);

    // 3. Pending refund requests count
    const refundData = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count FROM payments."Refund" r
      JOIN payments."Payment" p ON r."paymentId" = p.id
      JOIN listing.bookings b ON p."bookingId" = b.id
      JOIN listing.listings l ON b.listing_id = l.id
      WHERE r.status = 'pending' AND l.country = ANY(${countryScope})
    `;
    const refundCount = Number(refundData[0]?.count || 0);
    console.log('Pending Refund Requests count:', refundCount);

    console.log('\nAll queries executed successfully! Verification PASSED.');
  } catch (err: any) {
    console.error('Queries execution failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch(console.error);
