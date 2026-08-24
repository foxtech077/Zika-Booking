import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { registerBullBoard, startJobs, stopJobs } from "./jobs.js";
import { paymentRoutes } from "./routes/payments.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { paymentMethodRoutes } from "./routes/payment-methods.js";
import { adminPaymentRoutes } from "./routes/admin-payments.js";
import { merchantRoutes } from "./routes/merchants.js";
import { payoutRoutes } from "./routes/payouts.js";
import { prisma } from "./lib/prisma.js";
import { closeEmailQueue } from "./lib/emailQueue.js";

const PORT = Number(process.env["PORT"] ?? 3004);
const HOST = process.env["HOST"] ?? "0.0.0.0";
let ready = false;

async function build() {
  const app = Fastify({
    logger: {
      level: process.env["NODE_ENV"] === "production" ? "warn" : "info",
    },
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
        {
          name: "Payments",
          description:
            "Payment initiation, status lookup and refund management",
        },
        {
          name: "Payment Methods",
          description: "Saved payment method management — add, list and remove",
        },
        {
          name: "Webhooks",
          description: "Stripe webhook event handling (internal)",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description:
              "Enter your Bearer Access Token (without 'Bearer ' prefix)",
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
  const PROD_ORIGINS = [
    process.env["WEB_BASE_URL"] ?? "http://localhost:3000",
    process.env["ADMIN_BASE_URL"] ?? "http://localhost:3002",
    process.env["PROVIDER_BASE_URL"] ?? "http://localhost:3005",
    "https://kainook.com",
    ...LOCALHOST_ORIGINS,
  ];
  await app.register(cors, {
    origin: isDev ? true : PROD_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });
  // @fastify/cors injects its headers in an onRequest hook, so replies sent
  // from error handlers or failed hooks can go out without CORS headers. Add
  // them back on every outgoing response so browsers don't surface real API
  // errors (4xx/5xx) as CORS errors instead.
  app.addHook("onSend", (req, reply, _payload, done) => {
    const origin = req.headers.origin;
    if (!origin || reply.hasHeader("access-control-allow-origin")) {
      return done();
    }
    if (isDev || PROD_ORIGINS.includes(origin)) {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Access-Control-Allow-Credentials", "true");
    }
    done();
  });

  // ── Raw body parser for Stripe webhook signature verification ─────────────
  // Must be registered BEFORE routes so the Stripe webhook receives raw bytes.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => {
      if (req.routeOptions?.url === "/stripe/webhook") {
        (req as any).rawBody = body; //  save raw buffer here
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
  app.get("/health", async () => ({
    status: "ok",
    service: "payment-service",
    timestamp: new Date().toISOString(),
  }));
  app.get("/ready", async (_request, reply) => {
    if (!ready)
      return reply
        .status(503)
        .send({ status: "unready", service: "payment-service" });
    return { status: "ready", service: "payment-service" };
  });

  // ── Global error handler ──────────────────────────────────────────────────
  app.setErrorHandler((error: any, _req, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message:
          statusCode === 500 ? "An unexpected error occurred." : error.message,
      },
    });
  });

  // ── Route plugins ─────────────────────────────────────────────────────────
  await app.register(paymentRoutes);
  await app.register(webhookRoutes);
  await app.register(paymentMethodRoutes);
  await app.register(adminPaymentRoutes);
  await app.register(merchantRoutes);
  await app.register(payoutRoutes);

  // ── Bull Board UI for background jobs ──────────────────────────────────────
  registerBullBoard(app);

  return app;
}

async function main() {
  const app = await build();

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  // Bound the graceful shutdown so a hung job or connection cannot outlive
  // the orchestrator's termination grace period and force a SIGKILL anyway.
  const SHUTDOWN_TIMEOUT_MS = Number(
    process.env["SHUTDOWN_TIMEOUT_MS"] ?? 30_000,
  );

  let shutdownPromise: Promise<void> | null = null;
  const shutdown = (signal: string) => {
    if (shutdownPromise) return shutdownPromise;
    ready = false;
    shutdownPromise = (async () => {
      app.log.info(
        `[Payment Service] ${signal} received. Shutting down gracefully…`,
      );
      try {
        await Promise.race([
          (async () => {
            await app.close();
            await stopJobs();
            await closeEmailQueue();
            await prisma.$disconnect();
          })(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    `shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms`,
                  ),
                ),
              SHUTDOWN_TIMEOUT_MS,
            ),
          ),
        ]);
        process.exit(0);
      } catch (err) {
        app.log.error(
          { err },
          `[Payment Service] Graceful shutdown did not complete in time — forcing exit.`,
        );
        process.exit(1);
      }
    })();
    return shutdownPromise;
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`[Payment Service] listening on ${HOST}:${PORT}`);

    await startJobs();
    ready = true;
    console.log(`[Payment Service] Background jobs registered.`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
