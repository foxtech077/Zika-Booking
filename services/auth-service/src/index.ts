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
import { adminAuthRoutes, adminUserRoutes } from "./routes/admin-auth";

const PORT = Number(process.env["AUTH_SERVICE_PORT"] ?? 3001);
const HOST = process.env["AUTH_SERVICE_HOST"] ?? "0.0.0.0";

async function build() {
  const app = Fastify({ logger: { level: process.env["NODE_ENV"] === "production" ? "warn" : "info" }, trustProxy: true });

  // Register Swagger API documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Zika Booking Auth Service API",
        description: "API documentation for Zika Booking Auth Service",
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
    // Origin header from React Native) can reach the API.  In production, lock
    // down to known web / admin URLs only.
    origin: isDev
      ? true
      : [
          process.env["WEB_BASE_URL"] ?? "http://localhost:3000",
          process.env["ADMIN_BASE_URL"] ?? "http://localhost:3002",
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
      error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
    }),
  });

  // Health check
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // Register route modules
  await app.register(authRoutes);
  await app.register(adminAuthRoutes);
  await app.register(adminUserRoutes);

  // Global error handler
  app.setErrorHandler((error: any, _req, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      success: false,
      error: { code: "SERVER_ERROR", message: statusCode === 500 ? "An unexpected error occurred." : error.message },
    });
  });

  return app;
}

async function main() {
  const app = await build();
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`[Auth Service] listening on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
