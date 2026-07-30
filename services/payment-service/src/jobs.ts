import { Queue, Worker } from "bullmq";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import Redis from "ioredis";
import { processEligiblePayouts } from "./services/payout.service.js";
import { processFailedRefundNotifications } from "./services/refund.service.js";

// Dedicated connection for BullMQ — must use maxRetriesPerRequest: null
// (Worker's blocking commands conflict with non-null retry settings).
const connection = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
});

const queue = new Queue("payment-jobs", { connection });

const worker = new Worker(
  "payment-jobs",
  async (job) => {
    switch (job.name) {
      case "payout-job":
        // TODO: Can be precision-delayed — schedule per payout at creation time
        console.log("[Job] Running payout-job");
        await processEligiblePayouts();
        break;
      case "refund-retry-job":
        console.log("[Job] Running refund-retry-job");
        await processFailedRefundNotifications();
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
  await queue.add("payout-job", {}, { repeat: { every: 60_000 } });
  await queue.add("refund-retry-job", {}, { repeat: { every: 60_000 } });
}

export async function stopJobs() {
  await worker.close();
  await queue.close();
  connection.disconnect();
}
