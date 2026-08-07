import { prisma } from "./prisma.js";

const WARNING_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function checkVoucherExpiryWarnings() {
   console.log("[Voucher Expiry Warner] Scanning database for vouchers expiring within 24 hours...");
  try {
    const now = new Date();
    const warningThreshold = new Date(now.getTime() + WARNING_WINDOW_MS);

    // 1. Fetch active vouchers expiring soon
    const expiringVouchersFromDb = await prisma.voucher.findMany({
      where: {
        isActive: true,
        status: "active",
        validUntil: {
          gt: now,
          lte: warningThreshold,
        },
      },
    });

    // Filter usage limits in memory (since Prisma doesn't support comparing usageCount < usageLimit directly in standard query filters)
    const expiringVouchers = expiringVouchersFromDb.filter(
      (v) => v.usageLimit === null || v.usageCount < v.usageLimit
    );
    
    console.log(`[Voucher Expiry Warner] Found ${expiringVouchers.length} valid expiring vouchers.`);
    if (expiringVouchers.length === 0) return;

    for (const voucher of expiringVouchers) {
      // 2. Query target guests who haven't redeemed this voucher yet
      // Since vouchers are either universal or tier-locked:
      const isUniversal = voucher.applicableTiers.length === 0;

      let targetUsers: Array<{ id: string }> = [];

      if (isUniversal) {
        // Fetch all active users
        targetUsers = await prisma.$queryRawUnsafe(
          `SELECT id FROM auth."User" WHERE status = 'active'`
        );
      } else {
        // Fetch active users matching the applicable tiers
        targetUsers = await prisma.$queryRawUnsafe(
          `SELECT id FROM auth."User" WHERE status = 'active' AND "currentTier"::text = ANY($1)`,
          voucher.applicableTiers
        );
      }

      console.log(`[Voucher Expiry Warner] Found ${targetUsers.length} potential target users for voucher "${voucher.code}"`);

      for (const user of targetUsers) {
        // 3. Check if user already redeemed this voucher
        const alreadyRedeemed = await prisma.voucherRedemption.findFirst({
          where: {
            voucherId: voucher.id,
            guestId: user.id,
          },
        });

        if (alreadyRedeemed) continue;

        // 4. Deduplicate: Ensure we haven't already sent an expiry warning for this voucher
        const alreadyNotified = await prisma.$queryRawUnsafe(
          `SELECT id FROM auth."Notification" 
           WHERE "userId" = $1 
             AND type = 'voucher_expiry_warning' 
             AND (data->>'voucherId') = $2 
           LIMIT 1`,
          user.id,
          voucher.id
        ) as any[];

        if (alreadyNotified.length > 0) continue;

        // 5. Send/Insert push notification into auth."Notification"
        const title = `Voucher Expiring Soon! ⏰`;
        const body = `Your voucher "${voucher.code}" offering ${voucher.discountValue} off is expiring soon. Use it before it's gone!`;
        const metadata = JSON.stringify({
          voucherId: voucher.id,
          code: voucher.code,
          discountType: voucher.discountType,
          discountValue: voucher.discountValue,
        });

        await prisma.$executeRawUnsafe(
          `INSERT INTO auth."Notification" (id, "userId", type, title, body, data, "createdAt")
           VALUES (gen_random_uuid()::text, $1, 'voucher_expiry_warning', $2, $3, $4::jsonb, NOW())`,
          user.id,
          title,
          body,
          metadata
        );
        console.log(`[Voucher Expiry Warner] Sent warning notification to user ${user.id} for voucher ${voucher.code}`);
      }
    }
  } catch (error) {
    console.error("[Voucher Expiry Warner] Error:", error);
  }
}
