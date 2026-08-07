import { prisma } from "../services/auth-service/src/lib/prisma";
import { signAdminSessionToken } from "../services/auth-service/src/lib/jwt";

async function main() {
  const admin = await prisma.adminUser.findUnique({
    where: { email: "devadmin@zika.com" },
  });
  if (!admin) {
    console.error("Admin not found");
    process.exit(1);
  }
  const token = await signAdminSessionToken({
    sub: admin.id,
    role: admin.role,
    sessionId: "dev-session",
    countryScope: admin.countryScope ?? [],
  });
  console.log(token);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
