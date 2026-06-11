import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireAdmin } from "../middleware/auth.js";

export async function adminMessagingRoutes(app: FastifyInstance) {
  // ── GET /admin/conversations ──────────────────────────────────────────
  app.get(
    "/admin/conversations",
    {
      schema: { tags: ["Admin Messaging"] },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { page = "1", limit = "20", status } = req.query as { page?: string; limit?: string; status?: string };
      const skip = (Number(page) - 1) * Number(limit);

      const where = status ? { status: status as any } : {};

      const [conversations, total] = await Promise.all([
        prisma.conversation.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip,
          take: Number(limit),
          include: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        }),
        prisma.conversation.count({ where }),
      ]);

      return sendSuccess(reply, 200, {
        conversations: conversations.map((c) => ({
          id: c.id,
          listingId: c.listingId,
          bookingId: c.bookingId,
          guestId: c.guestId,
          providerId: c.providerId,
          status: c.status,
          lastMessage: c.messages[0] ? c.messages[0] : null,
          updatedAt: c.updatedAt.toISOString(),
        })),
        total,
        page: Number(page),
        limit: Number(limit),
      });
    }
  );

  // ── GET /admin/conversations/:id/messages ─────────────────────────────
  app.get(
    "/admin/conversations/:id/messages",
    {
      schema: { tags: ["Admin Messaging"] },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const { before, limit = "50" } = req.query as { before?: string; limit?: string };

      const convo = await prisma.conversation.findUnique({ where: { id } });
      if (!convo) return sendError(reply, 404, "NOT_FOUND", "Conversation not found.");

      const messages = await prisma.message.findMany({
        where: {
          conversationId: id,
          ...(before ? { createdAt: { lt: new Date(before) } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: Number(limit),
      });

      return sendSuccess(reply, 200, {
        messages: messages.reverse(),
      });
    }
  );

  // ── POST /admin/conversations/:id/messages ────────────────────────────
  app.post(
    "/admin/conversations/:id/messages",
    {
      schema: {
        tags: ["Admin Messaging"],
        body: {
          type: "object",
          required: ["body"],
          properties: {
            body: { type: "string" },
          },
        },
      },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const body = req.body as { body: string };

      if (!body.body || !body.body.trim()) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Message body cannot be empty.");
      }

      const convo = await prisma.conversation.findUnique({ where: { id } });
      if (!convo) return sendError(reply, 404, "NOT_FOUND", "Conversation not found.");

      const message = await prisma.message.create({
        data: {
          conversationId: id,
          senderId: "system", // Admin action
          senderType: "support_agent",
          body: body.body.trim(),
          isFiltered: false,
        },
      });

      await prisma.conversation.update({
        where: { id },
        data: {
          updatedAt: new Date(),
          lastMessageAt: new Date(),
        },
      });

      return sendSuccess(reply, 201, message);
    }
  );
}
