<<<<<<< HEAD
import { PrismaClient } from "../generated/client";
=======
import { PrismaClient } from "../../node_modules/.prisma/client/index.js";
>>>>>>> 3e85df4df320b466ef3cdbb634df82bc67258d54

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env["NODE_ENV"] === "development" ? ["query", "error"] : ["error"] });

if (process.env["NODE_ENV"] !== "production") globalForPrisma.prisma = prisma;
