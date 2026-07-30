import { Queue, Worker } from "bullmq";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import Redis from "ioredis";
import { purgeExpiredTokens } from "./lib/tokenPurger.js";
import { purgeExpiredAuditLogs } from "./lib/auditLogPurger.js";
import { QueueName, AuthJob } from "@zika/types";

// Dedicated connection for BullMQ — must use maxRetriesPerRequest: null
// (Worker's blocking commands conflict with non-null retry settings).
const connection = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
});

const queue = new Queue(QueueName.Auth, { connection });

const worker = new Worker(
  QueueName.Auth,
  async (job) => {
    switch (job.name as AuthJob) {
      case AuthJob.TokenPurger:
        console.log(`[Job] Running ${AuthJob.TokenPurger}`);
        await purgeExpiredTokens();
        break;
      case AuthJob.AuditLogPurger:
        console.log(`[Job] Running ${AuthJob.AuditLogPurger}`);
        await purgeExpiredAuditLogs();
        break;
    }
  },
  { connection },
);

worker.on("failed", (job, err) => {
  console.error(`[Job] ${job?.name} (id: ${job?.id}) failed:`, err.message);
});

export function registerBullBoard(app: any) {
  const serverAdapter = new FastifyAdapter();
  createBullBoard({
    queues: [new BullMQAdapter(queue)],
    serverAdapter,
  });
  serverAdapter.setBasePath("/admin/queues");
  app.register(serverAdapter.registerPlugin.bind(serverAdapter), {
    prefix: "/admin/queues",
  });
}

export async function startJobs() {
  await queue.add(AuthJob.TokenPurger, {}, { repeat: { every: 60 * 60 * 1000 } });

  await queue.add(
    AuthJob.AuditLogPurger,
    {},
    { repeat: { every: 24 * 60 * 60 * 1000 } },
  );
}

export async function stopJobs() {
  await worker.close();
  await queue.close();
  connection.disconnect();
}
