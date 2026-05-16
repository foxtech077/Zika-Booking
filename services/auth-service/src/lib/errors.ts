import type { FastifyReply } from "fastify";

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
) {
  return reply.status(statusCode).send({
    success: false,
    error: { code, message, ...(fields ? { fields } : {}) },
  });
}

export function sendSuccess<T>(reply: FastifyReply, statusCode: number, data: T) {
  return reply.status(statusCode).send({ success: true, data });
}

export function zodFieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".");
    if (key && !fields[key]) fields[key] = issue.message;
  }
  return fields;
}
