/**
 * End-to-end test: Activity Promotions delete fix
 *
 * Tests that after deleting the latest promotion, previously-superseded
 * promotions are NOT returned by GET /admin/promotions (default), but ARE
 * returned when ?status=superseded is used.
 *
 * Run with:  node test-promotions-delete-fix.mjs
 */

import { createHmac } from "node:crypto";

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = "http://127.0.0.1:3003/listings";

// ADMIN_JWT_SECRET from .env (HS256, same secret listing-service uses)
const ADMIN_JWT_SECRET =
  "8fa61f0d3a3d4a49f95ca91c76f311ed4758e259207fdea7d5f4bafcfe9c92ed863677d5fd29673badf2237e1ceae6e5e55219f0e3b48eeae45285ef8f2c44ed";

// ── Minimal HS256 JWT mint (no dependency on jose) ────────────────────────────
function b64url(str) {
  return Buffer.from(str).toString("base64url");
}

function mintAdminJwt() {
  const header  = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now     = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({
    sub:          "test-admin-script",
    role:         "super_admin",
    sessionId:    "test-session",
    countryScope: [],
    iat:          now,
    exp:          now + 3600,   // 1-hour validity
  }));
  const sig = createHmac("sha256", Buffer.from(ADMIN_JWT_SECRET, "utf8"))
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TOKEN = mintAdminJwt();
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
};

