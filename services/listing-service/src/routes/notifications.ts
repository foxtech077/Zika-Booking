import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireProvider, type ProviderRequest } from "../middleware/auth.js";

const PLATFORMS = ["fcm", "apns", "web"] as const;
type Platform = (typeof PLATFORMS)[number];

export async function notificationRoutes(app: FastifyInstance) {

  // ── POST /notifications/register-device ──────────────────────────────────
  app.post(
    "/notifications/register-device",
    {
      schema: {
        tags: ["Notifications"],
        description: "Register a device token for push notifications (FCM, APNs, Web Push)",
        body: {
          type: "object",
          required: ["token", "platform"],
          properties: {
            token:    { type: "string", description: "FCM registration token, APNs device token, or Web Push subscription JSON" },
            platform: { type: "string", enum: ["fcm", "apns", "web"], description: "Push platform" },
          },
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as ProviderRequest).providerId;
        const { token, platform } = req.body as { token: string; platform: Platform };

        await (prisma as any).deviceToken.upsert({
          where: { userId_token: { userId, token } },
          create: { userId, token, platform },
          update: { platform },
        });

        return sendSuccess(reply, 200, { message: "Device registered for push notifications." });
      } catch (err) {
        req.log.error({ err }, "Failed to register device token");
        return sendError(reply, 500, "INTERNAL_ERROR", "Failed to register device.");
      }
    },
  );

  // ── DELETE /notifications/register-device ────────────────────────────────
  app.delete(
    "/notifications/register-device",
    {
      schema: {
        tags: ["Notifications"],
        description: "Unregister a device token",
        body: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string", description: "The token to remove" },
          },
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as ProviderRequest).providerId;
        const { token } = req.body as { token: string };

        await (prisma as any).deviceToken.deleteMany({ where: { userId, token } });

        return sendSuccess(reply, 200, { message: "Device unregistered." });
      } catch (err) {
        req.log.error({ err }, "Failed to unregister device token");
        return sendError(reply, 500, "INTERNAL_ERROR", "Failed to unregister device.");
      }
    },
  );

  // ── GET /notifications ───────────────────────────────────────────────────
  app.get(
    "/notifications",
    {
      schema: {
        tags: ["Notifications"],
        description: "Fetch the logged-in user's notifications (newest first)",
        querystring: {
          type: "object",
          properties: {
            limit:  { type: "integer", default: 20, description: "Page size (max 50)" },
            cursor: { type: "string",  description: "Cursor (notification id) for pagination" },
          },
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as ProviderRequest).providerId;
        const q      = req.query as Record<string, string>;
        const limit  = Math.min(50, Math.max(1, parseInt(q["limit"] ?? "20", 10)));
        const cursor = q["cursor"] ?? undefined;

        const notifications = await (prisma as any).notification.findMany({
          where:   { userId, ...(cursor ? { id: { lt: cursor } } : {}) },
          orderBy: { createdAt: "desc" },
          take:    limit + 1,
          select:  { id: true, type: true, title: true, body: true, isRead: true, data: true, createdAt: true },
        });

        const hasMore   = notifications.length > limit;
        const page      = hasMore ? notifications.slice(0, limit) : notifications;
        const nextCursor = hasMore ? page[page.length - 1].id : null;

        return sendSuccess(reply, 200, { notifications: page, nextCursor });
      } catch (err) {
        req.log.error({ err }, "Failed to fetch notifications");
        return sendError(reply, 500, "INTERNAL_ERROR", "Failed to fetch notifications.");
      }
    },
  );

  // ── PATCH /notifications/:notificationId/read ────────────────────────────
  app.patch(
    "/notifications/:notificationId/read",
    {
      schema: {
        tags: ["Notifications"],
        description: "Mark a single notification as read",
        params: {
          type: "object",
          required: ["notificationId"],
          properties: {
            notificationId: { type: "string" },
          },
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId         = (req as ProviderRequest).providerId;
        const { notificationId } = req.params as { notificationId: string };

        const updated = await (prisma as any).notification.updateMany({
          where: { id: notificationId, userId },
          data:  { isRead: true },
        });

        if (updated.count === 0) {
          return sendError(reply, 404, "NOT_FOUND", "Notification not found.");
        }

        return sendSuccess(reply, 200, { message: "Marked as read." });
      } catch (err) {
        req.log.error({ err }, "Failed to mark notification as read");
        return sendError(reply, 500, "INTERNAL_ERROR", "Failed to update notification.");
      }
    },
  );

  // ── PATCH /notifications/read-all ────────────────────────────────────────
  app.patch(
    "/notifications/read-all",
    {
      schema: {
        tags: ["Notifications"],
        description: "Mark all notifications as read for the logged-in user",
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as ProviderRequest).providerId;

        await (prisma as any).notification.updateMany({
          where: { userId, isRead: false },
          data:  { isRead: true },
        });

        return sendSuccess(reply, 200, { message: "All notifications marked as read." });
      } catch (err) {
        req.log.error({ err }, "Failed to mark all notifications as read");
        return sendError(reply, 500, "INTERNAL_ERROR", "Failed to update notifications.");
      }
    },
  );

  // ── GET /notifications/unread-count ──────────────────────────────────────
  app.get(
    "/notifications/unread-count",
    {
      schema: {
        tags: ["Notifications"],
        description: "Return the count of unread notifications for the logged-in user",
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as ProviderRequest).providerId;

        const count = await (prisma as any).notification.count({
          where: { userId, isRead: false },
        });

        return sendSuccess(reply, 200, { unreadCount: count });
      } catch (err) {
        req.log.error({ err }, "Failed to fetch unread count");
        return sendError(reply, 500, "INTERNAL_ERROR", "Failed to fetch unread count.");
      }
    },
  );
}
