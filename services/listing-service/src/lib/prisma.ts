// Import from the locally generated client (output = "../src/generated" in schema.prisma)
import { PrismaClient } from "../generated/index.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env["NODE_ENV"] === "development" ? ["query", "error"] : ["error"] });

if (process.env["NODE_ENV"] !== "production") globalForPrisma.prisma = prisma;
