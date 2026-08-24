import { Queue, Worker } from "bullmq";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import Redis from "ioredis";
import { processEligiblePayouts } from "./services/payout.service.js";
import { processFailedRefundNotifications } from "./services/refund.service.js";
import { cancelStaleStripePayments } from "./services/cancelStalePayments.service.js";
import {
  processEmailJob,
  reconcileEmailDeliveries,
} from "./services/emailRetry.service.js";
import { sendAdminAlert } from "./services/email.services.js";
import { QueueName, PaymentJob } from "@zika/types";

// Dedicated connection for BullMQ — must use maxRetriesPerRequest: null
// (Worker's blocking commands conflict with non-null retry settings).
const connection = new Redis(
  process.env["REDIS_URL"] ?? "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  },
);

const queue = new Queue(QueueName.Payment, { connection });
const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 30_000 },
  removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
  removeOnFail: { age: 7 * 24 * 60 * 60 },
};

const worker = new Worker(
  QueueName.Payment,
  async (job) => {
    switch (job.name as PaymentJob) {
      case PaymentJob.PayoutJob:
        // TODO: Can be precision-delayed — schedule per payout at creation time
        console.log(`[Job] Running ${PaymentJob.PayoutJob}`);
        await processEligiblePayouts();
        break;
      case PaymentJob.RefundRetryJob:
        console.log(`[Job] Running ${PaymentJob.RefundRetryJob}`);
        await processFailedRefundNotifications();
        break;
      case PaymentJob.StalePaymentCanceller:
        console.log(`[Job] Running ${PaymentJob.StalePaymentCanceller}`);
        await cancelStaleStripePayments();
        break;
      case PaymentJob.EmailRetryJob:
        console.log(`[Job] Running ${PaymentJob.EmailRetryJob}`);
        await processEmailJob(
          job.data as { paymentId: string; kind: "guest" | "host" },
        );
        break;
      case PaymentJob.EmailReconciliationJob:
        console.log(`[Job] Running ${PaymentJob.EmailReconciliationJob}`);
        await reconcileEmailDeliveries();
        break;
    }
  },
  { connection },
);

worker.on("failed", (job, err) => {
  console.error(`[Job] ${job?.name} (id: ${job?.id}) failed:`, err?.message);

  // Alert admins when a confirmation email job is permanently exhausted. The
  // old in-process retry alerted after 3 attempts; this restores that
  // visibility now that retries live in BullMQ.
  if (job && job.name === PaymentJob.EmailRetryJob) {
    const { paymentId, kind } = (job.data ?? {}) as {
      paymentId?: string;
      kind?: string;
    };
    const attempts = job.attemptsMade ?? 0;
    const max = job.opts?.attempts ?? 1;
    if (attempts >= max) {
      sendAdminAlert(
        `Confirmation email permanently failed — payment ${paymentId ?? "?"} | kind: ${kind ?? "?"} | attempts: ${attempts}`,
        err,
      ).catch((alertErr) =>
        console.error("[email-job] admin alert failed:", alertErr),
      );
    }
  }
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
  await queue.add(
    PaymentJob.PayoutJob,
    {},
    { ...defaultJobOptions, repeat: { every: 60_000 } },
  );
  await queue.add(
    PaymentJob.RefundRetryJob,
    {},
    { ...defaultJobOptions, repeat: { every: 60_000 } },
  );
  await queue.add(
    PaymentJob.StalePaymentCanceller,
    {},
    { ...defaultJobOptions, repeat: { every: 60_000 } },
  );
  await queue.add(
    PaymentJob.EmailReconciliationJob,
    {},
    {
      ...defaultJobOptions,
      repeat: { every: 5 * 60_000 },
      jobId: "email-reconciliation",
    },
  );
}

export async function stopJobs() {
  await worker.close();
  await queue.close();
  connection.disconnect();
}
