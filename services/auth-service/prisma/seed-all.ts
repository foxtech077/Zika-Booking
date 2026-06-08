/**
 * seed-all.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Idempotent seed script — safe to run multiple times.
 *
 * What it seeds:
 *   auth schema    → AdminUser (devadmin), User (guest1 + testprovider99)
 *   listings schema → everything in ../../seed.sql
 *
 * Run from project root:
 *   pnpm db:seed:all
 */
import { PrismaClient } from "../src/generated/index.js";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Auth schema client (uses DATABASE_URL which must include ?schema=auth) ────
const authDbUrl = process.env.DATABASE_URL;
if (!authDbUrl) throw new Error("DATABASE_URL env variable is not set!");

const authPrisma = new PrismaClient({
  datasources: { db: { url: authDbUrl } },
});

// ── Listings schema client (raw SQL only — no generated types for this schema)
const listingsDbUrl = process.env.DATABASE_URL?.replace(
  "schema=auth",
  "schema=listings"
);
if (!listingsDbUrl) throw new Error("DATABASE_URL env variable is not set!");

const listingsPrisma = new PrismaClient({
  datasources: { db: { url: listingsDbUrl } },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Split a SQL file into individual statements.
 * Handles:
 *  - single-line comments (--)
 *  - multi-line DO $$ … $$ blocks (treated as one statement)
 *  - trailing semicolons as delimiters
 */
function splitSql(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollarBlock = false;

  for (const line of sql.split(/\r?\n/)) {
    const trimmed = line.trim();

    // Track $$ dollar-quoting (DO $$ … END $$)
    const dollarCount = (line.match(/\$\$/g) ?? []).length;
    if (dollarCount % 2 !== 0) inDollarBlock = !inDollarBlock;

    current += line + "\n";

    // A semicolon at end of line terminates a statement (unless inside a $$ block)
    if (!inDollarBlock && trimmed.endsWith(";")) {
      const stmt = current.trim();
      if (stmt.length > 0) statements.push(stmt);
      current = "";
    }
  }

  // Flush any trailing statement without a trailing semicolon
  const leftover = current.trim();
  if (leftover.length > 0) statements.push(leftover);

  return statements;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const plainAdminPassword = "AdminPassword123!";
  const plainUserPassword = "Password123!";

  console.log("Hashing passwords...");
  const adminPasswordHash = await bcrypt.hash(plainAdminPassword, 12);
  const userPasswordHash = await bcrypt.hash(plainUserPassword, 12);

  // ── 1. Dev admin ────────────────────────────────────────────────────────────
  console.log("\nSeeding dev admin user...");
  await authPrisma.adminUser.upsert({
    where: { email: "devadmin@zika.com" },
    update: { name: "Dev Admin", passwordHash: adminPasswordHash, role: "super_admin", totpEnabled: false },
    create:  { name: "Dev Admin", email: "devadmin@zika.com", passwordHash: adminPasswordHash, role: "super_admin", totpEnabled: false },
  });
  console.log("  ✔ devadmin@zika.com  (password: AdminPassword123!)");

  // ── 2. Guest user ───────────────────────────────────────────────────────────
  console.log("\nSeeding test guest & provider users...");
  await authPrisma.user.upsert({
    where: { id: "cmosebuyd000ej9kcyqnm3ha3" },
    update: {
      firstName: "John", lastName: "Doe", email: "guest1@test.com",
      passwordHash: userPasswordHash, status: "active", userType: "guest",
      emailVerified: true, currentTier: "silver", loyaltyPoints: 1555,
    },
    create: {
      id: "cmosebuyd000ej9kcyqnm3ha3",
      firstName: "John", lastName: "Doe", email: "guest1@test.com",
      passwordHash: userPasswordHash, status: "active", userType: "guest",
      emailVerified: true, currentTier: "silver", loyaltyPoints: 1555,
    },
  });
  console.log("  ✔ guest1@test.com  (password: Password123!)");

  // ── 3. Provider user ────────────────────────────────────────────────────────
  await authPrisma.user.upsert({
    where: { id: "cmos7y8zp0009j9kc5o4ed3c0" },
    update: {
      firstName: "Test", lastName: "Provider", email: "testprovider99@zika.com",
      passwordHash: userPasswordHash, status: "active", userType: "provider",
      businessName: "Zika Rentals Ltd", country: "KE",
      emailVerified: true, currentTier: "bronze", loyaltyPoints: 0,
    },
    create: {
      id: "cmos7y8zp0009j9kc5o4ed3c0",
      firstName: "Test", lastName: "Provider", email: "testprovider99@zika.com",
      passwordHash: userPasswordHash, status: "active", userType: "provider",
      businessName: "Zika Rentals Ltd", country: "KE",
      emailVerified: true, currentTier: "bronze", loyaltyPoints: 0,
    },
  });
  console.log("  ✔ testprovider99@zika.com  (password: Password123!)");

  // ── 4. listings schema — execute seed.sql ──────────────────────────────────
  console.log("\nExecuting seed.sql into listings schema...");

  const seedSqlPath = path.join(__dirname, "../../../seed.sql");
  const rawSql = fs.readFileSync(seedSqlPath, "utf8");

  // Route the loyalty-point UPDATE to the auth schema where "User" lives
  const modifiedSql = rawSql.replace(/UPDATE\s+"User"/gi, 'UPDATE auth."User"');

  // Photos use gen_random_uuid() so they can't upsert — clear them first to keep
  // the seed idempotent when run multiple times.
  console.log("  Clearing listing_photos for idempotent re-seed...");
  await listingsPrisma.$executeRawUnsafe("DELETE FROM listing_photos");

  const statements = splitSql(modifiedSql);
  console.log(`  Parsed ${statements.length} SQL statements.`);

  let i = 0;
  for (const stmt of statements) {
    // Determine the actual SQL verb by skipping leading comment/blank lines
    const firstSqlLine = stmt
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith("--")) ?? "";
    const verb = firstSqlLine.toUpperCase().split(/\s+/)[0];

    // Skip SELECT statements (row-count checks at end of seed.sql)
    if (verb === "SELECT") {
      console.log(`  ⚠  Skipped SELECT statement (verification only)`);
      continue;
    }

    // Make INSERT statements idempotent — append ON CONFLICT DO NOTHING
    // if the statement doesn't already have a conflict clause.
    let execStmt = stmt;
    if (verb === "INSERT" && !stmt.toUpperCase().includes("ON CONFLICT")) {
      execStmt = stmt.replace(/;\s*$/, "") + "\nON CONFLICT DO NOTHING;";
    }

    try {
      await listingsPrisma.$executeRawUnsafe(execStmt);
      i++;
    } catch (err: any) {
      console.error(`\n  ❌ Statement ${i + 1} (${verb}) failed:\n${execStmt.slice(0, 300)}`);
      throw err;
    }
  }

  console.log(`\n  ✔ Executed ${i} SQL statements in listings schema.`);
}

main()
  .then(() => {
    console.log("\n✅ All schemas seeded successfully!\n");
    console.log("  Accounts:");
    console.log("    Admin  → devadmin@zika.com          / AdminPassword123!");
    console.log("    Guest  → guest1@test.com             / Password123!");
    console.log("    Provider → testprovider99@zika.com  / Password123!\n");
  })
  .catch((e) => {
    console.error("\n❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await authPrisma.$disconnect();
    await listingsPrisma.$disconnect();
  });
