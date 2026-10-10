import { Queue } from "bullmq";
import { QueueName, PaymentJob } from "@zika/types";
import Redis from "ioredis";

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

// Shares the Payment queue (QueueName.Payment) so the existing worker in
// jobs.ts processes these jobs alongside payouts / refund-retries.
export const emailQueue = new Queue(QueueName.Payment, {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 1000, age: 24 * 60 * 60 },
    removeOnFail: { count: 5000, age: 7 * 24 * 60 * 60 },
  },
});

export async function closeEmailQueue(): Promise<void> {
  await emailQueue.close();
  connection.disconnect();
}

export type EmailKind = "guest" | "host";

/**
 * Enqueue a durable email-delivery job. A deterministic job id
 * (`email-${kind}-${paymentId}`) makes re-enqueues idempotent: a duplicate
 * (e.g. from a webhook redelivery or the reconciliation sweep) will not create
 * a second in-flight job. Unlike the previous in-process `setTimeout` retry,
 * these jobs survive process restarts, deploys and replica switches.
 */
export async function enqueueEmailJob(
  paymentId: string,
  kind: EmailKind,
): Promise<void> {
  const jobId = `email-${kind}-${paymentId}`;
  // Retention keeps terminal jobs around, which would block a re-add under the
  // same deterministic job id. Clear a terminal predecessor so the
  // reconciliation sweep can re-enqueue after a permanent failure.
  const existing = await emailQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (["completed", "failed"].includes(state)) {
      try {
        await existing.remove();
      } catch {
        return;
      }
    } else {
      return;
    }
  }
  await emailQueue.add(
    PaymentJob.EmailRetryJob,
    { paymentId, kind },
    {
      jobId,
      attempts: 5,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: { count: 1000, age: 24 * 60 * 60 },
      removeOnFail: { count: 5000, age: 7 * 24 * 60 * 60 },
      // The worker's `failed` handler alerts admins on final attempt (see jobs.ts).
    },
  );
}
