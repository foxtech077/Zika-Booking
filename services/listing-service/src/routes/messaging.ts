import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireProvider, type ProviderRequest } from "../middleware/auth.js";

// ── Simple content filter (blocks phone numbers, emails, URLs, social handles) ──

const CONTACT_PATTERNS = [
  /\b\d[\d\s\-().+]{7,}\d\b/,            // phone numbers
  /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i,     // email addresses
  /https?:\/\/\S+/i,                       // URLs
  /www\.\S+\.[a-z]{2,}/i,                 // www URLs
  /\b(whatsapp|telegram|instagram|snapchat|facebook|tiktok|twitter|viber)\b/i,
  /@\w{3,}/,                               // social handles
];

function filterMessage(body: string): { filtered: boolean; text: string; matchedOn?: string } {
  const match = CONTACT_PATTERNS.find((re) => re.test(body));
  if (!match) return { filtered: false, text: body };
  return {
    filtered: true,
    text: "This message was hidden because it contained contact information. Please complete bookings through Kainook.",
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function messagingRoutes(app: FastifyInstance) {
  // ── POST /conversations — start or get a conversation ─────────────────
app.post(
  "/conversations",
  {
    schema: {
      tags: ["Messaging"],
      body: {
        type: "object",
        required: ["listingId"],
        properties: {
          listingId: {
            type: "string"
          },
          bookingId: {
            type: "string"
          }
        }
      }
    },
    preHandler: [requireProvider]
  },
  async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req as ProviderRequest;
    const body = req.body as { listingId: string; bookingId?: string };

    if (!body.listingId) {
      return sendError(reply, 400, "VALIDATION_ERROR", "listingId is required.");
    }

    const listing = await prisma.listing.findFirst({
      where: { id: body.listingId },
      select: { id: true, providerId: true, allowPreBooking: true },
    });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

    if (!body.bookingId && !listing.allowPreBooking) {
      return sendError(reply, 403, "FORBIDDEN", "This listing does not allow pre-booking enquiries.");
    }

    const guestId = user.providerId;
    const providerId = listing.providerId;

    // Guests can't message their own listings
    if (guestId === providerId) {
      return sendError(reply, 400, "VALIDATION_ERROR", "You cannot message your own listing.");
    }

    // Find or create conversation
    const existing = await prisma.conversation.findFirst({
      where: {
        listingId: body.listingId,
        guestId,
        ...(body.bookingId ? { bookingId: body.bookingId } : {}),
      },
    });

    if (existing) {
      return sendSuccess(reply, 200, { conversationId: existing.id, isNew: false });
    }

    const convo = await prisma.conversation.create({
      data: {
        listingId: body.listingId,
        guestId,
        providerId,
        bookingId: body.bookingId ?? null,
      },
    });

    return sendSuccess(reply, 201, { conversationId: convo.id, isNew: true });
  });

  // ── GET /conversations — list conversations for the current user ───────
  app.get("/conversations", { schema: { tags: ["Messaging"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as ProviderRequest).providerId;
    const { page = "1", limit = "20" } = req.query as { page?: string; limit?: string };
    const skip = (Number(page) - 1) * Number(limit);

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where: { OR: [{ guestId: userId }, { providerId: userId }] },
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
      prisma.conversation.count({
        where: { OR: [{ guestId: userId }, { providerId: userId }] },
      }),
    ]);

    return sendSuccess(reply, 200, {
      conversations: conversations.map((c) => ({
        id: c.id,
        listingId: c.listingId,
        bookingId: c.bookingId,
        guestId: c.guestId,
        providerId: c.providerId,
        status: c.status,
        lastMessage: c.messages[0]
          ? {
              body: c.messages[0].isFiltered ? "[Message hidden]" : c.messages[0].body,
              senderId: c.messages[0].senderId,
              senderType: c.messages[0].senderType,
              createdAt: c.messages[0].createdAt.toISOString(),
            }
          : null,
        updatedAt: c.updatedAt.toISOString(),
      })),
      total,
      page: Number(page),
      limit: Number(limit),
    });
  });

  // ── GET /conversations/:id/messages — get messages in a conversation ───
  app.get("/conversations/:id/messages", { schema: { tags: ["Messaging"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const userId = (req as ProviderRequest).providerId;
    const { before, limit = "50" } = req.query as { before?: string; limit?: string };

    const convo = await prisma.conversation.findUnique({ where: { id } });
    if (!convo) return sendError(reply, 404, "NOT_FOUND", "Conversation not found.");

    if (convo.guestId !== userId && convo.providerId !== userId) {
      return sendError(reply, 403, "FORBIDDEN", "You are not part of this conversation.");
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Number(limit),
    });

    // Mark unread messages as read
    const unread = messages.filter((m) => m.senderId !== userId && !m.readAt);
    if (unread.length) {
      await prisma.message.updateMany({
        where: { id: { in: unread.map((m) => m.id) } },
        data: { readAt: new Date() },
      });
    }

    return sendSuccess(reply, 200, {
      messages: messages.reverse().map((m) => ({
        id: m.id,
        senderId: m.senderId,
        senderType: m.senderType,
        body: m.isFiltered ? "[This message was hidden due to contact information policy]" : m.body,
        isFiltered: m.isFiltered,
        readAt: m.readAt?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  });

  // ── POST /conversations/:id/messages — send a message ─────────────────
app.post(
  "/conversations/:id/messages",
  {
    schema: {
      tags: ["Messaging"],
      body: {
        type: "object",
        required: ["body"],
        properties: {
          body: {
            type: "string"
          
          }
        }
      },
      response: {
        201: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                senderId: { type: "string" },
                senderType: { type: "string" },
                body: { type: "string" },
                isFiltered: { type: "boolean" },
                createdAt: { type: "string" }
              }
            }
          }
        }
      }
    },
    preHandler: [requireProvider]
  },
  async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const userId = (req as ProviderRequest).providerId;
    const body = req.body as { body: string };

    if (!body.body || !body.body.trim()) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Message body cannot be empty.");
    }

    if (body.body.length > 2000) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Message cannot exceed 2000 characters.");
    }

    const convo = await prisma.conversation.findUnique({
      where: { id }
    });

    if (!convo) {
      return sendError(reply, 404, "NOT_FOUND", "Conversation not found.");
    }

    if (convo.status === "closed") {
      return sendError(reply, 400, "CONVERSATION_CLOSED", "This conversation is closed.");
    }

    if (convo.guestId !== userId && convo.providerId !== userId) {
      return sendError(reply, 403, "FORBIDDEN", "You are not part of this conversation.");
    }

    const senderType = convo.guestId === userId ? "guest" : "provider";

    const { filtered, text, matchedOn } = filterMessage(body.body.trim());

    if (filtered) {
      await prisma.messageFilterLog.create({
        data: {
          userId,
          body: text,
          matchedOn: matchedOn || "unknown",
        }
      });
      
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const violations = await prisma.messageFilterLog.count({
        where: { userId, createdAt: { gte: twentyFourHoursAgo } }
      });

      if (violations >= 5) {
        await prisma.$executeRaw`UPDATE auth."User" SET "messagingSuspendedUntil" = NOW() + INTERVAL '48 hours' WHERE id = ${userId}`;
        return sendError(reply, 403, "SUSPENDED", "Your account has been suspended from messaging for 48 hours due to repeated policy violations.");
      } else if (violations >= 3) {
        await prisma.conversation.update({
          where: { id },
          data: { status: "flagged" }
        });
      }

      return sendError(reply, 400, "POLICY_VIOLATION", "Your message contains contact information. ZikaBooking requires all communication to stay in-app to protect both parties.");
    }

    const message = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: userId,
        senderType,
        body: text,
        isFiltered: false
      }
    });

    await prisma.conversation.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        lastMessageAt: new Date()
      }
    });

    return sendSuccess(reply, 201, {
      id: message.id,
      senderId: message.senderId,
      senderType: message.senderType,
      body: message.body,
      isFiltered: message.isFiltered,
      createdAt: message.createdAt.toISOString()
    });
  }
);

  // ── PATCH /conversations/:id/archive ──────────────────────────────────
  app.patch("/conversations/:id/archive", { schema: { tags: ["Messaging"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const userId = (req as ProviderRequest).providerId;

    const convo = await prisma.conversation.findUnique({ where: { id } });
    if (!convo) return sendError(reply, 404, "NOT_FOUND", "Conversation not found.");

    if (convo.guestId !== userId && convo.providerId !== userId) {
      return sendError(reply, 403, "FORBIDDEN", "You are not part of this conversation.");
    }

    await prisma.conversation.update({
      where: { id },
      data: { status: "archived" }
    });

    return sendSuccess(reply, 200, { success: true });
  });

  // ── GET /conversations/unread-count — unread message count ────────────
  app.get("/conversations/unread-count", { schema: { tags: ["Messaging"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as ProviderRequest).providerId;

    const count = await prisma.message.count({
      where: {
        readAt: null,
        senderId: { not: userId },
        conversation: {
          OR: [{ guestId: userId }, { providerId: userId }],
        },
      },
    });

    return sendSuccess(reply, 200, { unreadCount: count });
  });
}
