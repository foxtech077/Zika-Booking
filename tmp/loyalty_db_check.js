// loyalty_db_check.js – verify loyalty points directly from the database

const { PrismaClient } = require('@prisma/client');
const fetch = global.fetch;
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const TEST_USER = { email: 'tempguest@example.com', password: 'TempPass123!' };
const LISTING_ID = '46de0142-cc42-4815-8d33-f6906b78fad8';
const BOOKING_ID = 'd06837a2-af27-4a20-a94e-ac38b935043a'; // from previous successful flow

const BASE_URL_AUTH = process.env['AUTH_SERVICE_URL'] || 'http://localhost:3001';
const BASE_URL_LISTING = process.env['BOOKING_SERVICE_URL'] || 'http://localhost:3003';

async function login() {
  const res = await fetch(`${BASE_URL_AUTH}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER),
  });
  const data = await res.json();
  if (!data.success) throw new Error('Login failed');
  return data.data.tokens.accessToken;
}

async function getRate(from, to) {
  const r = await fetch(`https://open.er-api.com/v6/latest/${from}`);
  const d = await r.json();
  return d.rates[to];
}

async function convertCurrency(amount, from, to) {
  const rate = await getRate(from, to);
  return amount * rate;
}

function tierMultiplier(tier) {
  const map = { bronze: 1.0, silver: 1.15, gold: 1.25, diamond: 1.40 };
  return map[tier?.toLowerCase()] ?? 1.0;
}

async function fetchBookingFromDb(bookingId) {
  return prisma.booking.findUnique({ where: { id: bookingId } });
}

async function fetchUserFromDb(email) {
  return prisma.user.findUnique({ where: { email } });
}

async function run() {
  const token = await login();

  // ----- First, validate the confirmed booking -----
  const booking = await fetchBookingFromDb(BOOKING_ID);
  const user = await fetchUserFromDb(TEST_USER.email);

  const converted = await convertCurrency(Number(booking.totalAmount), booking.currency, 'USD');
  const basePoints = Math.floor(converted);
  const expectedEarned = Math.floor(basePoints * tierMultiplier(user.currentTier));

  const report = [];
  report.push('# Loyalty Points Validation (DB)');
  report.push('## Confirmed Booking');
  report.push('| Field | Value |');
  report.push('|---|---|');
  report.push(`| Booking ID | ${booking.id} |`);
  report.push(`| Currency | ${booking.currency} |`);
  report.push(`| Total Amount | ${booking.totalAmount} |`);
  report.push(`| Earned Points (DB) | ${booking.earnedPoints} |`);
  report.push(`| User Loyalty Points (DB) | ${user.loyaltyPoints} |`);
  report.push(`| User Tier | ${user.currentTier} |`);
  report.push('| Calculated USD Amount | ${converted.toFixed(2)} |');
  report.push(`| Base Points (floor) | ${basePoints} |`);
  report.push(`| Expected Earned Points | ${expectedEarned} |`);
  report.push(`| PASS? | ${booking.earnedPoints === expectedEarned ? '✅' : '❌'} |`);

  // ----- Cancelled booking scenario -----
  // Initiate & create a new booking, then cancel it via API
  const initRes = await fetch(`${BASE_URL_LISTING}/bookings/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ listingId: LISTING_ID }),
  });
  const initData = await initRes.json();
  const lockToken = initData.data.lockToken;
  const createRes = await fetch(`${BASE_URL_LISTING}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ lockToken, listingId: LISTING_ID, guestFirstName: 'Temp', guestLastName: 'Guest', guestEmail: TEST_USER.email }),
  });
  const createData = await createRes.json();
  const cancelBookingId = createData.data.bookingId;

  // Record user points before cancellation
  const userBeforeCancel = await fetchUserFromDb(TEST_USER.email);
  const pointsBefore = userBeforeCancel.loyaltyPoints;

  const cancelRes = await fetch(`${BASE_URL_LISTING}/bookings/${cancelBookingId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason: 'test cancellation' }),
  });
  const cancelData = await cancelRes.json();

  const cancelledBooking = await fetchBookingFromDb(cancelBookingId);
  const userAfterCancel = await fetchUserFromDb(TEST_USER.email);

  report.push('## Cancelled Booking');
  report.push('| Field | Value |');
  report.push('|---|---|');
  report.push(`| Booking ID | ${cancelledBooking.id} |`);
  report.push(`| Status | ${cancelledBooking.status} |`);
  report.push(`| Earned Points (DB) | ${cancelledBooking.earnedPoints} |`);
  report.push(`| User Loyalty Points Before Cancel | ${pointsBefore} |`);
  report.push(`| User Loyalty Points After Cancel | ${userAfterCancel.loyaltyPoints} |`);
  report.push(`| PASS (no points awarded) | ${cancelledBooking.earnedPoints === 0 && userAfterCancel.loyaltyPoints === pointsBefore ? '✅' : '❌'} |`);

  const reportPath = path.resolve('loyalty_db_report.md');
  fs.writeFileSync(reportPath, report.join('\n'), 'utf8');
  console.log('📄 Report written to', reportPath);
  console.log('--- MARKDOWN REPORT ---');
  console.log(report.join('\n'));
}

run()
  .catch(e => console.error('❌ Unexpected error', e))
  .finally(() => prisma.$disconnect());
