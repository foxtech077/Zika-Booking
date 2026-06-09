import "dotenv/config";
import { PrismaClient } from "../src/generated/index.js";

const p = new PrismaClient();

async function main() {
  console.log("=".repeat(70));
  console.log("[SCHEMA-AUDIT] DATABASE_URL:", process.env["DATABASE_URL"]);
  console.log("=".repeat(70));

  // 1. Which DB, user, schema is Prisma actually connected to?
  const conn = await p.$queryRawUnsafe<{ db: string; schema: string; user: string; search_path: string }[]>(
    "SELECT current_database() as db, current_schema() as schema, current_user as user, current_setting('search_path') as search_path"
  );
  console.log("\n[1] Active connection:", JSON.stringify(conn[0], null, 2));

  // 2. ALL schemas in this database
  const schemas = await p.$queryRawUnsafe<{ schema_name: string; schema_owner: string }[]>(
    "SELECT schema_name, schema_owner FROM information_schema.schemata ORDER BY schema_name"
  );
  console.log("\n[2] All schemas in database:", JSON.stringify(schemas, null, 2));

  // 3. ALL tables named "User" across ALL schemas
  const userTables = await p.$queryRawUnsafe<{ table_schema: string; table_name: string }[]>(
    `SELECT table_schema, table_name
     FROM information_schema.tables
     WHERE table_name = 'User'
     ORDER BY table_schema`
  );
  console.log("\n[3] All 'User' tables across ALL schemas:", JSON.stringify(userTables, null, 2));

  // 4. Row count in EVERY User table found
  console.log("\n[4] Row counts per schema:");
  for (const t of userTables) {
    try {
      const count = await p.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count FROM "${t.table_schema}"."User"`
      );
      console.log(`    ${t.table_schema}.\"User\" → ${count[0]?.count} rows`);
    } catch (e: any) {
      console.log(`    ${t.table_schema}.\"User\" → ERROR: ${e.message}`);
    }
  }

  // 5. Prisma ORM count (what Prisma Studio sees)
  const prismaCount = await p.user.count();
  console.log(`\n[5] Prisma ORM user.count(): ${prismaCount}`);

  // 6. Email list from Prisma ORM
  const prismaUsers = await p.user.findMany({
    select: { id: true, email: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\n[6] Prisma ORM user list (${prismaUsers.length} users):`);
  prismaUsers.forEach((u, i) =>
    console.log(`    ${String(i + 1).padStart(2)}. ${u.email.padEnd(40)} ${u.status} | ${u.createdAt.toISOString()}`)
  );

  // 7. Raw SQL count in auth."User"
  try {
    const rawCount = await p.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM auth."User"`
    );
    console.log(`\n[7] Raw SQL COUNT(*) FROM auth."User": ${rawCount[0]?.count}`);
  } catch (e: any) {
    console.log(`\n[7] Raw SQL auth."User" ERROR: ${e.message}`);
  }

  // 8. Check public schema for any User table (ghost table check)
  try {
    const publicCount = await p.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM public."User"`
    );
    console.log(`\n[8] ⚠️  public."User" EXISTS with ${publicCount[0]?.count} rows — GHOST TABLE!`);
  } catch {
    console.log(`\n[8] ✅ public."User" does NOT exist — no ghost table`);
  }

  // 9. All tables in auth schema
  const authTables = await p.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'auth' ORDER BY table_name`
  );
  console.log("\n[9] All tables in auth schema:", authTables.map(t => t.table_name));

  // 10. Migration history
  try {
    const migrations = await p.$queryRawUnsafe<{ migration_name: string; finished_at: Date | null }[]>(
      `SELECT migration_name, finished_at FROM auth."_prisma_migrations" ORDER BY finished_at DESC LIMIT 10`
    );
    console.log("\n[10] Recent migrations:", JSON.stringify(migrations, null, 2));
  } catch (e: any) {
    console.log("\n[10] Migration table error:", e.message);
  }

  // 11. Check Prisma Studio connection hint
  console.log("\n[11] Prisma Studio datasource:");
  console.log("     It reads from schema.prisma → datasource db → DATABASE_URL env var");
  console.log("     Run: pnpm db:studio (from services/auth-service)");
  console.log("     NOT from root — root .env had no ?schema=auth before our fix");

  console.log("\n" + "=".repeat(70));
}

main()
  .catch((e) => { console.error("[SCHEMA-AUDIT] FATAL:", e); process.exit(1); })
  .finally(() => p.$disconnect());
