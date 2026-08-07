import "dotenv/config";
import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Redis from "ioredis";
import { registerBullBoard, startJobs, stopJobs } from "./jobs.js";
import { listingRoutes } from "./routes/listings.js";
import { adminListingRoutes } from "./routes/admin-listings.js";
import { bookingRoutes } from "./routes/bookings.js";
import { searchRoutes } from "./routes/search.js";
import { reviewRoutes } from "./routes/reviews.js";
import { commissionRoutes } from "./routes/commission.js";
import { voucherRoutes } from "./routes/vouchers.js";
import { providerRoutes } from "./routes/provider.js";
import { icalRoutes } from "./routes/ical.js";
import { messagingRoutes } from "./routes/messaging.js";
import { bookingDocumentRoutes } from "./routes/booking-documents.js";
import { loyaltyRoutes } from "./routes/loyalty.js";
import { locationRoutes } from "./routes/location.js";
import { notificationRoutes } from "./routes/notifications.js";
import { profilePhotoRoutes } from "./routes/profile-photos.js";
import { roomTypeRoutes } from "./routes/room-types.js";
import { fxRoutes } from "./routes/fx.js";
const PORT = Number(process.env["LISTING_SERVICE_PORT"] ?? 3003);
const HOST = process.env["LISTING_SERVICE_HOST"] ?? "0.0.0.0";

