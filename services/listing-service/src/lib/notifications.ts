import { prisma } from "./prisma.js";
import { Prisma } from "../generated/index.js";
import { GoogleAuth } from "google-auth-library";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { listingJobOptions, listingQueue } from "./listingQueue.js";

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
const PUSH_BATCH_SIZE = 500;
const BULK_USER_BATCH_SIZE = 1000;
const MAX_TOKEN_RETRIES = 5;

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

async function dispatchFCM(
  token: string,
  payload: NotificationPayload,
  validateOnly = false,
): Promise<void> {
  if (!FCM_PROJECT_ID || !FCM_SERVICE_ACCOUNT) return;

  const accessToken = await getFCMAccessToken();

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        validate_only: validateOnly,
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

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const error = new Error(`FCM request failed with status ${response.status}`) as Error & {
      status?: number;
      responseBody?: string;
    };
    error.status = response.status;
    error.responseBody = body;
    throw error;
  }
}

export type FcmTokenValidation = "valid" | "invalid" | "skipped";

/**
 * Validate a token without delivering a notification. FCM's validate_only
 * option still returns UNREGISTERED/INVALID_ARGUMENT for dead tokens.
 */
export async function validateFcmToken(token: string): Promise<FcmTokenValidation> {
  if (!FCM_PROJECT_ID || !FCM_SERVICE_ACCOUNT) return "skipped";

  try {
    await dispatchFCM(
      token,
      {
        type: "booking_confirmed",
        title: "Kainook notification health check",
        body: "This is a validation-only notification.",
      },
      true,
    );
    return "valid";
  } catch (error: any) {
    const body = String(error?.responseBody ?? "");
    const isInvalid =
      body.includes("UNREGISTERED") ||
      (error?.status === 400 && body.includes("INVALID_ARGUMENT"));
    if (isInvalid) return "invalid";
    throw error;
  }
}

