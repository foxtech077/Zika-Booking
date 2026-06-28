import { prisma } from "./prisma.js";
import { GoogleAuth } from "google-auth-library";

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationType =
  | "booking_confirmed"
  | "reservation_timer"
  | "new_message"
  | "voucher_assigned"
  | "voucher_expiry"
  | "tier_upgrade"
  | "payout_sent"
  | "listing_approved"
  | "listing_rejected"
  | "listing_auto_suspended"
  | "commission_update"
  | "sales_escalation"
  | "messaging_suspended";

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// ── FCM HTTP v1 ───────────────────────────────────────────────────────────────

const FCM_PROJECT_ID        = process.env["FCM_PROJECT_ID"]           ?? "";
const FCM_SERVICE_ACCOUNT   = process.env["FCM_SERVICE_ACCOUNT_JSON"] ?? "";
const FCM_SCOPES            = ["https://www.googleapis.com/auth/firebase.messaging"];

// Cached token — GoogleAuth refreshes automatically when it expires
let _googleAuth: GoogleAuth | null = null;

function getGoogleAuth(): GoogleAuth {
  if (!_googleAuth) {
    const credentials = JSON.parse(FCM_SERVICE_ACCOUNT) as object;
    _googleAuth = new GoogleAuth({ credentials, scopes: FCM_SCOPES });
  }
  return _googleAuth;
}

async function getFCMAccessToken(): Promise<string> {
  const auth   = getGoogleAuth();
  const client = await auth.getClient();
  const res    = await (client as any).getAccessToken() as { token?: string };
  if (!res.token) throw new Error("Failed to obtain FCM OAuth2 access token");
  return res.token;
}

async function dispatchFCM(token: string, payload: NotificationPayload): Promise<void> {
  if (!FCM_PROJECT_ID || !FCM_SERVICE_ACCOUNT) return;

  const accessToken = await getFCMAccessToken();

  await fetch(
    `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: payload.title, body: payload.body },
          data: payload.data
            ? Object.fromEntries(
                Object.entries(payload.data).map(([k, v]) => [k, String(v)])
              )
            : {},
        },
      }),
      signal: AbortSignal.timeout(8000),
    }
  );
}

// ── Web Push (VAPID) ──────────────────────────────────────────────────────────

const VAPID_PUBLIC  = process.env["VAPID_PUBLIC_KEY"]  ?? "";
const VAPID_PRIVATE = process.env["VAPID_PRIVATE_KEY"] ?? "";
const VAPID_SUBJECT = process.env["VAPID_SUBJECT"]     ?? "mailto:noreply@kainook.com";

async function dispatchWebPush(
  subscriptionJson: string,
  payload: NotificationPayload
): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  // Dynamic import keeps web-push optional at startup
  // @ts-ignore - module may not have type definitions at compile time
  const webpush = await import("web-push");
  webpush.default.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const subscription = JSON.parse(subscriptionJson) as PushSubscription;
  await webpush.default.sendNotification(
    subscription as any,
    JSON.stringify({ title: payload.title, body: payload.body, data: payload.data ?? {} })
  );
}

// ── Core dispatcher ───────────────────────────────────────────────────────────

async function dispatchPush(
  platform: string,
  token: string,
  payload: NotificationPayload
): Promise<void> {
  if (platform === "fcm" || platform === "apns") {
    await dispatchFCM(token, payload);
  } else if (platform === "web") {
    await dispatchWebPush(token, payload);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Save a notification to the DB and push it to all registered device tokens.
 * Fire-and-forget — never throws; push failures are logged, not propagated.
 */
export async function sendNotification(
  userId: string,
  payload: NotificationPayload
): Promise<void> {
  // 1. Persist in-app notification
  await (prisma as any).notification.create({
    data: {
      userId,
      type:  payload.type,
      title: payload.title,
      body:  payload.body,
      data:  payload.data ?? {},
    },
  });

  // 2. Push to all registered devices (fire-and-forget)
  const tokens: { token: string; platform: string }[] = await (prisma as any).deviceToken.findMany({
    where: { userId },
    select: { token: true, platform: true },
  });

  for (const dt of tokens) {
    dispatchPush(dt.platform, dt.token, payload).catch((err) => {
      console.error(`[push] Failed to dispatch to ${dt.platform}:`, err?.message ?? err);
    });
  }
}

/**
 * Convenience wrapper — fire-and-forget, swallows DB errors too.
 * Use inside routes where a notification failure must never break the response.
 */
export function fireNotification(userId: string, payload: NotificationPayload): void {
  sendNotification(userId, payload).catch((err) => {
    console.error("[notification] Failed to send:", err?.message ?? err);
  });
}
