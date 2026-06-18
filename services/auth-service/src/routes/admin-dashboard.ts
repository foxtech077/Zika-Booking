import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAdminSession } from "./admin-auth.js";

export async function adminDashboardRoutes(app: FastifyInstance) {
  // ── GET /admin/dashboard/summary ─────────────────────────────────────────────
  app.get("/admin/dashboard/summary", {
    schema: {
      tags: ["Admin Dashboard"],
      description: "Get aggregated dashboard summary",
    },
    preHandler: [requireAdminSession],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Auth schema
      const totalProviders = await prisma.user.count({ where: { userType: "provider" } });
      const totalGuests = await prisma.user.count({ where: { userType: "guest" } });
      const totalAdmins = await prisma.adminUser.count();
      const totalAudits = await prisma.auditLog.count();
      const accreditationCount = await prisma.accreditation.count();

      // Listing & Payment schemas (raw queries)
      const [listingData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.listings`;
      const [bookingData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.bookings`;
      const [reportData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.reports`;
      
      const [revenueData] = await prisma.$queryRaw<[{ total: number | null }]>`SELECT SUM(amount) as total FROM payments."Payment" WHERE status = 'captured'`;

      reply.send({
        success: true,
        data: {
          totalListings: Number(listingData?.count || 0),
          totalAccreditations: accreditationCount,
          totalBookings: Number(bookingData?.count || 0),
          totalRevenue: Number(revenueData?.total || 0),
          totalProviders,
          totalUsers: totalGuests + totalProviders + totalAdmins,
          totalPayments: Number(revenueData?.total || 0),
          totalReports: Number(reportData?.count || 0),
          totalAudits,
        }
      });
    } catch (err: any) {
      req.log.error({ err }, "Failed to fetch dashboard summary");
      return reply.status(400).send({
        success: false,
        error: "Failed to fetch dashboard summary",
        message: err?.message || "An unexpected error occurred",
      });
    }
  });

  // ── GET /admin/dashboard/pending-actions ───────────────────────────────────
  app.get("/admin/dashboard/pending-actions", {
    schema: {
      tags: ["Admin Dashboard"],
      description: "Get counts of pending actions",
    },
    preHandler: [requireAdminSession],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const pendingAccreditations = await prisma.accreditation.count({ where: { status: "pending" } });
      
      const [hotelData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM listing.listing_review_tasks WHERE status = 'open'`;
      const [refundData] = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM payments."Refund" WHERE status = 'pending'`;

      reply.send({
        success: true,
        data: {
          pendingHotelApprovals: Number(hotelData?.count || 0),
          pendingAccreditationReviews: pendingAccreditations,
          pendingRefundRequests: Number(refundData?.count || 0),
        }
      });
    } catch (err: any) {
      req.log.error({ err }, "Failed to fetch pending actions");
      return reply.status(400).send({
        success: false,
        error: "Failed to fetch pending actions",
        message: err?.message || "An unexpected error occurred",
      });
    }
  });

  // ── GET /admin/dashboard/recent-activity ───────────────────────────────────
  app.get("/admin/dashboard/recent-activity", {
    schema: {
      tags: ["Admin Dashboard"],
      description: "Get recent platform activities",
    },
    preHandler: [requireAdminSession],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
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
          created_at as timestamp, 
          json_build_object('paymentId', "paymentId", 'amount', amount) as metadata 
        FROM payments."Refund"
        WHERE status = 'succeeded'
        
        ORDER BY timestamp DESC
        LIMIT 50
      `;

      reply.send({
        success: true,
        data: activities,
      });
    } catch (err: any) {
      req.log.error({ err }, "Failed to fetch recent activity");
      return reply.status(400).send({
        success: false,
        error: "Failed to fetch recent activity",
        message: err?.message || "An unexpected error occurred",
      });
    }
  });
}
