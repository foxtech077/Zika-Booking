process.env.DATABASE_URL = "postgresql://zika_user:aakopass123@localhost:5434/zika_booking?schema=listing";
const { PrismaClient } = require('./services/listing-service/src/generated');
const p = new PrismaClient();
p.$queryRawUnsafe("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'User' OR table_name = 'users'")
  .then(res => {
    console.log('USER TABLES:', res);
    process.exit(0);
  })
  .catch(err => {
    console.error('ERROR:', err);
    process.exit(1);
  });
