import type { FastifyReply } from "fastify";
import { Prisma } from "../generated/index.js";

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  fields?: Record<string, unknown>,
) {
  return reply.status(statusCode).send({
    success: false,
    error: { code, message, ...(fields ? { fields } : {}) },
  });
}

export function sendSuccess<T>(reply: FastifyReply, statusCode: number, data: T) {
  return reply.status(statusCode).send({ success: true, data });
}

export class BookingNotFoundError extends Error {
  constructor() {
    super("Booking not found");
    this.name = "BookingNotFoundError";
  }
}

export function isPrismaUniqueViolation(
  err: unknown,
  fieldName?: string,
): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (err.code !== "P2002") {
    return false;
  }

  if (fieldName && err.meta?.target) {
    const target = err.meta.target;

    if (Array.isArray(target)) {
      return target.includes(fieldName);
    }

    if (typeof target === "string") {
      return target.includes(fieldName);
    }
  }

  return true;
}
