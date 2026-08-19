import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAdminSession } from "./admin-auth.js";
import { sendError, sendSuccess } from "../lib/errors.js";
import { computePaymentRevenueEur, aggregateBookingFinance } from "../services/eur.summary.js";

export async function adminDashboardRoutes(app: FastifyInstance) {
  // ── GET /admin/dashboard/super-admin/summary ──────────────────────────────────
  app.get("/admin/dashboard/super-admin/summary", {
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
      const totalUsers = await prisma.user.count({ where: { ...whereDate } });
      const totalAdmins = await prisma.adminUser.count({ where: whereDate });
      const totalAudits = await prisma.auditLog.count({ where: hasDateFilter ? { timestamp: dateFilter } : {} });

      // Listing & Payment schemas (raw queries)
      let listingCount = 0;
      let bookingCount = 0;
      let reportCount = 0;

      if (hasDateFilter) {
        const start = new Date(q.startDate || "1970-01-01");
        const end = new Date(q.endDate || "2999-12-31");
        
        const [listingData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.listings WHERE created_at >= ${start} AND created_at <= ${end}`;
        listingCount = Number(listingData?.count || 0);

        const [bookingData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.bookings WHERE created_at >= ${start} AND created_at <= ${end}`;
        bookingCount = Number(bookingData?.count || 0);

        const [reportData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.reports WHERE created_at >= ${start} AND created_at <= ${end}`;
        reportCount = Number(reportData?.count || 0);
      } else {
        const [listingData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.listings`;
        listingCount = Number(listingData?.count || 0);

        const [bookingData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.bookings`;
        bookingCount = Number(bookingData?.count || 0);

        const [reportData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.reports`;
        reportCount = Number(reportData?.count || 0);
      }

      // Revenue is aggregated in EUR (money of record) using each payment's
      // charge snapshot, with refunds deducted — never a raw SUM across
      // currencies.
      const paymentAgg = await computePaymentRevenueEur(
        hasDateFilter
          ? { start: new Date(q.startDate || "1970-01-01"), end: new Date(q.endDate || "2999-12-31") }
          : {},
      );
      const paymentTotal = Number((paymentAgg.revenueEur - paymentAgg.refundsEur).toFixed(2));
      const paymentCount = paymentAgg.paymentsCount;

      return sendSuccess(reply, 200, {
        totalListings: listingCount,
        totalBookings: bookingCount,
        totalRevenue: paymentTotal,
        totalProviders: totalUsers,
        totalUsers: totalUsers + totalAdmins,
        totalPayments: paymentCount,
        totalReports: reportCount,
        totalAudits,
      });
    } catch (err: any) {
      req.log.error({ err }, "Failed to fetch dashboard summary");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to fetch dashboard summary");
    }
  });

  // ── GET /admin/dashboard/super-admin/pending-actions ───────────────────────
  app.get("/admin/dashboard/super-admin/pending-actions", {
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

      let hotelCount = 0;
      let refundCount = 0;

      if (hasDateFilter) {
        const start = new Date(q.startDate || "1970-01-01");
        const end = new Date(q.endDate || "2999-12-31");

        const [hotelData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.listing_review_tasks WHERE status = 'open' AND created_at >= ${start} AND created_at <= ${end}`;
        hotelCount = Number(hotelData?.count || 0);

        const [refundData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM payments."Refund" WHERE status = 'pending' AND "created_at" >= ${start} AND "created_at" <= ${end}`;
        refundCount = Number(refundData?.count || 0);
      } else {
        const [hotelData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.listing_review_tasks WHERE status = 'open'`;
        hotelCount = Number(hotelData?.count || 0);

        const [refundData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM payments."Refund" WHERE status = 'pending'`;
        refundCount = Number(refundData?.count || 0);
      }

      return sendSuccess(reply, 200, {
        pendingHotelApprovals: hotelCount,
        pendingRefundRequests: refundCount,
      });
    } catch (err: any) {
      req.log.error({ err }, "Failed to fetch pending actions");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to fetch pending actions");
    }
  });

  // ── GET /admin/dashboard/super-admin/recent-activity ───────────────────────
  app.get("/admin/dashboard/super-admin/recent-activity", {
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
          id::text as id,
          'audit' as type,
          action,
          "adminId" as actor,
          timestamp,
          jsonb_build_object('role', role, 'target', "targetType") as metadata
        FROM auth."AuditLog"

        UNION ALL

        SELECT
          id::text as id,
          'moderation' as type,
          action,
          actor_id as actor,
          created_at as timestamp,
          to_jsonb(metadata) as metadata
        FROM listing.listing_moderation_log

        UNION ALL

        SELECT
          id::text as id,
          'refund' as type,
          'refund_issued' as action,
          'system' as actor,
          "created_at" as timestamp,
          jsonb_build_object('paymentId', "payment_id", 'amount', amount) as metadata
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

  // ── GET /admin/dashboard/country-manager/summary ───────────────────────────
  app.get("/admin/dashboard/country-manager/summary", {
    schema: {
      tags: ["Admin Dashboard"],
      description: "Get dashboard summary for Country Managers",
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                totalListings: { type: "number" },
                totalBookings: { type: "number" },
                totalRevenue: { type: "number" },
                totalPayments: { type: "number" },
                totalProviders: { type: "number" },
                totalUsers: { type: "number" },
                totalReports: { type: "number" },
              }
            }
          }
        }
      }
    },
    preHandler: [requireAdminSession],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const adminId = (req as any).adminId;
      const adminRole = (req as any).adminRole;
      if (adminRole !== "country_manager") {
        return sendError(reply, 403, "FORBIDDEN", "Only Country Managers can access this summary.");
      }

      const adminUser = await prisma.adminUser.findUnique({
        where: { id: adminId },
        select: { countryScope: true }
      });
      const countryScope = adminUser?.countryScope ?? [];

      if (countryScope.length === 0) {
        return sendSuccess(reply, 200, {
          totalListings: 0,
          totalBookings: 0,
          totalRevenue: 0,
          totalPayments: 0,
          totalProviders: 0,
          totalUsers: 0,
          totalReports: 0,
        });
      }

      const [listingData] = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM listing.listings 
        WHERE country = ANY(${countryScope}) AND deleted_at IS NULL
      `;
      const totalListings = Number(listingData?.count || 0);

      const [bookingData] = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM listing.bookings b
        JOIN listing.listings l ON b.listing_id = l.id
        WHERE l.country = ANY(${countryScope})
      `;
      const totalBookings = Number(bookingData?.count || 0);

      // Revenue aggregated in EUR with refunds deducted, scoped to the
      // manager's countries (see the eur.summary helper for the rule).
      const paymentAgg = await computePaymentRevenueEur({ countryScope });
      const totalRevenue = Number((paymentAgg.revenueEur - paymentAgg.refundsEur).toFixed(2));
      const totalPayments = paymentAgg.paymentsCount;

      const totalUsers = await prisma.user.count({
        where: {
          country: { in: countryScope },
        }
      });

      const [reportData] = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM listing.reports r
        LEFT JOIN listing.listings l ON r.target_id = l.id AND r.target_type = 'listing'
        WHERE (r.target_type = 'listing' AND l.country = ANY(${countryScope})) OR r.target_type != 'listing'
      `;
      const totalReports = Number(reportData?.count || 0);

      return sendSuccess(reply, 200, {
        totalListings,
        totalBookings,
        totalRevenue,
        totalPayments,
        totalProviders: totalUsers,
        totalUsers,
        totalReports,
      });
    } catch (err: any) {
      req.log.error({ err }, "Failed to fetch Country Manager summary");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to fetch Country Manager summary");
    }
  });

  // ── GET /admin/dashboard/sales/summary ─────────────────────────────────────
  app.get("/admin/dashboard/sales/summary", {
    schema: {
      tags: ["Admin Dashboard"],
      description: "Get dashboard summary for Sales Agents",
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                totalBookings: { type: "number" },
              }
            }
          }
        }
      }
    },
    preHandler: [requireAdminSession],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const adminId = (req as any).adminId;
      const adminRole = (req as any).adminRole;
      if (adminRole !== "sales") {
        return sendError(reply, 403, "FORBIDDEN", "Only Sales Agents can access this summary.");
      }

      const adminUser = await prisma.adminUser.findUnique({
        where: { id: adminId },
        select: { countryScope: true }
      });
      const countryScope = adminUser?.countryScope ?? [];

      if (countryScope.length === 0) {
        return sendSuccess(reply, 200, { totalBookings: 0 });
      }

      const [bookingData] = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM listing.bookings b
        JOIN listing.listings l ON b.listing_id = l.id
        WHERE l.country = ANY(${countryScope})
      `;
      const totalBookings = Number(bookingData?.count || 0);

      return sendSuccess(reply, 200, { totalBookings });
    } catch (err: any) {
      req.log.error({ err }, "Failed to fetch Sales Agent summary");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to fetch Sales Agent summary");
    }
  });

  // ── GET /admin/dashboard/support/summary ───────────────────────────────────
  app.get("/admin/dashboard/support/summary", {
    schema: {
      tags: ["Admin Dashboard"],
      description: "Get dashboard summary for Support Agents",
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                totalBookings: { type: "number" },
                totalPayments: { type: "number" },
              }
            }
          }
        }
      }
    },
    preHandler: [requireAdminSession],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const adminRole = (req as any).adminRole;
      if (adminRole !== "support") {
        return sendError(reply, 403, "FORBIDDEN", "Only Support Agents can access this summary.");
      }

      const [bookingData] = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM listing.bookings
      `;
      const totalBookings = Number(bookingData?.count || 0);

      const [revenueData] = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM payments."Payment" WHERE status = 'captured'
      `;
      const totalPayments = Number(revenueData?.count || 0);

      return sendSuccess(reply, 200, {
        totalBookings,
        totalPayments,
      });
    } catch (err: any) {
      req.log.error({ err }, "Failed to fetch Support Agent summary");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to fetch Support Agent summary");
    }
  });

  // ── GET /admin/dashboard/finance/summary ───────────────────────────────────
  app.get("/admin/dashboard/finance/summary", {
    schema: {
      tags: ["Admin Dashboard"],
      description: "Get dashboard summary for Finance Agents",
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
                totalRevenue: { type: "number" },
                totalVoucherDiscounts: { type: "number" },
                netRevenue: { type: "number" },
                totalCommission: { type: "number" },
                totalPayout: { type: "number" },
                totalBookings: { type: "number" },
                totalReports: { type: "number" },
              }
            }
          }
        }
      }
    },
    preHandler: [requireAdminSession],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const adminRole = (req as any).adminRole;
      if (adminRole !== "finance") {
        return sendError(reply, 403, "FORBIDDEN", "Only Finance Agents can access this summary.");
      }

      const q = req.query as { startDate?: string; endDate?: string };
      const dateFilter: any = {};
      if (q.startDate) dateFilter.gte = new Date(q.startDate);
      if (q.endDate) dateFilter.lte = new Date(q.endDate);
      const hasDateFilter = Object.keys(dateFilter).length > 0;

      // Financial totals are aggregated in EUR (the money of record) from confirmed
      // + completed bookings. Each booking's money fields are converted using
      // its charge-time snapshot (priceBreakdownJson.charged*) when present,
      // else the current DB rate; refunds are deducted from revenue.
      const finParams: (string | Date)[] = [];
      let finDateClause = "";
      if (hasDateFilter) {
        if (dateFilter.gte) {
          finParams.push(dateFilter.gte);
          finDateClause += ` AND "createdAt" >= $${finParams.length}`;
        }
        if (dateFilter.lte) {
          finParams.push(dateFilter.lte);
          finDateClause += ` AND "createdAt" <= $${finParams.length}`;
        }
      }

      const bookingRows = await prisma.$queryRawUnsafe<{
        currency: string;
        totalAmount: unknown;
        commissionAmount: unknown;
        providerPayout: unknown;
        voucherDiscount: unknown;
        refundAmount: unknown;
        priceBreakdownJson: unknown;
      }[]>(`
        SELECT currency, "totalAmount", "commissionAmount", "providerPayout",
               "voucherDiscount", "refundAmount", "priceBreakdownJson"
        FROM listing.bookings
        WHERE status IN ('confirmed', 'completed')${finDateClause}
      `, ...finParams);

      const fin = await aggregateBookingFinance(bookingRows);

      const totalRevenue = Number(fin.revenueEur.toFixed(2));
      const totalVoucherDiscounts = Number(fin.voucherDiscountsEur.toFixed(2));
      const netRevenue = Number((fin.revenueEur - fin.refundsEur).toFixed(2)); // refunds now deducted
      const totalCommission = Number(fin.commissionEur.toFixed(2));
      const totalPayout = Number(fin.payoutEur.toFixed(2));
      const totalBookings = fin.bookingsCount;

      const [reportData] = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM listing.reports
      `;
      const totalReports = Number(reportData?.count || 0);

      return sendSuccess(reply, 200, {
        totalRevenue,
        totalVoucherDiscounts,
        netRevenue,
        totalCommission,
        totalPayout,
        totalBookings,
        totalReports,
        currency: "EUR",
      });
    } catch (err: any) {
      req.log.error({ err }, "Failed to fetch Finance Agent summary");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to fetch Finance Agent summary");
    }
  });

  // ── GET /admin/dashboard/admin/summary ─────────────────────────────────────────────
  app.get("/admin/dashboard/admin/summary", {
    schema: {
      tags: ["Admin Dashboard"],
      description: "Get aggregated dashboard summary for Admins",
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
      if (adminRole !== "admin") {
        return sendError(reply, 403, "FORBIDDEN", "Only Admins can access this summary.");
      }

      const q = req.query as { startDate?: string; endDate?: string };
      const dateFilter: any = {};
      if (q.startDate) dateFilter.gte = new Date(q.startDate);
      if (q.endDate) dateFilter.lte = new Date(q.endDate);
      const hasDateFilter = Object.keys(dateFilter).length > 0;

      const whereDate = hasDateFilter ? { createdAt: dateFilter } : {};

      const totalUsers = await prisma.user.count({ where: { ...whereDate } });
      const totalAdmins = await prisma.adminUser.count({ where: whereDate });
      const totalAudits = await prisma.auditLog.count({ where: hasDateFilter ? { timestamp: dateFilter } : {} });

      let listingCount = 0;
      let bookingCount = 0;
      let reportCount = 0;

      if (hasDateFilter) {
        const start = new Date(q.startDate || "1970-01-01");
        const end = new Date(q.endDate || "2999-12-31");
        
        const [listingData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.listings WHERE created_at >= ${start} AND created_at <= ${end}`;
        listingCount = Number(listingData?.count || 0);

        const [bookingData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.bookings WHERE created_at >= ${start} AND created_at <= ${end}`;
        bookingCount = Number(bookingData?.count || 0);

        const [reportData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.reports WHERE created_at >= ${start} AND created_at <= ${end}`;
        reportCount = Number(reportData?.count || 0);
      } else {
        const [listingData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.listings`;
        listingCount = Number(listingData?.count || 0);

        const [bookingData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.bookings`;
        bookingCount = Number(bookingData?.count || 0);

        const [reportData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.reports`;
        reportCount = Number(reportData?.count || 0);
      }

      // Revenue aggregated in EUR with refunds deducted (see super-admin summary).
      const paymentAgg = await computePaymentRevenueEur(
        hasDateFilter
          ? { start: new Date(q.startDate || "1970-01-01"), end: new Date(q.endDate || "2999-12-31") }
          : {},
      );
      const paymentTotal = Number((paymentAgg.revenueEur - paymentAgg.refundsEur).toFixed(2));
      const paymentCount = paymentAgg.paymentsCount;

      return sendSuccess(reply, 200, {
        totalListings: listingCount,
        totalBookings: bookingCount,
        totalRevenue: paymentTotal,
        totalProviders: totalUsers,
        totalUsers: totalUsers + totalAdmins,
        totalPayments: paymentCount,
        totalReports: reportCount,
        totalAudits,
      });
    } catch (err: any) {
      req.log.error({ err }, "Failed to fetch admin dashboard summary");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to fetch admin dashboard summary");
    }
  });

  // ── GET /admin/dashboard/admin/pending-actions ───────────────────────────────────
  app.get("/admin/dashboard/admin/pending-actions", {
    schema: {
      tags: ["Admin Dashboard"],
      description: "Get counts of pending actions for Admins",
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
      if (adminRole !== "admin") {
        return sendError(reply, 403, "FORBIDDEN", "Only Admins can access this endpoint.");
      }

      const q = req.query as { startDate?: string; endDate?: string };
      const dateFilter: any = {};
      if (q.startDate) dateFilter.gte = new Date(q.startDate);
      if (q.endDate) dateFilter.lte = new Date(q.endDate);
      const hasDateFilter = Object.keys(dateFilter).length > 0;

      let hotelCount = 0;
      let refundCount = 0;

      if (hasDateFilter) {
        const start = new Date(q.startDate || "1970-01-01");
        const end = new Date(q.endDate || "2999-12-31");

        const [hotelData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.listing_review_tasks WHERE status = 'open' AND created_at >= ${start} AND created_at <= ${end}`;
        hotelCount = Number(hotelData?.count || 0);

        const [refundData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM payments."Refund" WHERE status = 'pending' AND "created_at" >= ${start} AND "created_at" <= ${end}`;
        refundCount = Number(refundData?.count || 0);
      } else {
        const [hotelData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.listing_review_tasks WHERE status = 'open'`;
        hotelCount = Number(hotelData?.count || 0);

        const [refundData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM payments."Refund" WHERE status = 'pending'`;
        refundCount = Number(refundData?.count || 0);
      }

      return sendSuccess(reply, 200, {
        pendingHotelApprovals: hotelCount,
        pendingRefundRequests: refundCount,
      });
    } catch (err: any) {
      req.log.error({ err }, "Failed to fetch pending actions for Admin");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to fetch pending actions");
    }
  });

  // ── GET /admin/dashboard/admin/recent-activity ───────────────────────────────────
  app.get("/admin/dashboard/admin/recent-activity", {
    schema: {
      tags: ["Admin Dashboard"],
      description: "Get recent platform activities for Admins",
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
      if (adminRole !== "admin") {
        return sendError(reply, 403, "FORBIDDEN", "Only Admins can access this endpoint.");
      }

      const q = req.query as { page?: number; limit?: number };
      const limit = Number(q.limit || 50);
      const page = Number(q.page || 1);
      const offset = (page - 1) * limit;

      const activities = await prisma.$queryRaw<Array<{
        id: string;
        type: string;
        action: string;
        actor: string;
        timestamp: Date;
        metadata: any;
      }>>`
        SELECT 
          id::text as id, 
          'audit' as type, 
          action, 
          "adminId" as actor, 
          timestamp, 
          json_build_object('role', role, 'target', "targetType")::jsonb as metadata 
        FROM auth."AuditLog"
        
        UNION ALL
        
        SELECT 
          id::text as id, 
          'moderation' as type, 
          action, 
          actor_id as actor, 
          created_at as timestamp, 
          metadata::jsonb as metadata 
        FROM listing.listing_moderation_log
        
        UNION ALL
        
        SELECT 
          id::text as id, 
          'refund' as type, 
          'refund_issued' as action, 
          'system' as actor, 
          "created_at" as timestamp, 
          json_build_object('paymentId', "payment_id", 'amount', amount)::jsonb as metadata 
        FROM payments."Refund"
        WHERE status = 'succeeded'
        
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      return sendSuccess(reply, 200, activities);
    } catch (err: any) {
      req.log.error({ err }, "Failed to fetch recent activity for Admin");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to fetch recent activity");
    }
  });

  // ── GET /admin/dashboard/finance/recent-activity ───────────────────────────
  app.get("/admin/dashboard/finance/recent-activity", {
    schema: {
      tags: ["Admin Dashboard"],
      description: "Get recent financial activities for Finance Agents",
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
      const adminRole = (req as any).adminRole;
      if (adminRole !== "finance") {
        return sendError(reply, 403, "FORBIDDEN", "Only Finance Agents can access this recent activity.");
      }

      const q = req.query as { page?: number; limit?: number };
      const limit = Number(q.limit || 50);
      const page = Number(q.page || 1);
      const offset = (page - 1) * limit;

      const activities = await prisma.$queryRaw<Array<{
        id: string;
        type: string;
        action: string;
        actor: string;
        timestamp: Date;
        metadata: any;
      }>>`
        SELECT 
          id::text as id, 
          'refund' as type, 
          'refund_issued' as action, 
          'system' as actor, 
          "created_at" as timestamp, 
          json_build_object('paymentId', "payment_id", 'amount', amount)::jsonb as metadata 
        FROM payments."Refund"
        WHERE status = 'succeeded'
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      return sendSuccess(reply, 200, activities);
    } catch (err: any) {
      req.log.error({ err }, "Failed to fetch Finance Agent recent activity");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to fetch Finance Agent recent activity");
    }
  });

  // ── GET /admin/dashboard/country-manager/pending-actions ───────────────────
  app.get("/admin/dashboard/country-manager/pending-actions", {
    schema: {
      tags: ["Admin Dashboard"],
      description: "Get counts of pending actions for Country Managers",
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                pendingHotelApprovals: { type: "number" },
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
      const adminId = (req as any).adminId;
      const adminRole = (req as any).adminRole;
      if (adminRole !== "country_manager") {
        return sendError(reply, 403, "FORBIDDEN", "Only Country Managers can access this endpoint.");
      }

      const adminUser = await prisma.adminUser.findUnique({
        where: { id: adminId },
        select: { countryScope: true }
      });
      const countryScope = adminUser?.countryScope ?? [];

      if (countryScope.length === 0) {
        return sendSuccess(reply, 200, {
          pendingHotelApprovals: 0,
          pendingRefundRequests: 0,
        });
      }

      const [hotelData] = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM listing.listing_review_tasks t
        JOIN listing.listings l ON t.listing_id = l.id
        WHERE t.status = 'open' AND l.country = ANY(${countryScope})
      `;
      const hotelCount = Number(hotelData?.count || 0);

      const [refundData] = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM payments."Refund" r
        JOIN payments."Payment" p ON r."payment_id" = p.id
        JOIN listing.bookings b ON p."bookingId" = b.id
        JOIN listing.listings l ON b.listing_id = l.id
        WHERE r.status = 'pending' AND l.country = ANY(${countryScope})
      `;
      const refundCount = Number(refundData?.count || 0);

      return sendSuccess(reply, 200, {
        pendingHotelApprovals: hotelCount,
        pendingRefundRequests: refundCount,
      });
    } catch (err: any) {
      req.log.error({ err }, "Failed to fetch pending actions for Country Manager");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to fetch pending actions for Country Manager");
    }
  });

  // ── GET /admin/dashboard/country-manager/recent-activity ───────────────────
  app.get("/admin/dashboard/country-manager/recent-activity", {
    schema: {
      tags: ["Admin Dashboard"],
      description: "Get recent activities for Country Managers",
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
      const adminId = (req as any).adminId;
      const adminRole = (req as any).adminRole;
      if (adminRole !== "country_manager") {
        return sendError(reply, 403, "FORBIDDEN", "Only Country Managers can access this endpoint.");
      }

      const adminUser = await prisma.adminUser.findUnique({
        where: { id: adminId },
        select: { countryScope: true }
      });
      const countryScope = adminUser?.countryScope ?? [];

      if (countryScope.length === 0) {
        return sendSuccess(reply, 200, []);
      }

      const q = req.query as { page?: number; limit?: number };
      const limit = Number(q.limit || 50);
      const page = Number(q.page || 1);
      const offset = (page - 1) * limit;

      const activities = await prisma.$queryRaw<Array<{
        id: string;
        type: string;
        action: string;
        actor: string;
        timestamp: Date;
        metadata: any;
      }>>`
        SELECT 
          m.id::text as id, 
          'moderation' as type, 
          m.action, 
          m.actor_id as actor, 
          m.created_at as timestamp, 
          m.metadata::jsonb as metadata 
        FROM listing.listing_moderation_log m
        JOIN listing.listings l ON m.listing_id = l.id
        WHERE l.country = ANY(${countryScope})
        
        UNION ALL
        
        SELECT 
          r.id::text as id, 
          'refund' as type, 
          'refund_issued' as action, 
          'system' as actor, 
          r."created_at" as timestamp, 
          json_build_object('paymentId', r."payment_id", 'amount', r.amount)::jsonb as metadata 
        FROM payments."Refund" r
        JOIN payments."Payment" p ON r."payment_id" = p.id
        JOIN listing.bookings b ON p."bookingId" = b.id
        JOIN listing.listings l ON b.listing_id = l.id
        WHERE r.status = 'succeeded' AND l.country = ANY(${countryScope})
        
        ORDER BY timestamp DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      return sendSuccess(reply, 200, activities);
    } catch (err: any) {
      req.log.error({ err }, "Failed to fetch recent activity for Country Manager");
      return sendError(reply, 500, "INTERNAL_ERROR", "Failed to fetch recent activity");
    }
  });
}

