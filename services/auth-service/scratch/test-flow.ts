import { PrismaClient } from "../src/generated/index.js";
import { signAdminSessionToken } from "../src/lib/jwt.js";
import { hashToken } from "../src/lib/crypto.js";

const prisma = new PrismaClient();

async function run() {
  console.log("=== STARTING INTEGRATION TEST FLOW ===");

  const email = `provider_test_${Date.now()}@example.com`;
  const password = "Password123!";
  const firstName = "John";
  const lastName = "Doe";
  const userType = "provider";
  const businessName = "John's Rentals";
  const country = "US";

  // 1. Register a provider
  console.log("\n--- Step 1: Registering a new provider ---");
  const regRes = await fetch("http://localhost:3001/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      confirmPassword: password,
      firstName,
      lastName,
      userType,
      businessName,
      country
    })
  });

  const regData = await regRes.json();
  console.log("Register Response Status:", regRes.status);
  console.log("Register Response Body:", JSON.stringify(regData, null, 2));

  if (regRes.status !== 201) {
    throw new Error("Registration failed");
  }

  // Check initial DB state
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  console.log("User in DB:", { id: user.id, status: user.status, emailVerified: user.emailVerified });
  if (user.status !== "pending_verification" || user.emailVerified !== false) {
    throw new Error("Initial user state in DB is incorrect");
  }

  // 2. Insert custom verification token
  console.log("\n--- Step 2: Creating custom verification token ---");
  const plainToken = Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join(""); // 64 random hex chars
  const tokenHash = hashToken(plainToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      tokenType: "email_verification",
      expiresAt,
    }
  });
  console.log("Verification token inserted successfully.");

  // 3. Verify the email
  console.log("\n--- Step 3: Calling GET /auth/verify ---");
  const verifyRes = await fetch(`http://localhost:3001/auth/verify?token=${plainToken}`);
  const verifyData = await verifyRes.json();
  console.log("Verify Response Status:", verifyRes.status);
  console.log("Verify Response Body:", JSON.stringify(verifyData, null, 2));

  if (verifyRes.status !== 200) {
    throw new Error("Verification failed");
  }

  if (verifyData.data.tokens !== undefined) {
    throw new Error("Tokens should NOT be returned for providers upon email verification");
  }

  // Check updated DB state
  const verifiedUser = await prisma.user.findUniqueOrThrow({ where: { email } });
  console.log("User in DB after verification:", { status: verifiedUser.status, emailVerified: verifiedUser.emailVerified });
  if (verifiedUser.status !== "pending_verification" || verifiedUser.emailVerified !== true) {
    throw new Error("User status should remain pending_verification and emailVerified should be true");
  }

  // 4. Try logging in as the provider (should be blocked)
  console.log("\n--- Step 4: Trying to log in as unapproved provider ---");
  const loginRes = await fetch("http://localhost:3001/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const loginData = await loginRes.json();
  console.log("Login Response Status:", loginRes.status);
  console.log("Login Response Body:", JSON.stringify(loginData, null, 2));

  if (loginRes.status !== 403 || loginData.error.code !== "PENDING_ADMIN_APPROVAL") {
    throw new Error("Login was not correctly blocked with PENDING_ADMIN_APPROVAL error");
  }

  // 5. Test resend-verification (should not send or create new token since verified)
  console.log("\n--- Step 5: Testing POST /auth/resend-verification ---");
  const beforeTokensCount = await prisma.verificationToken.count({ where: { userId: user.id } });
  const resendRes = await fetch("http://localhost:3001/auth/resend-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  const resendData = await resendRes.json();
  const afterTokensCount = await prisma.verificationToken.count({ where: { userId: user.id } });

  console.log("Resend Response Status:", resendRes.status);
  console.log("Resend Response Body:", JSON.stringify(resendData, null, 2));

  if (resendRes.status !== 200) {
    throw new Error("Resend-verification call failed");
  }
  if (beforeTokensCount !== afterTokensCount) {
    throw new Error("A verification token was unexpectedly created for an already verified provider");
  }

  // 6. Setup Admin session
  console.log("\n--- Step 6: Setting up mock Admin Session ---");
  const admin = await prisma.adminUser.findUniqueOrThrow({ where: { email: "devadmin@zika.com" } });
  const adminSessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  const tempSession = await prisma.adminSession.create({
    data: {
      adminUserId: admin.id,
      tokenHash: "pending",
      expiresAt: adminSessionExpires,
    },
  });

  const adminToken = await signAdminSessionToken({ sub: admin.id, role: admin.role, sessionId: tempSession.id });
  const adminTokenHash = hashToken(adminToken);
  await prisma.adminSession.update({
    where: { id: tempSession.id },
    data: { tokenHash: adminTokenHash },
  });
  console.log("Admin session token generated:", adminToken.slice(0, 20) + "...");

  // 7. Approve the provider
  console.log("\n--- Step 7: Calling PATCH /admin/users/:id/approve ---");
  const approveRes = await fetch(`http://localhost:3001/admin/users/${user.id}/approve`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${adminToken}`
    }
  });

  const approveData = await approveRes.json();
  console.log("Approve Response Status:", approveRes.status);
  console.log("Approve Response Body:", JSON.stringify(approveData, null, 2));

  if (approveRes.status !== 200) {
    throw new Error("Approve API call failed");
  }

  // Check approved DB state
  const approvedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  console.log("User in DB after approval:", { status: approvedUser.status });
  if (approvedUser.status !== "active") {
    throw new Error("User status should be active after approval");
  }

  // Verify audit log
  const audit = await prisma.auditLog.findFirst({
    where: { targetId: user.id, action: "account_approved" }
  });
  console.log("Audit Log Entry:", audit ? { action: audit.action, oldValue: audit.oldValue, newValue: audit.newValue } : null);
  if (!audit) {
    throw new Error("Audit log entry for account_approved was not created");
  }

  // 8. Try logging in again (should succeed)
  console.log("\n--- Step 8: Logging in again as approved provider ---");
  const finalLoginRes = await fetch("http://localhost:3001/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const finalLoginData = await finalLoginRes.json();
  console.log("Final Login Response Status:", finalLoginRes.status);
  console.log("Tokens returned:", finalLoginData.data?.tokens ? "YES" : "NO");

  if (finalLoginRes.status !== 200 || !finalLoginData.data.tokens) {
    throw new Error("Final login failed after approval");
  }

  // 9. Test POST /auth/account-type transition (guest -> provider)
  console.log("\n--- Step 9: Testing account-type change (guest -> provider) ---");
  const guestEmail = `guest_test_${Date.now()}@example.com`;
  
  // Register guest
  await fetch("http://localhost:3001/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: guestEmail,
      password,
      confirmPassword: password,
      firstName: "Jane",
      lastName: "Doe",
      userType: "guest"
    })
  });

  const guest = await prisma.user.findUniqueOrThrow({ where: { email: guestEmail } });
  
  // Custom verify guest
  const guestToken = Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join("");
  await prisma.verificationToken.create({
    data: {
      userId: guest.id,
      tokenHash: hashToken(guestToken),
      tokenType: "email_verification",
      expiresAt,
    }
  });
  const guestVerifyRes = await fetch(`http://localhost:3001/auth/verify?token=${guestToken}`);
  const guestVerifyData = await guestVerifyRes.json();
  console.log("Guest verify status:", guestVerifyRes.status, "| message:", guestVerifyData.data?.message ?? guestVerifyData.error?.message);
  if (guestVerifyRes.status !== 200) {
    throw new Error("Guest verification failed: " + JSON.stringify(guestVerifyData));
  }

  // Login guest
  const guestLoginRes = await fetch("http://localhost:3001/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: guestEmail, password })
  });
  const guestLoginData = await guestLoginRes.json();
  const guestAccessToken = guestLoginData.data.tokens.accessToken;

  // Check state before
  const beforeGuest = await prisma.user.findUniqueOrThrow({ where: { id: guest.id } });
  console.log("Guest before type change:", { userType: beforeGuest.userType, status: beforeGuest.status });

  // Update type to provider
  const accTypeRes = await fetch("http://localhost:3001/auth/account-type", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${guestAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      userType: "provider",
      businessName: "Jane's B&B",
      country: "US"
    })
  });
  const accTypeData = await accTypeRes.json();
  console.log("Account Type Response Status:", accTypeRes.status);
  console.log("Account Type Response Body:", JSON.stringify(accTypeData, null, 2));

  // Check state after
  const afterGuest = await prisma.user.findUniqueOrThrow({ where: { id: guest.id } });
  console.log("Guest after type change:", { userType: afterGuest.userType, status: afterGuest.status });

  if (afterGuest.userType !== "provider" || afterGuest.status !== "pending_verification") {
    throw new Error("Guest was not correctly promoted to provider or status was not reset to pending_verification");
  }

  // Check session revocation
  const activeSessionsCount = await prisma.session.count({
    where: { userId: guest.id, revoked: false }
  });
  console.log("Active sessions remaining for guest user:", activeSessionsCount);
  if (activeSessionsCount !== 0) {
    throw new Error("Guest active sessions were not revoked upon provider transition");
  }

  console.log("\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ===");
}

run()
  .catch((err) => {
    console.error("\n❌ TEST FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