function getFirebaseAdminMessaging() {
  if (!FCM_PROJECT_ID || !FCM_SERVICE_ACCOUNT) return null;

  const app = getApps().find((candidate) => candidate.name === "kainook-notifications") ??
    initializeApp(
      {
        credential: cert(JSON.parse(FCM_SERVICE_ACCOUNT)),
        projectId: FCM_PROJECT_ID,
      },
      "kainook-notifications",
    );
  return getMessaging(app);
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

export async function enqueueNotificationPush(
  tokenIds: string[],
  payload: NotificationPayload,
  retryCount = 0,
): Promise<void> {
  const jobs: {
    name: string;
    data: { tokenIds: string[]; payload: NotificationPayload; retryCount: number };
    opts: typeof listingJobOptions & { delay?: number };
  }[] = [];
  for (let offset = 0; offset < tokenIds.length; offset += PUSH_BATCH_SIZE) {
    jobs.push({
      name: "notification-push-batch",
      data: {
        tokenIds: tokenIds.slice(offset, offset + PUSH_BATCH_SIZE),
        payload,
        retryCount,
      },
      opts: retryCount > 0
        ? { ...listingJobOptions, attempts: 1, delay: 30_000 * 2 ** (retryCount - 1) }
        : listingJobOptions,
    });
  }
  if (jobs.length > 0) await listingQueue.addBulk(jobs);
}

export async function deliverNotificationPushBatch({
  tokenIds,
  payload,
  retryCount = 0,
}: {
  tokenIds: string[];
  payload: NotificationPayload;
  retryCount?: number;
}): Promise<void> {
  const tokens = await (prisma as any).deviceToken.findMany({
    where: { id: { in: tokenIds } },
    select: { id: true, token: true, platform: true },
  }) as { id: string; token: string; platform: string }[];

  const fcmTokens = tokens.filter((token) => token.platform === "fcm" || token.platform === "apns");
  const messaging = getFirebaseAdminMessaging();

  if (fcmTokens.length > 0 && !messaging) {
    throw new Error("FCM is not configured; notification push job cannot be delivered");
  }

  if (messaging && fcmTokens.length > 0) {
    const response = await messaging.sendEachForMulticast({
      tokens: fcmTokens.map((token) => token.token),
      notification: { title: payload.title, body: payload.body },
      data: payload.data
        ? Object.fromEntries(Object.entries(payload.data).map(([key, value]) => [key, String(value)]))
        : {},
    });

    const invalidIds = fcmTokens
      .filter((_token, index) => {
        const errorCode = response.responses[index]?.error?.code;
        return errorCode === "messaging/registration-token-not-registered" ||
          errorCode === "messaging/invalid-registration-token";
      })
      .map((token) => token.id);

    if (invalidIds.length > 0) {
      await (prisma as any).deviceToken.deleteMany({ where: { id: { in: invalidIds } } });
    }

    const retryableIds = fcmTokens.filter((_token, index) => {
      const result = response.responses[index];
      if (!result) return false;
      const errorCode = result.error?.code;
      return !result.success &&
        errorCode !== "messaging/registration-token-not-registered" &&
        errorCode !== "messaging/invalid-registration-token";
    }).map((token) => token.id);
    if (retryableIds.length > 0 && retryCount < MAX_TOKEN_RETRIES) {
      await enqueueNotificationPush(retryableIds, payload, retryCount + 1);
    } else if (retryableIds.length > 0) {
      console.error(`[push] Giving up on ${retryableIds.length} tokens after ${MAX_TOKEN_RETRIES} retries`);
    }
  }

  const webTokens = tokens.filter((item) => item.platform === "web");
  const webResults = await Promise.allSettled(
    webTokens.map(async (token) => {
      await dispatchWebPush(token.token, payload);
      return token;
    }),
  );
  const retryableWebIds: string[] = [];
  for (const [index, result] of webResults.entries()) {
    if (result.status === "rejected") {
      const error = result.reason as { statusCode?: number };
      const token = webTokens[index];
      if (error.statusCode === 404 || error.statusCode === 410) {
        if (token) await (prisma as any).deviceToken.delete({ where: { id: token.id } });
      } else if (token) {
        retryableWebIds.push(token.id);
      }
    }
  }
  if (retryableWebIds.length > 0 && retryCount < MAX_TOKEN_RETRIES) {
    await enqueueNotificationPush(retryableWebIds, payload, retryCount + 1);
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

  // 2. Queue push delivery so requests never fan out in this process.
  const tokens: { id: string }[] = await (prisma as any).deviceToken.findMany({
    where: { userId },
    select: { id: true },
  });

  await enqueueNotificationPush(tokens.map((token) => token.id), payload);
}

export async function sendBulkNotifications(
  userIds: string[],
  payload: NotificationPayload,
): Promise<void> {
  for (let offset = 0; offset < userIds.length; offset += BULK_USER_BATCH_SIZE) {
    const requestedUserIds = [...new Set(userIds.slice(offset, offset + BULK_USER_BATCH_SIZE))];
    if (requestedUserIds.length === 0) continue;

    // Listings retain provider IDs after an account is deleted. Resolve against
    // auth.User before inserting notifications so one stale ID cannot roll back
    // the whole batch through Notification_userId_fkey.
    const existingUsers = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM auth."User"
      WHERE id IN (${Prisma.join(requestedUserIds)})
    `;
    const existingUserIds = new Set(existingUsers.map((user) => user.id));
    const batchUserIds = requestedUserIds.filter((userId) => existingUserIds.has(userId));
    if (batchUserIds.length === 0) continue;

    await (prisma as any).notification.createMany({
      data: batchUserIds.map((userId) => ({
        userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
      })),
    });

    const tokens = await (prisma as any).deviceToken.findMany({
      where: { userId: { in: batchUserIds } },
      select: { id: true },
    }) as { id: string }[];

    await enqueueNotificationPush(tokens.map((token) => token.id), payload);
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

export function fireBulkNotification(userIds: string[], payload: NotificationPayload): void {
  sendBulkNotifications(userIds, payload).catch((err) => {
    console.error("[bulk-notification] Failed to send:", err?.message ?? err);
  });
}
