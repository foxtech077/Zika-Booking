import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireProvider, requireProviderRole, type ProviderRequest } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/auth.js";

export async function reviewRoutes(app: FastifyInstance) {
  // ── POST /reviews — guest submits a review ────────────────────────────
  app.post("/reviews", {
    schema: {
      tags: ["Reviews"],
      body: {
        type: "object",
        required: ["bookingId", "rating"],
        properties: {
          bookingId: { type: "string" },
          rating: { type: "integer", minimum: 1, maximum: 5 },
          title: { type: "string", maxLength: 100 },
          body: { type: "string", maxLength: 2000 }
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
                reviewId: { type: "string" },
                message: { type: "string" }
              },
              required: ["reviewId", "message"]
            }
          },
          required: ["success", "data"]
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" }
              },
              required: ["code", "message"]
            }
          },
          required: ["success", "error"]
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" }
              },
              required: ["code", "message"]
            }
          },
          required: ["success", "error"]
        },
        409: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" }
              },
              required: ["code", "message"]
            }
          },
          required: ["success", "error"]
        }
      }
    },
    preHandler: [requireProvider]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const guestId = (req as ProviderRequest).providerId;
    const body = req.body as {
      bookingId: string;
      rating: number;
      title?: string;
      body?: string;
    };

    if (!body.bookingId || body.rating === undefined) {
      return sendError(reply, 400, "VALIDATION_ERROR", "bookingId and rating are required.");
    }
    if (body.rating < 1 || body.rating > 5 || !Number.isInteger(body.rating)) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Rating must be an integer between 1 and 5.");
    }

    const booking = await prisma.booking.findUnique({
      where: { id: body.bookingId },
      include: { review: true },
    });

    if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
    if (booking.guestId !== guestId) return sendError(reply, 403, "FORBIDDEN", "This booking does not belong to you.");
    if (booking.status !== "completed") return sendError(reply, 409, "INVALID_STATUS", "Reviews can only be submitted for completed bookings.");
    if (booking.review) return sendError(reply, 409, "ALREADY_REVIEWED", "You have already reviewed this booking.");

    if (booking.checkOut) {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      if (booking.checkOut < fourteenDaysAgo) {
        return sendError(reply, 409, "EXPIRED_WINDOW", "Reviews can only be submitted within 14 days of checkout.");
      }
    }

    // Fraud Safeguards Placeholder
    // TODO: Verify if guest account was created within 7 days.
    // TODO: Verify if req.ip matches provider's subnet / device fingerprint.
    const isNewAccountFlag = false; // Mocked until Auth integration
    const isDeviceFlag = false;     // Mocked until fingerprint integration
    const isFraudFlagged = isNewAccountFlag || isDeviceFlag;

    if (isFraudFlagged) {
      // TODO: Create a fraud alert for admins
      console.warn("Review flagged for fraud (IP/New Account).");
    }

    const review = await prisma.listingReview.create({
      data: {
        bookingId: body.bookingId,
        listingId: booking.listingId,
        guestId,
        rating: body.rating,
        title: body.title,
        body: body.body,
        isHidden: isFraudFlagged, // Hide if flagged
        hiddenReason: isFraudFlagged ? "Flagged for fraud (IP/New Account)" : null,
      },
    });

    // Auto-suspension logic (non-hotel listings only)
    const listing = await prisma.listing.findUnique({ where: { id: booking.listingId } });

    if (listing && listing.category !== "hotel" && !isFraudFlagged) {
      if (body.rating >= 3) {
        // Reset consecutiveNegative on positive/neutral review (3+)
        if (listing.consecutiveNegative > 0) {
          await prisma.listing.update({
            where: { id: listing.id },
            data: { consecutiveNegative: 0 },
          });
        }
      } else if (body.rating <= 2) {
        const newCount = listing.consecutiveNegative + 1;
        
        if (newCount >= 2) {
          // Suspend on 2nd straight negative review
          await prisma.$transaction([
            prisma.listing.update({
              where: { id: listing.id },
              data: {
                status: "auto_suspended",
                consecutiveNegative: newCount,
                suspendedAt: new Date(),
              },
            }),
            prisma.listingReviewTask.create({
              data: {
                listingId: listing.id,
                submissionNumber: listing.submissionCount,
                status: "open",
                slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h SLA
              }
            })
          ]);
          // TODO: Cancel active reservations, void payments.
          // TODO: Notify provider by email.
        } else {
          await prisma.listing.update({
            where: { id: listing.id },
            data: { consecutiveNegative: newCount },
          });
        }
      }
    }

    return sendSuccess(reply, 201, { reviewId: review.id, message: "Review submitted successfully." });
  });

  // ── GET /listings/:id/reviews — public paginated reviews ─────────────
  app.get("/listings/:id/reviews", {
    schema: {
      tags: ["Reviews"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" }
        }
      },
      querystring: {
        type: "object",
        properties: {
          page: { type: "string", pattern: "^[0-9]+$" },
          limit: { type: "string", pattern: "^[0-9]+$" }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                total: { type: "integer" },
                page: { type: "integer" },
                limit: { type: "integer" },
                totalPages: { type: "integer" },
                averageRating: { type: "number", nullable: true },
                reviews: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      guestId: { type: "string" },
                      rating: { type: "integer" },
                      title: { type: "string", nullable: true },
                      body: { type: "string", nullable: true },
                      providerReply: { type: "string", nullable: true },
                      providerRepliedAt: { type: "string", nullable: true },
                      createdAt: { type: "string" }
                    },
                    required: [
                      "id", "guestId", "rating", "title", "body",
                      "providerReply", "providerRepliedAt", "createdAt"
                    ]
                  }
                }
              },
              required: ["total", "page", "limit", "totalPages", "averageRating", "reviews"]
            }
          },
          required: ["success", "data"]
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" }
              },
              required: ["code", "message"]
            }
          },
          required: ["success", "error"]
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const q = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(q["page"] ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(q["limit"] ?? "10", 10)));
    const skip = (page - 1) * limit;

    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

    const [reviews, total] = await Promise.all([
      prisma.listingReview.findMany({
        where: { listingId: id, isHidden: false },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.listingReview.count({ where: { listingId: id, isHidden: false } }),
    ]);

    const avgResult = await prisma.listingReview.aggregate({
      where: { listingId: id, isHidden: false },
      _avg: { rating: true },
    });
    const averageRating = avgResult._avg.rating ? Number(avgResult._avg.rating.toFixed(1)) : null;

    return sendSuccess(reply, 200, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      averageRating,
      reviews: reviews.map((r) => ({
        id: r.id,
        guestId: r.guestId,
        rating: r.rating,
        title: r.title,
        body: r.body,
        providerReply: r.providerReply,
        providerRepliedAt: r.providerRepliedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  });

  // ── POST /reviews/:id/reply — provider replies to a review ────────────
  app.post("/reviews/:id/reply", {
    schema: {
      tags: ["Reviews"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" }
        }
      },
      body: {
        type: "object",
        required: ["reply"],
        properties: {
          reply: { type: "string", maxLength: 2000 }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                message: { type: "string" }
              },
              required: ["message"]
            }
          },
          required: ["success", "data"]
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" }
              },
              required: ["code", "message"]
            }
          },
          required: ["success", "error"]
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" }
              },
              required: ["code", "message"]
            }
          },
          required: ["success", "error"]
        }
      }
    },
    preHandler: [requireProviderRole]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const providerId = (req as ProviderRequest).providerId;
    const { id } = req.params as { id: string };
    const body = req.body as { reply: string };

    if (!body.reply?.trim()) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Reply text is required.");
    }

    const review = await prisma.listingReview.findUnique({
      where: { id },
      include: { booking: { include: { listing: true } } },
    });

    if (!review) return sendError(reply, 404, "NOT_FOUND", "Review not found.");
    if (review.booking.listing.providerId !== providerId) {
      return sendError(reply, 403, "FORBIDDEN", "This review is not for your listing.");
    }

    await prisma.listingReview.update({
      where: { id },
      data: {
        providerReply: body.reply.trim(),
        providerRepliedAt: new Date(),
      },
    });

    return sendSuccess(reply, 200, { message: "Reply submitted." });
  });

  // ── GET /reviews/me — guest's own reviews ────────────────────────────
  app.get("/reviews/me", {
    schema: {
      tags: ["Reviews"],
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                reviews: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      listingId: { type: "string" },
                      listingName: { type: "string" },
                      bookingId: { type: "string" },
                      rating: { type: "integer" },
                      title: { type: "string", nullable: true },
                      body: { type: "string", nullable: true },
                      providerReply: { type: "string", nullable: true },
                      providerRepliedAt: { type: "string", nullable: true },
                      isHidden: { type: "boolean" },
                      createdAt: { type: "string" }
                    },
                    required: [
                      "id", "listingId", "listingName", "bookingId", "rating",
                      "title", "body", "providerReply", "providerRepliedAt",
                      "isHidden", "createdAt"
                    ]
                  }
                }
              },
              required: ["reviews"]
            }
          },
          required: ["success", "data"]
        }
      }
    },
    preHandler: [requireProvider]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const guestId = (req as ProviderRequest).providerId;

    const reviews = await prisma.listingReview.findMany({
      where: { guestId },
      orderBy: { createdAt: "desc" },
      include: { listing: { select: { name: true } } },
    });

    return sendSuccess(reply, 200, {
      reviews: reviews.map((r) => ({
        id: r.id,
        listingId: r.listingId,
        listingName: r.listing.name ?? "",
        bookingId: r.bookingId,
        rating: r.rating,
        title: r.title,
        body: r.body,
        providerReply: r.providerReply,
        providerRepliedAt: r.providerRepliedAt?.toISOString() ?? null,
        isHidden: r.isHidden,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  });

  // ── PATCH /reviews/:id/hide — admin hide/unhide a review ─────────────
  app.patch("/reviews/:id/hide", {
    schema: {
      tags: ["Admin Reviews"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" }
        }
      },
      body: {
        type: "object",
        required: ["hidden"],
        properties: {
          hidden: { type: "boolean" },
          reason: { type: "string", maxLength: 500 }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                message: { type: "string" }
              },
              required: ["message"]
            }
          },
          required: ["success", "data"]
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" }
              },
              required: ["code", "message"]
            }
          },
          required: ["success", "error"]
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" }
              },
              required: ["code", "message"]
            }
          },
          required: ["success", "error"]
        }
      }
    },
    preHandler: [requireAdmin]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { hidden: boolean; reason?: string };

    if (body.hidden === undefined) {
      return sendError(reply, 400, "VALIDATION_ERROR", "hidden field is required.");
    }

    const review = await prisma.listingReview.findUnique({ where: { id } });
    if (!review) return sendError(reply, 404, "NOT_FOUND", "Review not found.");

    await prisma.listingReview.update({
      where: { id },
      data: {
        isHidden: body.hidden,
        hiddenBy: body.hidden ? "admin" : null,
        hiddenAt: body.hidden ? new Date() : null,
        hiddenReason: body.hidden ? (body.reason ?? null) : null,
      },
    });

    return sendSuccess(reply, 200, { message: `Review ${body.hidden ? "hidden" : "unhidden"} successfully.` });
  });
}