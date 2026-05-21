import { prisma } from "./lib/prisma";
import { hashPassword } from "./lib/password";

async function seedUser(email: string, userType: "guest" | "provider", firstName: string, lastName: string) {
  const password = "ZikaTest123!";
  const passwordHash = await hashPassword(password);

  console.log(`Seeding ${userType} user: ${email}...`);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      status: "active",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    create: {
      email,
      passwordHash,
      firstName,
      lastName,
      userType,
      status: "active",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`Successfully seeded ${userType} user:`, {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    userType: user.userType,
    emailVerified: user.emailVerified,
  });
}

async function main() {
  // Legacy / Default
  await seedUser("test@zika.com", "guest", "Test", "User");
  
  // Explicit guest
  await seedUser("guest@zika.com", "guest", "Jane", "Guest");

  // Explicit provider
  await seedUser("provider@zika.com", "provider", "John", "Provider");
}

main()
  .catch((e) => {
    console.error("Error seeding users:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
