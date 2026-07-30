import { Queue, Worker } from "bullmq";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import Redis from "ioredis";
import { cancelStalePendingPayments } from "./lib/pendingPaymentCanceller.js";
import { completeEligibleBookings } from "./lib/bookingCompletionScheduler.js";
import { checkVoucherExpiryWarnings } from "./lib/voucherExpiryWarner.js";
import { pollIcalFeeds } from "./routes/ical.js";
import { promotePendingRates } from "./lib/commissionScheduler.js";
import { expireStaleGeoVerifications } from "./lib/geoVerificationExpirer.js";

// Dedicated connection for BullMQ — must use maxRetriesPerRequest: null
// (Worker's blocking commands conflict with non-null retry settings).
const connection = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
});

const queue = new Queue("listing-jobs", { connection });

const worker = new Worker(
  "listing-jobs",
  async (job) => {
    switch (job.name) {
      case "pending-payment-canceller":
        // TODO: Can be precision-delayed — schedule at booking creation time instead
        await cancelStalePendingPayments();
        break;
      case "booking-completion":
        // TODO: Can be precision-delayed — schedule at checkout time instead
        await completeEligibleBookings();
        break;
      case "voucher-expiry-warner":
        await checkVoucherExpiryWarnings();
        break;
      case "ical-poller":
        await pollIcalFeeds();
        break;
      case "commission-scheduler":
        await promotePendingRates();
        break;
      case "geo-verification-expirer":
        await expireStaleGeoVerifications();
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
  await queue.add("pending-payment-canceller", {}, { repeat: { every: 60_000 } });
  await queue.add("booking-completion", {}, { repeat: { every: 300_000 } });
  await queue.add("voucher-expiry-warner", {}, { repeat: { every: 4 * 60 * 60 * 1000 } });
  await queue.add("ical-poller", {}, { repeat: { every: 15 * 60 * 1000 } });
  await queue.add("commission-scheduler", {}, { repeat: { every: 60 * 60 * 1000 } });
  await queue.add("geo-verification-expirer", {}, { repeat: { every: 2 * 60 * 60 * 1000 } });
}

export async function stopJobs() {
  await worker.close();
  await queue.close();
  connection.disconnect();
}
