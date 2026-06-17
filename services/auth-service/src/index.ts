import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { getRedis } from "./lib/redis";
import { authRoutes } from "./routes/auth";
import {
  adminAuthRoutes,
  adminUserRoutes,
  adminOperatorRoutes,
} from "./routes/admin-auth";
import { adminDashboardRoutes } from "./routes/admin-dashboard.js";
import { startTokenPurger } from "./lib/tokenPurger.js";
import { startAuditLogPurger } from "./lib/auditLogPurger.js";

const PORT = Number(process.env["AUTH_SERVICE_PORT"] ?? 3001);
const HOST = process.env["AUTH_SERVICE_HOST"] ?? "0.0.0.0";

async function build() {
  const app = Fastify({
    logger: {
      level: process.env["NODE_ENV"] === "production" ? "warn" : "info",
    },
    trustProxy: true,
  });

  // Register Swagger API documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Kainook Auth Service API",
        description: "API documentation for Kainook Auth Service",
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
          name: "User Auth",
          description:
            "User registration, login, email verification, OAuth and password management",
        },
        {
          name: "Admin Auth",
          description:
            "Admin login, TOTP 2FA setup/verify and WebAuthn hardware key management",
        },
        {
          name: "Admin Users",
          description:
            "Admin management of platform users — suspend, reinstate, ban and audit logs",
        },
        {
          name: "Admin Operators",
          description:
            "Super-admin management of admin operator accounts and roles",
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

  await app.register(helmet, { contentSecurityPolicy: false });
  const isDev = process.env["NODE_ENV"] == "production";
  await app.register(cors, {
    // In development, allow all origins so the Expo mobile app (which sends no
    // Origin header from React Native) can reach the API.  In production, lock
    // down to known web / admin URLs only.
    // localhost origins are always included so local dev works even when
    // WEB_BASE_URL / ADMIN_BASE_URL point to the live production URLs.
    origin: isDev
      ? true
      : [
          process.env["WEB_BASE_URL"] ?? "http://localhost:3000",
          process.env["ADMIN_BASE_URL"] ?? "http://localhost:3002",
          "https://kainook.com",
          "http://localhost:3000",
          "http://localhost:3002",
        ],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(cookie);

  // Global rate limit (per IP, backed by Redis)
  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: "1 minute",
    redis: getRedis(),
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
    }),
  });

  // Health check
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  // Register route modules
  await app.register(authRoutes);
  await app.register(adminAuthRoutes);
  await app.register(adminUserRoutes);
  await app.register(adminOperatorRoutes);
  await app.register(adminDashboardRoutes);

  // Global error handler
  app.setErrorHandler((error, _req, reply) => {
    app.log.error(error);
    const err = error as any;
    const statusCode = err.statusCode ?? 500;
    reply.status(statusCode).send({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message:
          statusCode === 500 ? "An unexpected error occurred." : err.message,
      },
    });
  });

  return app;
}

async function main() {
  const app = await build();
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`[Auth Service] listening on ${HOST}:${PORT}`);
    startTokenPurger();
    startAuditLogPurger();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