async function build() {
  const app = Fastify({
    logger: { level: process.env["NODE_ENV"] === "production" ? "warn" : "info" },
    trustProxy: true,
  });

  // ── Global error handler — ensure all errors serialize as { success, error } ──
  app.setErrorHandler((err: FastifyError, request, reply) => {
    const statusCode = err.statusCode ?? 500;
    // Schema validation errors (body/params/query)
    if (err.validation) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: err.message },
      });
    }
    return reply.status(statusCode).send({
      success: false,
      error: { code: err.code ?? "INTERNAL_ERROR", message: err.message ?? "An unexpected error occurred." },
    });
  });

  // Register Swagger API documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Kainook Listing Service API",
        description: "API documentation for Kainook Listing Service",
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
        { name: "Listings", description: "Provider property management — create, edit, submit and photo/document uploads" },
        { name: "Bookings", description: "Guest and provider reservation management — initiate, lock, confirm and cancel" },
        { name: "Search", description: "Public search, availability check, detail and summary views" },
        { name: "Favourites", description: "Guest saved listings management" },
        { name: "Recently Viewed", description: "Guest browsing history tracking" },
        { name: "Reviews", description: "Guest reviews and ratings, and provider replies" },
        { name: "Messaging", description: "Guest-provider direct messaging with contact information filtering" },
        { name: "iCal Calendar Sync", description: "iCal external calendar feeds registration and sync" },
        { name: "Commission", description: "Platform commission rate rules lookup" },
        { name: "Vouchers", description: "Voucher validation and discount calculation" },
        { name: "Provider Portal", description: "Provider dashboard analytics, summarized statistics, bookings, reviews and earnings" },
        { name: "Admin Listings", description: "Admin listing review queue management, approvals, suspensions and status search" },
        { name: "Admin Bookings", description: "Admin booking tracking, detailed status logs and cancellations" },
        { name: "Admin Conversations", description: "Admin direct conversation viewer and filter audit" },
        { name: "Admin iCal", description: "Admin iCal feed configurations and sync triggers" },
        { name: "Admin Reviews", description: "Admin user review feed review and moderation" },
        { name: "Admin Commission", description: "Admin commission rates management per country scope" },
        { name: "Admin Vouchers", description: "Admin voucher code generation and validation rules management" },
        { name: "Loyalty", description: "AfriPoints loyalty programme — tier profile, points history for guests" },
        { name: "Admin Loyalty", description: "Admin manual points adjustment and guest loyalty history" },
        { name: "Room Types", description: "Hotel room type management — create, update, and deactivate room types with pricing and availability" },
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

  await app.register(helmet, { contentSecurityPolicy: false });
  const isDev = process.env["NODE_ENV"] !== "production";
  const LOCALHOST_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3002",
    "http://localhost:3005",
  ];
  await app.register(cors, {
    // In development, allow all origins so the Expo mobile app (which sends no
    // Origin header from React Native) can reach the API. In production, lock
    // down to known web / admin URLs only.
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

  const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379");

  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: "1 minute",
    redis,
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
    }),
  });

  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // ── Proxy merchant requests to payment-service ──────────────────────────────
  const PAYMENT_SERVICE_URL = process.env["PAYMENT_SERVICE_URL"] ?? "http://localhost:3004";
  app.all("/merchant/*", async (req, reply) => {
    try {
      const subPath = (req.params as any)["*"];
      const queryParams = new URLSearchParams(req.query as Record<string, string>).toString();
      const url = `${PAYMENT_SERVICE_URL}/merchant/${subPath}${queryParams ? `?${queryParams}` : ""}`;
      
      const headers: Record<string, string> = {
        "Accept": "application/json",
      };
      if (req.headers.authorization) {
        headers["Authorization"] = req.headers.authorization;
      }
      if (req.headers["content-type"]) {
        headers["Content-Type"] = req.headers["content-type"];
      }

      const fetchOptions: any = {
        method: req.method,
        headers,
      };

      if (["POST", "PATCH", "PUT"].includes(req.method) && req.body) {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const res = await fetch(url, fetchOptions);
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      
      reply.status(res.status).send(data);
    } catch (err) {
      req.log.error({ err }, "Failed to proxy merchant request to payment-service");
      reply.status(502).send({ success: false, error: { code: "BAD_GATEWAY", message: "Failed to communicate with payment service." } });
    }

    // ── Proxy admin payouts requests to payment-service ──────────────────────────

  });

  app.all("/admin/payouts", async (req, reply) => {
  try {
    const queryParams = new URLSearchParams(
      req.query as Record<string, string>
    ).toString();

    const url =
      `${PAYMENT_SERVICE_URL}/admin/payouts` +
      (queryParams ? `?${queryParams}` : "");

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
    }

    if (req.headers["content-type"]) {
      headers["Content-Type"] = req.headers["content-type"];
    }

    const fetchOptions: any = {
      method: req.method,
      headers,
    };

    if (["POST", "PATCH", "PUT"].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const res = await fetch(url, fetchOptions);
    const text = await res.text();

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    reply.status(res.status).send(data);
  } catch (err) {
    req.log.error(
      { err },
      "Failed to proxy admin payouts request to payment-service"
    );

    reply.status(502).send({
      success: false,
      error: {
        code: "BAD_GATEWAY",
        message: "Failed to communicate with payment service.",
      },
    });
  }
});

app.all("/admin/payouts/*", async (req, reply) => {
  try {
    const subPath = (req.params as any)["*"];

    const queryParams = new URLSearchParams(
      req.query as Record<string, string>
    ).toString();

    const url =
      `${PAYMENT_SERVICE_URL}/admin/payouts/${subPath}` +
      (queryParams ? `?${queryParams}` : "");

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
    }

    if (req.headers["content-type"]) {
      headers["Content-Type"] = req.headers["content-type"];
    }

    const fetchOptions: any = {
      method: req.method,
      headers,
    };

    if (["POST", "PATCH", "PUT"].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const res = await fetch(url, fetchOptions);
    const text = await res.text();

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    reply.status(res.status).send(data);
  } catch (err) {
    req.log.error(
      { err },
      "Failed to proxy admin payouts subpath request to payment-service"
    );

    reply.status(502).send({
      success: false,
      error: {
        code: "BAD_GATEWAY",
        message: "Failed to communicate with payment service.",
      },
    });
  }
});

  await app.register(listingRoutes);
  await app.register(adminListingRoutes);
  await app.register(bookingRoutes);
  await app.register(searchRoutes);
  await app.register(reviewRoutes);
  await app.register(commissionRoutes);
  await app.register(voucherRoutes);
  await app.register(providerRoutes);
  await app.register(icalRoutes);
  await app.register(messagingRoutes);
  await app.register(bookingDocumentRoutes);
  await app.register(loyaltyRoutes);
  await app.register(locationRoutes);
  await app.register(notificationRoutes);
  await app.register(profilePhotoRoutes);
  await app.register(roomTypeRoutes);
  await app.register(fxRoutes);

  // ── Bull Board UI for background jobs ──────────────────────────────────────
  registerBullBoard(app);

  return app;
}

async function main() {
  const app = await build();

  const shutdown = async (signal: string) => {
    app.log.info(`[Listing Service] ${signal} received. Shutting down gracefully…`);
    await stopJobs();
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`[Listing Service] listening on ${HOST}:${PORT}`);

    await startJobs();
    console.log(`[Listing Service] Background jobs registered.`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