async function api(method, path, body) {
  const opts = { method, headers: { ...HEADERS } };
  // For DELETE, the server rejects a JSON content-type with empty body.
  if (method !== "DELETE" && body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

function pass(msg)  { console.log(`  ✅  ${msg}`); }
function fail(msg)  { console.error(`  ❌  ${msg}`); process.exitCode = 1; }
function info(msg)  { console.log(`  ℹ️   ${msg}`); }
function section(t) { console.log(`\n${"─".repeat(60)}\n${t}\n${"─".repeat(60)}`); }

// ── Test runner ───────────────────────────────────────────────────────────────
async function run() {
  console.log("\n🔬  Activity Promotions Delete Fix — End-to-End Test");
  console.log(`    Target: ${BASE_URL}\n`);

  // ── STEP 0: Clean up any leftover test promotions ──────────────────────────
  section("STEP 0 — Cleanup: remove pre-existing test promotions");
  {
    const list = await api("GET", "/admin/promotions?status=active&activity=car&limit=100");
    const all  = [
      ...(list.body?.data?.promotions ?? []),
    ];

    // Also fetch superseded ones to clean up
    const sup = await api("GET", "/admin/promotions?status=superseded&activity=car&limit=100");
    const supList = sup.body?.data?.promotions ?? [];

    const toDelete = [...all, ...supList].filter(
      (p) => p.labelText?.startsWith("TEST") || p.bannerTitle?.startsWith("[TEST]")
    );

    if (toDelete.length === 0) {
      info("No leftover test promotions found.");
    } else {
      for (const p of toDelete) {
        const r = await api("DELETE", `/admin/promotions/${p.id}`);
        info(`Deleted leftover promotion ${p.id} (status: ${p.status}) → HTTP ${r.status}`);
      }
    }
  }

  // ── STEP 1: Create Promotion A ─────────────────────────────────────────────
  section("STEP 1 — Create Promotion A (hotel, active)");
  let promoA;
  {
    const validFrom  = new Date(Date.now() - 60_000).toISOString();
    const validUntil = new Date(Date.now() + 7 * 86_400_000).toISOString();

    const r = await api("POST", "/admin/promotions", {
      activity:       "hotel",
      labelText:      "TESTA",
      labelColour:    "#FF5733",
      discountType:   "label_only",
      validFrom,
      validUntil,
      bannerTitle:    "[TEST] Promotion A",
      bannerSubtitle: "Test promo A — should be superseded",
      status:         "active",
    });

    console.log("  POST /admin/promotions (Promotion A)");
    console.log(`  HTTP ${r.status}`);
    console.log("  Response:", JSON.stringify(r.body, null, 4));

    if (r.status === 201 && r.body?.data?.id) {
      promoA = r.body.data;
      pass(`Promotion A created: id=${promoA.id}, status=${promoA.status}`);
    } else {
      fail(`Failed to create Promotion A — HTTP ${r.status}`);
      console.log("  Full response:", JSON.stringify(r.body, null, 4));
      return;
    }
  }

  // ── STEP 2: Create Promotion B (supersedes A) ──────────────────────────────
  section("STEP 2 — Create Promotion B for same activity → A becomes 'superseded'");
  let promoB;
  {
    const validFrom  = new Date(Date.now() - 60_000).toISOString();
    const validUntil = new Date(Date.now() + 7 * 86_400_000).toISOString();

    const r = await api("POST", "/admin/promotions", {
      activity:       "hotel",
      labelText:      "TESTB",
      labelColour:    "#33FF57",
      discountType:   "label_only",
      validFrom,
      validUntil,
      bannerTitle:    "[TEST] Promotion B",
      bannerSubtitle: "Test promo B — the current active one",
      status:         "active",
    });

    console.log("  POST /admin/promotions (Promotion B)");
    console.log(`  HTTP ${r.status}`);
    console.log("  Response:", JSON.stringify(r.body, null, 4));

    if (r.status === 201 && r.body?.data?.id) {
      promoB = r.body.data;
      pass(`Promotion B created: id=${promoB.id}, status=${promoB.status}`);
    } else {
      fail(`Failed to create Promotion B — HTTP ${r.status}`);
      return;
    }
  }

  // ── STEP 3: Verify Promotion A is now 'superseded' in DB ──────────────────
  section("STEP 3 — Verify Promotion A is 'superseded' in the database");
  {
    const r = await api("GET", `/admin/promotions?status=superseded&activity=hotel&limit=100`);
    console.log("  GET /admin/promotions?status=superseded&activity=hotel");
    console.log(`  HTTP ${r.status}`);

    const superseded = (r.body?.data?.promotions ?? []);
    const foundA = superseded.find((p) => p.id === promoA.id);

    if (foundA) {
      pass(`Promotion A (${promoA.id}) found with status='superseded'`);
      console.log("  Promotion A:", JSON.stringify(foundA, null, 4));
    } else {
      fail(`Promotion A not found in superseded list`);
      console.log("  All superseded:", JSON.stringify(superseded, null, 4));
    }
  }

  // ── STEP 4: Delete Promotion B ─────────────────────────────────────────────
  section(`STEP 4 — Delete Promotion B (id=${promoB.id})`);
  {
    const r = await api("DELETE", `/admin/promotions/${promoB.id}`);
    console.log(`  DELETE /admin/promotions/${promoB.id}`);
    console.log(`  HTTP ${r.status}`);
    console.log("  Response:", JSON.stringify(r.body, null, 4));

    if (r.status === 200 && r.body?.success) {
      pass(`Promotion B deleted successfully (HTTP 200, success=true)`);
    } else {
      fail(`DELETE failed — HTTP ${r.status}`);
      return;
    }
  }

  // ── STEP 5: GET /admin/promotions (no filter) → A must NOT appear ─────────
  section("STEP 5 — GET /admin/promotions (no status filter) → A must NOT be in list");
  {
    const r = await api("GET", "/admin/promotions?activity=hotel&limit=100");
    console.log("  GET /admin/promotions?activity=hotel");
    console.log(`  HTTP ${r.status}`);

    const promotions = r.body?.data?.promotions ?? [];
    console.log(`  Total returned: ${promotions.length}`);
    console.log("  Statuses returned:", [...new Set(promotions.map((p) => p.status))]);

    const foundA = promotions.find((p) => p.id === promoA.id);
    const foundB = promotions.find((p) => p.id === promoB.id);

    if (!foundA) {
      pass(`Promotion A (superseded) is NOT returned — fix is working ✔`);
    } else {
      fail(`BUG: Promotion A (superseded) appeared in default list — fix is NOT working`);
      console.log("  Promotion A in list:", JSON.stringify(foundA, null, 4));
    }

    if (!foundB) {
      pass(`Promotion B (deleted) is correctly absent from the list`);
    } else {
      fail(`Promotion B reappeared — something is very wrong`);
    }

    const hasSuperseeded = promotions.some((p) => p.status === "superseded");
    if (!hasSuperseeded) {
      pass(`No 'superseded' promotions appear in the default list`);
    } else {
      fail(`'superseded' promotions still appear in the default list`);
      console.log("  Full list:", JSON.stringify(promotions, null, 4));
    }

    console.log("  Full response:", JSON.stringify(r.body, null, 4));
  }

  // ── STEP 6: GET ?status=superseded → A MUST appear ────────────────────────
  section("STEP 6 — GET /admin/promotions?status=superseded → A MUST appear");
  {
    const r = await api("GET", "/admin/promotions?status=superseded&activity=hotel&limit=100");
    console.log("  GET /admin/promotions?status=superseded&activity=hotel");
    console.log(`  HTTP ${r.status}`);

    const promotions = r.body?.data?.promotions ?? [];
    console.log(`  Total returned: ${promotions.length}`);

    const foundA = promotions.find((p) => p.id === promoA.id);

    if (foundA) {
      pass(`Promotion A IS returned when ?status=superseded is used ✔`);
      console.log("  Promotion A:", JSON.stringify(foundA, null, 4));
    } else {
      fail(`Promotion A missing from ?status=superseded results`);
      console.log("  Full list:", JSON.stringify(promotions, null, 4));
    }

    console.log("  Full response:", JSON.stringify(r.body, null, 4));
  }

  // ── STEP 7: Verify pagination still works ─────────────────────────────────
  section("STEP 7 — Verify pagination still works (page=1&limit=2)");
  {
    const r = await api("GET", "/admin/promotions?page=1&limit=2");
    console.log("  GET /admin/promotions?page=1&limit=2");
    console.log(`  HTTP ${r.status}`);
    console.log("  Response:", JSON.stringify(r.body, null, 4));

    const pagination = r.body?.data?.pagination;
    if (pagination && typeof pagination.total === "number" && pagination.limit === 2 && pagination.page === 1) {
      pass(`Pagination intact: total=${pagination.total}, page=${pagination.page}, limit=${pagination.limit}, totalPages=${pagination.totalPages}`);
    } else {
      fail(`Pagination fields missing or incorrect: ${JSON.stringify(pagination)}`);
    }

    const promos = r.body?.data?.promotions ?? [];
    const hasSuperseded = promos.some((p) => p.status === "superseded");
    if (!hasSuperseded) {
      pass("Paginated results contain no 'superseded' promotions");
    } else {
      fail("Paginated results still include 'superseded' promotions");
    }
  }

  // ── STEP 8: Verify activity filter still works ────────────────────────────
  section("STEP 8 — Verify activity filter still works");
  {
    for (const activity of ["hotel", "apartment", "car"]) {
      const r = await api("GET", `/admin/promotions?activity=${activity}&limit=50`);
      console.log(`  GET /admin/promotions?activity=${activity} → HTTP ${r.status}`);

      const promos = r.body?.data?.promotions ?? [];
      const wrongActivity = promos.filter((p) => p.activity !== activity);
      const hasSuperseeded = promos.some((p) => p.status === "superseded");

      if (wrongActivity.length === 0) {
        pass(`activity=${activity}: all returned rows match the filter (${promos.length} rows)`);
      } else {
        fail(`activity=${activity}: ${wrongActivity.length} rows have wrong activity`);
      }
      if (!hasSuperseeded) {
        pass(`activity=${activity}: no superseded rows returned by default`);
      } else {
        fail(`activity=${activity}: superseded rows still returned`);
      }
    }
  }

  // ── STEP 9: Cleanup test data ──────────────────────────────────────────────
  section("STEP 9 — Cleanup: delete Promotion A (superseded)");
  {
    const r = await api("DELETE", `/admin/promotions/${promoA.id}`);
    if (r.status === 200) {
      pass(`Promotion A deleted (cleanup done)`);
    } else {
      info(`Cleanup: DELETE Promotion A returned HTTP ${r.status} — may need manual removal`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  section("TEST SUMMARY");
  if (process.exitCode === 1) {
    console.error("  ❌  One or more tests FAILED. See output above.");
  } else {
    console.log("  ✅  All tests PASSED. The delete fix is working correctly.");
  }
  console.log();
}

run().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
