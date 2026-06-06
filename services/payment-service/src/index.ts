import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { paymentRoutes } from "./routes/payments.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { paymentMethodRoutes } from "./routes/payment-methods.js";

const PORT = Number(process.env["PORT"] ?? 3004);
const HOST = process.env["HOST"] ?? "0.0.0.0";

async function build() {
  const app = Fastify({
    logger: { level: process.env["NODE_ENV"] === "production" ? "warn" : "info" },
    trustProxy: true,
  });

  // ── Swagger API documentation ─────────────────────────────────────────────
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Zika Booking Payment Service API",
        description: "API documentation for Zika Booking Payment Service",
        version: "0.0.1",
      },
      servers: [
        {
          url: `http://localhost:${PORT}`,
          description: "Local development server",
        },
        {
          url: "https://api.kainook.com/payments",
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
  await app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  // ── Raw body parser for Stripe webhook signature verification ─────────────
  // Must be registered BEFORE routes so the Stripe webhook receives raw bytes.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => {
      // For the Stripe webhook route, we need the raw Buffer.
      // For all other routes, parse as JSON.
      if (req.routeOptions?.url === "/payments/stripe/webhook") {
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

  // ── Route plugins ─────────────────────────────────────────────────────────
  await app.register(paymentRoutes);
  await app.register(webhookRoutes);
  await app.register(paymentMethodRoutes);

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

  return app;
}

async function main() {
  const app = await build();

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    app.log.info(`[Payment Service] ${signal} received. Shutting down gracefully…`);
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`[Payment Service] listening on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
