// create_guest_user.js – temporary script to create a guest user for testing

const { PrismaClient } = require('../services/auth-service/src/generated'); // Prisma client
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'tempguest@example.com';
  const plainPassword = 'TempPass123!';
  const passwordHash = await bcrypt.hash(plainPassword, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    create: {
      email,
      passwordHash,
      firstName: 'Temp',
      lastName: 'Guest',
      userType: 'guest',
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log('✅ Guest user created/updated:', user.id);
}

main()
  .catch((e) => {
    console.error('❌ Error creating guest user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
