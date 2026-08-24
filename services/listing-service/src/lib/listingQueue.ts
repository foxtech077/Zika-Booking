import { Queue } from "bullmq";
import Redis from "ioredis";
import { QueueName } from "@zika/types";

// Dedicated BullMQ connection. Workers require maxRetriesPerRequest: null.
export const listingQueueConnection = new Redis(
  process.env["REDIS_URL"] ?? "redis://localhost:6379",
  { maxRetriesPerRequest: null, enableReadyCheck: false, lazyConnect: false },
);

export const listingQueue = new Queue(QueueName.Listing, {
  connection: listingQueueConnection,
});

export const listingJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 30_000 },
  removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
  removeOnFail: { age: 7 * 24 * 60 * 60 },
};
