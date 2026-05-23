import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Redis from "ioredis";
import { listingRoutes } from "./routes/listings.js";
import { adminListingRoutes } from "./routes/admin-listings.js";
import { bookingRoutes } from "./routes/bookings.js";
import { searchRoutes } from "./routes/search.js";
import { reviewRoutes } from "./routes/reviews.js";
import { commissionRoutes } from "./routes/commission.js";
import { voucherRoutes } from "./routes/vouchers.js";
import { providerRoutes } from "./routes/provider.js";
import { icalRoutes, startIcalPoller } from "./routes/ical.js";
import { messagingRoutes } from "./routes/messaging.js";

const PORT = Number(process.env["LISTING_SERVICE_PORT"] ?? 3003);
const HOST = process.env["LISTING_SERVICE_HOST"] ?? "0.0.0.0";

async function build() {
  const app = Fastify({
    logger: { level: process.env["NODE_ENV"] === "production" ? "warn" : "info" },
    trustProxy: true,
  });

  // Register Swagger API documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Zika Booking Listing Service API",
        description: "API documentation for Zika Booking Listing Service",
        version: "0.0.1",
      },
      servers: [
        {
          url: `http://localhost:${PORT}`,
          description: "Local development server",
        },
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
    transform: ({ schema, url }) => {
      const newSchema = { ...schema };
      if (!newSchema.tags) {
        if (url.startsWith("/admin/listings")) {
          newSchema.tags = ["Admin Listings"];
        } else if (url.startsWith("/admin/vouchers")) {
          newSchema.tags = ["Admin Vouchers"];
        } else if (url.startsWith("/admin/commission-rates")) {
          newSchema.tags = ["Admin Commission"];
        } else if (url.startsWith("/listings")) {
          if (url.includes("/ical-feeds")) {
            newSchema.tags = ["iCal"];
          } else {
            newSchema.tags = ["Listings"];
          }
        } else if (url.startsWith("/bookings")) {
          newSchema.tags = ["Bookings"];
        } else if (url.startsWith("/reviews")) {
          newSchema.tags = ["Reviews"];
        } else if (url.startsWith("/vouchers")) {
          newSchema.tags = ["Vouchers"];
        } else if (url.startsWith("/conversations")) {
          newSchema.tags = ["Messaging"];
        } else if (url.startsWith("/provider")) {
          newSchema.tags = ["Provider"];
        } else if (url.startsWith("/guests")) {
          newSchema.tags = ["Guests"];
        } else if (url.startsWith("/search")) {
          newSchema.tags = ["Search"];
        } else if (url.startsWith("/geocode")) {
          newSchema.tags = ["Geocoding"];
        } else if (url === "/health") {
          newSchema.tags = ["System"];
        } else {
          newSchema.tags = ["Default"];
        }
      }
      return { schema: newSchema, url };
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
  await app.register(cors, {
    // In development, allow all origins so the Expo mobile app (which sends no
    // Origin header from React Native) can reach the API. In production, lock
    // down to known web / admin URLs only.
    origin: isDev
      ? true
      : [
          process.env["WEB_BASE_URL"] ?? "http://localhost:3000",
          process.env["ADMIN_BASE_URL"] ?? "http://localhost:3002",
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

  app.setErrorHandler((error: { statusCode?: number; message: string }, _req, reply) => {
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
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`[Listing Service] listening on ${HOST}:${PORT}`);
    startIcalPoller();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
