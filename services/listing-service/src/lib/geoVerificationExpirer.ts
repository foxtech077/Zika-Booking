import { prisma } from "./prisma.js";
import { fireNotification } from "./notifications.js";

export async function expireStaleGeoVerifications(): Promise<void> {
  const now = new Date();

  try {
    const stale = await prisma.$queryRaw<
      Array<{ id: string; providerId: string; name: string | null }>
    >`
      SELECT id, provider_id AS "providerId", name
      FROM listing.listings
      WHERE category = 'apartment'
        AND temporary_activation = true
        AND geo_verification_due_at <= ${now}
        AND status = 'active'
        AND location IS NULL
    `;

    if (stale.length === 0) return;

    console.log(
      `[GeoVerificationExpirer] Expiring ${stale.length} listing(s) with stale geolocation.`,
    );

    const listingIds = stale.map((l) => l.id);

    await prisma.$transaction(async (tx) => {
      await tx.listing.updateMany({
        where: { id: { in: listingIds } },
        data: {
          status: "auto_suspended",
          suspendedAt: now,
          suspendedBy: "system",
          suspensionReason:
            "Geolocation not verified within 180-day temporary activation period.",
        },
      });

      await tx.listingModerationLog.createMany({
        data: stale.map((l) => ({
          listingId: l.id,
          action: "auto_suspended",
          actorId: "system",
          actorRole: "system",
          metadata: {
            reason:
              "Geolocation not verified within 180-day temporary activation period.",
            previousStatus: "active",
            geoExpiredAt: now.toISOString(),
          },
        })),
      });
    });

    for (const listing of stale) {
      fireNotification(listing.providerId, {
        type: "listing_auto_suspended",
        title: "Listing Suspended – Geolocation Not Verified",
        body: `Your listing "${listing.name ?? listing.id}" has been suspended because the geolocation was not verified within the 180-day temporary activation period. Please update your address/location and contact support to reactivate.`,
        data: { listingId: listing.id },
      });
    }
  } catch (err: any) {
    console.error(
      "[GeoVerificationExpirer] Error running expiry job:",
      err.message,
    );
    throw err;
  }
}
