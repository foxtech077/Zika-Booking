import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAdminSession } from "./admin-auth.js";
import { sendError, sendSuccess } from "../lib/errors.js";

export async function adminDashboardRoutes(app: FastifyInstance) {
  // ── GET /admin/dashboard/summary ─────────────────────────────────────────────
  app.get("/admin/dashboard/summary", {
    schema: {
      tags: ["Admin Dashboard"],
      description: "Get aggregated dashboard summary",
      querystring: {
        type: "object",
        properties: {
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" },
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
                totalListings: { type: "number" },
                totalAccreditations: { type: "number" },
                totalBookings: { type: "number" },
                totalRevenue: { type: "number" },
                totalProviders: { type: "number" },
                totalUsers: { type: "number" },
                totalPayments: { type: "number" },
                totalReports: { type: "number" },
                totalAudits: { type: "number" },
              }
            }
          }
        }
      }
    },
    preHandler: [requireAdminSession],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const adminRole = (req as FastifyRequest & { adminRole: string }).adminRole;
      if (adminRole !== "super_admin") {
        return sendError(reply, 403, "FORBIDDEN", "Only Super Admins can access the dashboard summary.");
      }

      const q = req.query as { startDate?: string; endDate?: string };
      const dateFilter: any = {};
      if (q.startDate) dateFilter.gte = new Date(q.startDate);
      if (q.endDate) dateFilter.lte = new Date(q.endDate);
      const hasDateFilter = Object.keys(dateFilter).length > 0;

      const whereDate = hasDateFilter ? { createdAt: dateFilter } : {};

      // Auth schema
      const totalProviders = await prisma.user.count({ where: { userType: "provider", ...whereDate } });
      const totalGuests = await prisma.user.count({ where: { userType: "guest", ...whereDate } });
      const totalAdmins = await prisma.adminUser.count({ where: whereDate });
      const totalAudits = await prisma.auditLog.count({ where: hasDateFilter ? { timestamp: dateFilter } : {} });
      const accreditationCount = await prisma.accreditation.count({ where: hasDateFilter ? { submittedAt: dateFilter } : {} });

      // Listing & Payment schemas (raw queries)
      let listingCount = 0;
      let bookingCount = 0;
      let reportCount = 0;
      let paymentTotal = 0;
      let paymentCount = 0;

      if (hasDateFilter) {
        const start = new Date(q.startDate || "1970-01-01");
        const end = new Date(q.endDate || "2999-12-31");
        
        const [listingData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.listings WHERE created_at >= ${start} AND created_at <= ${end}`;
        listingCount = Number(listingData?.count || 0);

        const [bookingData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.bookings WHERE created_at >= ${start} AND created_at <= ${end}`;
        bookingCount = Number(bookingData?.count || 0);

        const [reportData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.reports WHERE created_at >= ${start} AND created_at <= ${end}`;
        reportCount = Number(reportData?.count || 0);

        const [revenueData] = await prisma.$queryRaw<[{ total: number | null, count: bigint }]>`SELECT SUM(amount) as total, COUNT(*) as count FROM payments."Payment" WHERE status = 'captured' AND "createdAt" >= ${start} AND "createdAt" <= ${end}`;
        paymentTotal = Number(revenueData?.total || 0);
        paymentCount = Number(revenueData?.count || 0);
      } else {
        const [listingData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.listings`;
        listingCount = Number(listingData?.count || 0);

        const [bookingData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.bookings`;
        bookingCount = Number(bookingData?.count || 0);

        const [reportData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.reports`;
        reportCount = Number(reportData?.count || 0);

        const [revenueData] = await prisma.$queryRaw<[{ total: number | null, count: bigint }]>`SELECT SUM(amount) as total, COUNT(*) as count FROM payments."Payment" WHERE status = 'captured'`;
        paymentTotal = Number(revenueData?.total || 0);
        paymentCount = Number(revenueData?.count || 0);
      }

      return sendSuccess(reply, 200, {
        totalListings: listingCount,
        totalAccreditations: accreditationCount,
        totalBookings: bookingCount,
        totalRevenue: paymentTotal,
        totalProviders,
        totalUsers: totalGuests + totalProviders + totalAdmins,
        totalPayments: paymentCount,
        totalReports: reportCount,
        totalAudits,
      });
    } catch (err: any) {
      req.log.error({ err }, "Failed to fetch dashboard summary");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to fetch dashboard summary");
    }
  });

  // ── GET /admin/dashboard/pending-actions ───────────────────────────────────
  app.get("/admin/dashboard/pending-actions", {
    schema: {
      tags: ["Admin Dashboard"],
      description: "Get counts of pending actions",
      querystring: {
        type: "object",
        properties: {
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" },
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
                pendingHotelApprovals: { type: "number" },
                pendingAccreditationReviews: { type: "number" },
                pendingRefundRequests: { type: "number" },
              }
            }
          }
        }
      }
    },
    preHandler: [requireAdminSession],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const adminRole = (req as FastifyRequest & { adminRole: string }).adminRole;
      if (adminRole !== "super_admin") {
        return sendError(reply, 403, "FORBIDDEN", "Only Super Admins can access the dashboard pending actions.");
      }

      const q = req.query as { startDate?: string; endDate?: string };
      const dateFilter: any = {};
      if (q.startDate) dateFilter.gte = new Date(q.startDate);
      if (q.endDate) dateFilter.lte = new Date(q.endDate);
      const hasDateFilter = Object.keys(dateFilter).length > 0;

      const whereDate = hasDateFilter ? { submittedAt: dateFilter } : {};

      const pendingAccreditations = await prisma.accreditation.count({ where: { status: "pending", ...whereDate } });
      
      let hotelCount = 0;
      let refundCount = 0;

      if (hasDateFilter) {
        const start = new Date(q.startDate || "1970-01-01");
        const end = new Date(q.endDate || "2999-12-31");

        const [hotelData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.listing_review_tasks WHERE status = 'open' AND created_at >= ${start} AND created_at <= ${end}`;
        hotelCount = Number(hotelData?.count || 0);

        const [refundData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM payments."Refund" WHERE status = 'pending' AND "createdAt" >= ${start} AND "createdAt" <= ${end}`;
        refundCount = Number(refundData?.count || 0);
      } else {
        const [hotelData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.listing_review_tasks WHERE status = 'open'`;
        hotelCount = Number(hotelData?.count || 0);

        const [refundData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM payments."Refund" WHERE status = 'pending'`;
        refundCount = Number(refundData?.count || 0);
      }

      return sendSuccess(reply, 200, {
        pendingHotelApprovals: hotelCount,
        pendingAccreditationReviews: pendingAccreditations,
        pendingRefundRequests: refundCount,
      });
    } catch (err: any) {
      req.log.error({ err }, "Failed to fetch pending actions");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to fetch pending actions");
    }
  });

  // ── GET /admin/dashboard/recent-activity ───────────────────────────────────
  app.get("/admin/dashboard/recent-activity", {
    schema: {
      tags: ["Admin Dashboard"],
      description: "Get recent platform activities",
      querystring: {
        type: "object",
        properties: {
          page: { type: "number", default: 1 },
          limit: { type: "number", default: 50 },
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  type: { type: "string" },
                  action: { type: "string" },
                  actor: { type: "string" },
                  timestamp: { type: "string", format: "date-time" },
                  metadata: { type: "object", additionalProperties: true }
                }
              }
            }
          }
        }
      }
    },
    preHandler: [requireAdminSession],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const adminRole = (req as FastifyRequest & { adminRole: string }).adminRole;
      if (adminRole !== "super_admin") {
        return sendError(reply, 403, "FORBIDDEN", "Only Super Admins can access the dashboard recent activity.");
      }

      const q = req.query as { page?: number; limit?: number };
      const limit = Number(q.limit || 50);
      const page = Number(q.page || 1);
      const offset = (page - 1) * limit;

      // We will use UNION ALL to fetch recent activities across schemas
      const activities = await prisma.$queryRaw<Array<{
        id: string;
        type: string;
        action: string;
        actor: string;
        timestamp: Date;
        metadata: any;
      }>>`
        SELECT 
          id, 
          'audit' as type, 
          action, 
          "adminId" as actor, 
          timestamp, 
          json_build_object('role', role, 'target', "targetType") as metadata 
        FROM auth."AuditLog"
        
        UNION ALL
        
        SELECT 
          id, 
          'moderation' as type, 
          action, 
          actor_id as actor, 
          created_at as timestamp, 
          metadata 
        FROM listing.listing_moderation_log
        
        UNION ALL
        
        SELECT 
          id, 
          'refund' as type, 
          'refund_issued' as action, 
          'system' as actor, 
          "createdAt" as timestamp, 
          json_build_object('paymentId', "paymentId", 'amount', amount) as metadata 
        FROM payments."Refund"
        WHERE status = 'succeeded'
        
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      return sendSuccess(reply, 200, activities);
    } catch (err: any) {
      req.log.error({ err }, "Failed to fetch recent activity");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to fetch recent activity");
    }
  });
}

