import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { sendError, sendSuccess } from "../lib/errors.js";
import { requireProviderRole, type ProviderRequest } from "../middleware/auth.js";

// ── Zod schemas ───────────────────────────────────────────────────────────────

const createRoomTypeSchema = z.object({
  name: z.string().min(1).max(100),
  roomType: z.enum([
    "standard",
    "superior",
    "deluxe",
    "suite",
    "junior_suite",
    "studio",
    "family_room",
    "presidential_suite",
  ]),
  description: z.string().max(2000).optional(),
  pricePerNight: z.number().positive(),
  unitCount: z.number().int().min(1).default(1),
  maxGuests: z.number().int().min(1).optional(),
  sortOrder: z.number().int().default(0),
});

const updateRoomTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  roomType: z
    .enum([
      "standard",
      "superior",
      "deluxe",
      "suite",
      "junior_suite",
      "studio",
      "family_room",
      "presidential_suite",
    ])
    .optional(),
  description: z.string().max(2000).optional().nullable(),
  pricePerNight: z.number().positive().optional(),
  unitCount: z.number().int().min(1).optional(),
  maxGuests: z.number().int().min(1).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// ── Helper: assert listing belongs to provider and is a hotel ─────────────────

async function assertHotelOwner(
  listingId: string,
  providerId: string,
  reply: FastifyReply,
) {
  const listing = await prisma.listing.findFirst({
    where: {
      id: listingId,
      providerId,
      deletedAt: null,
    },
  });
  if (!listing) {
    sendError(reply, 404, "NOT_FOUND", "Listing not found.");
    return null;
  }
  if (listing.category !== "hotel") {
    sendError(
      reply,
      400,
      "NOT_HOTEL",
      "Only hotel listings can have room types.",
    );
    return null;
  }
  return listing;
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function roomTypeRoutes(app: FastifyInstance) {
  // ── POST /listings/:id/room-types — Create a room type ────────────────────
  app.post(
    "/listings/:id/room-types",
    {
      preHandler: [requireProviderRole],
      schema: {
        tags: ["Room Types"],
        summary: "Create a new room type for a hotel listing",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["name", "roomType", "pricePerNight"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            roomType: {
              type: "string",
              enum: [
                "standard",
                "superior",
                "deluxe",
                "suite",
                "junior_suite",
                "studio",
                "family_room",
                "presidential_suite",
              ],
            },
            description: { type: "string", maxLength: 2000 },
            pricePerNight: { type: "number", minimum: 0.01 },
            unitCount: { type: "integer", minimum: 1, default: 1 },
            maxGuests: { type: "integer", minimum: 1 },
            sortOrder: { type: "integer", default: 0 },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object", additionalProperties: true },
            },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { providerId } = req as ProviderRequest;
        const { id } = req.params as { id: string };

        const listing = await assertHotelOwner(id, providerId, reply);
        if (!listing) return;

        const parsed = createRoomTypeSchema.safeParse(req.body);
        if (!parsed.success) {
          const fields: Record<string, string> = {};
          for (const e of parsed.error.issues)
            fields[e.path.join(".")] = e.message;
          return sendError(
            reply,
            422,
            "VALIDATION_ERROR",
            "Invalid room type data.",
            fields,
          );
        }

        const { name, roomType, description, pricePerNight, unitCount, maxGuests, sortOrder } =
          parsed.data;

        const rt = await prisma.hotelRoomType.create({
          data: {
            listingId: id,
            name,
            roomType,
            description,
            pricePerNight,
            unitCount,
            maxGuests,
            sortOrder,
          },
        });

        return sendSuccess(reply, 201, {
          ...rt,
          pricePerNight: Number(rt.pricePerNight),
        });
      } catch (err) {
        req.log.error({ err }, "Failed to create room type");
        return sendError(
          reply,
          500,
          "INTERNAL_ERROR",
          "An unexpected error occurred while creating the room type.",
        );
      }
    },
  );

  // ── GET /listings/:id/room-types — List room types ────────────────────────
  app.get(
    "/listings/:id/room-types",
    {
      preHandler: [requireProviderRole],
      schema: {
        tags: ["Room Types"],
        summary: "List all room types for a hotel listing",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "array",
                items: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { providerId } = req as ProviderRequest;
        const { id } = req.params as { id: string };

        const listing = await assertHotelOwner(id, providerId, reply);
        if (!listing) return;

        const roomTypes = await prisma.hotelRoomType.findMany({
          where: { listingId: id, isActive: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });

        return sendSuccess(
          reply,
          200,
          roomTypes.map((rt) => ({
            ...rt,
            pricePerNight: Number(rt.pricePerNight),
          })),
        );
      } catch (err) {
        req.log.error({ err }, "Failed to list room types");
        return sendError(
          reply,
          500,
          "INTERNAL_ERROR",
          "An unexpected error occurred while fetching room types.",
        );
      }
    },
  );

  // ── GET /listings/:id/room-types/:rtId — Get room type details ────────────
  app.get(
    "/listings/:id/room-types/:rtId",
    {
      preHandler: [requireProviderRole],
      schema: {
        tags: ["Room Types"],
        summary: "Get details of a specific room type",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "rtId"],
          properties: {
            id: { type: "string" },
            rtId: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object", additionalProperties: true },
            },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { providerId } = req as ProviderRequest;
        const { id, rtId } = req.params as { id: string; rtId: string };

        const listing = await assertHotelOwner(id, providerId, reply);
        if (!listing) return;

        const roomType = await prisma.hotelRoomType.findFirst({
          where: { id: rtId, listingId: id },
        });

        if (!roomType) {
          return sendError(
            reply,
            404,
            "ROOM_TYPE_NOT_FOUND",
            "Room type not found.",
          );
        }

        return sendSuccess(reply, 200, {
          ...roomType,
          pricePerNight: Number(roomType.pricePerNight),
        });
      } catch (err) {
        req.log.error({ err }, "Failed to get room type");
        return sendError(
          reply,
          500,
          "INTERNAL_ERROR",
          "An unexpected error occurred while fetching the room type.",
        );
      }
    },
  );

  // ── PATCH /listings/:id/room-types/:rtId — Update room type ───────────────
  app.patch(
    "/listings/:id/room-types/:rtId",
    {
      preHandler: [requireProviderRole],
      schema: {
        tags: ["Room Types"],
        summary: "Update a room type",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "rtId"],
          properties: {
            id: { type: "string" },
            rtId: { type: "string" },
          },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            roomType: {
              type: "string",
              enum: [
                "standard",
                "superior",
                "deluxe",
                "suite",
                "junior_suite",
                "studio",
                "family_room",
                "presidential_suite",
              ],
            },
            description: { type: "string", maxLength: 2000 },
            pricePerNight: { type: "number", minimum: 0.01 },
            unitCount: { type: "integer", minimum: 1 },
            maxGuests: { type: "integer", minimum: 1 },
            sortOrder: { type: "integer" },
            isActive: { type: "boolean" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object", additionalProperties: true },
            },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { providerId } = req as ProviderRequest;
        const { id, rtId } = req.params as { id: string; rtId: string };

        const listing = await assertHotelOwner(id, providerId, reply);
        if (!listing) return;

        const existing = await prisma.hotelRoomType.findFirst({
          where: { id: rtId, listingId: id },
        });

        if (!existing) {
          return sendError(
            reply,
            404,
            "ROOM_TYPE_NOT_FOUND",
            "Room type not found.",
          );
        }

        const parsed = updateRoomTypeSchema.safeParse(req.body);
        if (!parsed.success) {
          const fields: Record<string, string> = {};
          for (const e of parsed.error.issues)
            fields[e.path.join(".")] = e.message;
          return sendError(
            reply,
            422,
            "VALIDATION_ERROR",
            "Invalid room type data.",
            fields,
          );
        }

        const data = parsed.data;

        const roomType = await prisma.hotelRoomType.update({
          where: { id: rtId },
          data,
        });

        return sendSuccess(reply, 200, {
          ...roomType,
          pricePerNight: Number(roomType.pricePerNight),
        });
      } catch (err) {
        req.log.error({ err }, "Failed to update room type");
        return sendError(
          reply,
          500,
          "INTERNAL_ERROR",
          "An unexpected error occurred while updating the room type.",
        );
      }
    },
  );

  // ── DELETE /listings/:id/room-types/:rtId — Deactivate room type ──────────
  app.delete(
    "/listings/:id/room-types/:rtId",
    {
      preHandler: [requireProviderRole],
      schema: {
        tags: ["Room Types"],
        summary: "Delete a room type (hard delete if no bookings, else soft deactivate)",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "rtId"],
          properties: {
            id: { type: "string" },
            rtId: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { providerId } = req as ProviderRequest;
        const { id, rtId } = req.params as { id: string; rtId: string };

        const listing = await assertHotelOwner(id, providerId, reply);
        if (!listing) return;

        const existing = await prisma.hotelRoomType.findFirst({
          where: { id: rtId, listingId: id },
        });

        if (!existing) {
          return sendError(
            reply,
            404,
            "ROOM_TYPE_NOT_FOUND",
            "Room type not found.",
          );
        }

        if (!existing.isActive) {
          return sendSuccess(reply, 200, {
            message: "Room type is already deactivated.",
          });
        }

        const bookingCount = await prisma.booking.count({
          where: { roomTypeId: rtId },
        });

        if (bookingCount === 0) {
          await prisma.hotelRoomType.delete({
            where: { id: rtId },
          });

          return sendSuccess(reply, 200, {
            message: "Room type deleted successfully.",
          });
        }

        await prisma.hotelRoomType.update({
          where: { id: rtId },
          data: { isActive: false },
        });

        return sendSuccess(reply, 200, {
          message: "Room type deactivated successfully. It has existing bookings so it cannot be permanently deleted.",
        });
      } catch (err) {
        req.log.error({ err }, "Failed to deactivate room type");
        return sendError(
          reply,
          500,
          "INTERNAL_ERROR",
          "An unexpected error occurred while deactivating the room type.",
        );
      }
    },
  );
}
