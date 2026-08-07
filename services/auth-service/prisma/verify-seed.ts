/**
 * verify-seed.ts
 * Quick check — prints row counts for all seed tables.
 * Run: pnpm tsx prisma/verify-seed.ts
 *
 * NOTE: The auth Prisma client only knows the auth schema models (User, AdminUser, etc.).
 * For listing-schema models we use raw SQL via $queryRawUnsafe so we don't need a
 * separate generated client.
 */
import { PrismaClient as AuthPrisma } from "../src/generated/index.js";

const authPrisma = new AuthPrisma();

const listingsDbUrl = process.env.DATABASE_URL?.replace("schema=auth", "schema=listings");
if (!listingsDbUrl) throw new Error("DATABASE_URL not set");

// Re-use the same auth PrismaClient but pointed at the listings schema URL.
// We'll query via raw SQL so we don't need separate generated types.
const rawPrisma = new AuthPrisma({
  datasources: { db: { url: listingsDbUrl } },
});

async function count(client: AuthPrisma, table: string): Promise<number> {
  const result = await client.$queryRawUnsafe<[{ count: string }]>(
    `SELECT COUNT(*)::text AS count FROM ${table}`
  );
  return parseInt(result[0].count, 10);
}

async function main() {
  // --- auth schema ---
  const users = await authPrisma.user.count();
  const admins = await authPrisma.adminUser.count();

  console.log("\n=== auth schema ===");
  console.log(`  User:      ${users}  (expected 2 — guest + provider)`);
  console.log(`  AdminUser: ${admins}  (expected 1 — devadmin)`);

  // --- listings schema (raw queries) ---
  const [listings, photos, amenities, bookings, reviews, commission] =
    await Promise.all([
      count(rawPrisma, "listings"),
      count(rawPrisma, "listing_photos"),
      count(rawPrisma, "listing_amenities"),
      count(rawPrisma, "bookings"),
      count(rawPrisma, "listing_reviews"),
      count(rawPrisma, "commission_rates"),
    ]);

  console.log("\n=== listings schema ===");
  console.log(`  listings:          ${listings}   (expected 12)`);
  console.log(`  listing_photos:    ${photos}   (expected 38)`);
  console.log(`  listing_amenities: ${amenities}  (expected ~72)`);
  console.log(`  bookings:          ${bookings}    (expected 4)`);
  console.log(`  listing_reviews:   ${reviews}    (expected 1)`);
  console.log(`  commission_rates:  ${commission}    (expected 1)`);

  const ok =
    users >= 2 &&
    admins >= 1 &&
    listings === 12 &&
    photos === 38 &&
    bookings === 4 &&
    reviews === 1 &&
    commission === 1;

  if (ok) {
    console.log("\n✅ All row counts match — seed is complete!\n");
  } else {
    console.log(
      "\n⚠️  Some counts don't match expected values — seed may be incomplete.\n"
    );
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await authPrisma.$disconnect();
    await rawPrisma.$disconnect();
  });
