import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { fastifySchedule } from "@fastify/schedule";
import { SimpleIntervalJob, AsyncTask } from "toad-scheduler";
import { paymentRoutes } from "./routes/payments.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { paymentMethodRoutes } from "./routes/payment-methods.js";
import { adminPaymentRoutes } from "./routes/admin-payments.js";
import { merchantRoutes } from "./routes/merchants.js";
import { payoutRoutes } from "./routes/payouts.js";
import { runPayoutJob } from "./services/payout.service.js";
import { runRefundNotificationRetryJob } from "./services/refund.service.js";
import { prisma } from "./lib/prisma.js";

const PORT = Number(process.env["PORT"] ?? 3004);
const HOST = process.env["HOST"] ?? "0.0.0.0";

async function build() {
  const app = Fastify({
    logger: { level: process.env["NODE_ENV"] === "production" ? "warn" : "info" },
    trustProxy: true,
  });

  // ── Swgger API documentation ─────────────────────────────────────────────
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Kainook Payment Service API",
        description: "API documentation for Kainook Payment Service",
        version: "0.0.1",
      },
      servers: [
        {
          url: `http://localhost:${PORT}`,
          description: "Local development server",
        },
        {
          url: "https://api.kainook.com",
          description: "Production server",
        },
      ],
      tags: [
        { name: "Payments", description: "Payment initiation, status lookup and refund management" },
        { name: "Payment Methods", description: "Saved payment method management — add, list and remove" },
        { name: "Webhooks", description: "Stripe webhook event handling (internal)" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Enter your Bearer Access Token (without 'Bearer ' prefix)",
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
  });

  // ── CORS ──────────────────────────────────────────────────────────────────
  const isDev = process.env["NODE_ENV"] !== "production";
  const LOCALHOST_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3002",
    "http://localhost:3005",
  ];
  await app.register(cors, {
    origin: isDev
      ? true
      : [
        process.env["WEB_BASE_URL"] ?? "http://localhost:3000",
        process.env["ADMIN_BASE_URL"] ?? "http://localhost:3002",
        process.env["PROVIDER_BASE_URL"] ?? "http://localhost:3005",
        "https://kainook.com",
        ...LOCALHOST_ORIGINS,
      ],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  // ── Raw body parser for Stripe webhook signature verification ─────────────
  // Must be registered BEFORE routes so the Stripe webhook receives raw bytes.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => {
      if (req.routeOptions?.url === "/stripe/webhook") {
        (req as any).rawBody = body;  //  save raw buffer here
        done(null, body);
        return;
      }
      try {
        const parsed = JSON.parse((body as Buffer).toString()) as unknown;
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  // ── Health check ──────────────────────────────────────────────────────────
  app.get("/health", async () => ({ status: "ok", service: "payment-service", timestamp: new Date().toISOString() }));

  // ── Global error handler ──────────────────────────────────────────────────
  app.setErrorHandler((error: any, _req, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: statusCode === 500 ? "An unexpected error occurred." : error.message,
      },
    });
  });

  // ── Route plugins ─────────────────────────────────────────────────────────
  await app.register(paymentRoutes,);
  await app.register(webhookRoutes,);
  await app.register(paymentMethodRoutes,);
  await app.register(adminPaymentRoutes,);
  await app.register(merchantRoutes,);
  await app.register(payoutRoutes,);

  // ── Background scheduled jobs ──────────────────────────────────────────────
  await app.register(fastifySchedule);

  return app;
}

async function main() {
  const app = await build();

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    app.log.info(`[Payment Service] ${signal} received. Shutting down gracefully…`);
    try {
      await app.close();
      await prisma.$disconnect();
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`[Payment Service] listening on ${HOST}:${PORT}`);

    // Run background jobs once immediately on startup, then scheduled jobs take over
    void runPayoutJob().catch((err) => console.error("[payout-job] Startup run failed:", err));
    void runRefundNotificationRetryJob().catch((err) => console.error("[refund-retry-job] Startup run failed:", err));

    const onErr = (name: string) => (err: any) => console.error(`[${name}] Job run failed:`, err);

    app.scheduler.addSimpleIntervalJob(
      new SimpleIntervalJob({ seconds: 60 }, new AsyncTask("payout-job", () => runPayoutJob(), onErr("payout-job"))),
    );

    app.scheduler.addSimpleIntervalJob(
      new SimpleIntervalJob({ seconds: 60 }, new AsyncTask("refund-retry-job", () => runRefundNotificationRetryJob(), onErr("refund-retry-job"))),
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();