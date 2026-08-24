import { sendNotification } from "./notifications.js";
import { getRedis } from "./redis.js";

export async function sendReservationTimerWarning(
  lockToken: string,
): Promise<void> {
  const ctxKey = `rlk:ctx:${lockToken}`;
  const activeLock = await getRedis().get(ctxKey);
  if (!activeLock) return;

  const context = JSON.parse(activeLock) as { guestId?: string };
  if (!context.guestId) return;

  await sendNotification(context.guestId, {
    type: "reservation_timer",
    title: "Reservation Expiring Soon!",
    body: "Your booking reservation lock will expire in 1 minute. Complete checkout now to secure your dates!",
    data: { lockToken },
  });
}
