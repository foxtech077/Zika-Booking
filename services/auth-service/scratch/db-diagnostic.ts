import "dotenv/config";
import { PrismaClient } from "../src/generated/index.js";
import bcrypt from "bcryptjs";

const p = new PrismaClient();

// ── Known working credentials ─────────────────────────────────────────────────
const KNOWN_GOOD_PASSWORD = "ZikaTest123!";

// ── Helper: check if a bcrypt hash is structurally valid ─────────────────────
function isValidBcryptHash(hash: string | null): boolean {
  if (!hash) return false;
  return /^\$2[ab]?\$\d{2}\$/.test(hash);
}

async function main() {
  console.log("=".repeat(70));
  console.log("[COMPARE] DATABASE_URL:", process.env["DATABASE_URL"]);
  console.log("=".repeat(70));

  // Fetch ALL users with every relevant field
  const users = await p.$queryRawUnsafe<{
    id: string;
    email: string;
    email_length: number;
    email_trimmed: string;
    status: string;
    "userType": string;
    "emailVerified": boolean;
    "emailVerifiedAt": Date | null;
    "passwordHash": string | null;
    "oauthProvider": string | null;
    "oauthSub": string | null;
    "oauthRevoked": boolean;
    "createdAt": Date;
  }[]>(`
    SELECT
      id,
      email,
      length(email)                          AS email_length,
      trim(email)                            AS email_trimmed,
      status::text,
      "userType"::text,
      "emailVerified",
      "emailVerifiedAt",
      "passwordHash",
      "oauthProvider"::text,
      "oauthSub",
      "oauthRevoked",
      "createdAt"
    FROM auth."User"
    ORDER BY "createdAt"
  `);

  console.log(`\n[COMPARE] Found ${users.length} users total\n`);
  console.log(
    "Email".padEnd(38),
    "Status".padEnd(22),
    "Verified".padEnd(10),
    "hasHash".padEnd(9),
    "HashOK".padEnd(8),
    "OAuth".padEnd(10),
    "EmailLen"
  );
  console.log("-".repeat(110));

  const results: {
    email: string;
    issues: string[];
    data: Record<string, unknown>;
  }[] = [];

  for (const u of users) {
    const issues: string[] = [];

    // 1. Email hidden chars / whitespace
    const rawEmail = u.email;
    const trimmedEmail = rawEmail.trim().toLowerCase();
    if (rawEmail !== trimmedEmail) {
      issues.push(`EMAIL_DIRTY: raw="${rawEmail}" vs trimmed="${trimmedEmail}"`);
    }

    // 2. passwordHash checks
    const hasHash = u["passwordHash"] !== null;
    const hashStructureOk = isValidBcryptHash(u["passwordHash"]);
    if (!hasHash) issues.push("NO_PASSWORD_HASH (OAuth-only account)");
    else if (!hashStructureOk) issues.push("CORRUPTED_HASH (invalid bcrypt format)");

    // 3. bcrypt verify test (only if hash looks valid)
    let bcryptOk: boolean | string = "N/A";
    if (hasHash && hashStructureOk) {
      try {
        bcryptOk = await bcrypt.compare(KNOWN_GOOD_PASSWORD, u["passwordHash"]!);
      } catch (e: any) {
        bcryptOk = `ERROR: ${e.message}`;
        issues.push(`BCRYPT_ERROR: ${e.message}`);
      }
    }

    // 4. Status checks
    if (u.status === "pending_verification") issues.push("STATUS=pending_verification → login blocked after password check");
    if (u.status === "suspended") issues.push("STATUS=suspended → login blocked");
    if (u.status === "banned") issues.push("STATUS=banned → login blocked");

    // 5. OAuth provider set but no hash
    if (u["oauthProvider"] && !hasHash) issues.push(`OAUTH_USER: provider=${u["oauthProvider"]} has no passwordHash`);

    // 6. emailVerified
    if (!u["emailVerified"]) issues.push("emailVerified=false");

    // Print summary row
    const emailDisplay = rawEmail.substring(0, 37);
    const hashOkDisplay = hasHash ? (hashStructureOk ? String(bcryptOk) : "BAD_FMT") : "null";
    console.log(
      emailDisplay.padEnd(38),
      u.status.padEnd(22),
      String(u["emailVerified"]).padEnd(10),
      String(hasHash).padEnd(9),
      hashOkDisplay.padEnd(8),
      (u["oauthProvider"] ?? "none").padEnd(10),
      String(u.email_length)
    );

    results.push({
      email: rawEmail,
      issues,
      data: {
        id: u.id,
        status: u.status,
        userType: u["userType"],
        emailVerified: u["emailVerified"],
        emailVerifiedAt: u["emailVerifiedAt"],
        passwordHashPresent: hasHash,
        passwordHashStructureOk: hashStructureOk,
        passwordHashValue: u["passwordHash"]
          ? u["passwordHash"].substring(0, 30) + "..."
          : null,
        oauthProvider: u["oauthProvider"],
        oauthSub: u["oauthSub"] ? u["oauthSub"].substring(0, 15) + "..." : null,
        oauthRevoked: u["oauthRevoked"],
        emailRaw: rawEmail,
        emailLength: u.email_length,
        emailHasWhitespace: rawEmail !== rawEmail.trim(),
        createdAt: u["createdAt"],
      },
    });
  }

  // ── Detailed report for each user with issues ──────────────────────────────
  console.log("\n" + "=".repeat(70));
  console.log("[DETAIL] Per-user diagnosis:");
  console.log("=".repeat(70));

  for (const r of results) {
    const isWorking = ["test@zika.com", "guest@zika.com", "provider@zika.com"].includes(r.email);
    const label = isWorking ? "✅ WORKING" : r.issues.length === 0 ? "✅ NO ISSUES" : "❌ HAS ISSUES";
    console.log(`\n${label} — ${r.email}`);
    console.log(JSON.stringify(r.data, null, 2));
    if (r.issues.length > 0) {
      console.log("  ISSUES:");
      r.issues.forEach((i) => console.log("   →", i));
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("[COMPARE] SQL to inspect all users side-by-side:");
  console.log(`
SELECT
  id,
  email,
  length(email) AS email_len,
  status,
  "userType",
  "emailVerified",
  "passwordHash" IS NOT NULL AS has_pw,
  left("passwordHash", 7) AS hash_prefix,
  "oauthProvider",
  "createdAt"
FROM auth."User"
ORDER BY "createdAt";
  `);
}

main()
  .catch((e) => {
    console.error("[COMPARE] FATAL:", e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
