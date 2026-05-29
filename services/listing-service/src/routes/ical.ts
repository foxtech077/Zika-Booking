import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireProviderRole, type ProviderRequest } from "../middleware/auth.js";

// ── Minimal iCal parser ───────────────────────────────────────────────────────

interface IcalEvent {
  uid: string;
  summary: string;
  dtstart: Date;
  dtend: Date;
}

function parseIcal(text: string): IcalEvent[] {
  const events: IcalEvent[] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // Unfold continuation lines
  const unfolded: string[] = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line)) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }

  let current: Partial<IcalEvent> | null = null;
  for (const line of unfolded) {
    if (line === "BEGIN:VEVENT") {
      current = {};
    } else if (line === "END:VEVENT" && current) {
      if (current.dtstart && current.dtend) {
        events.push({
          // FIX #4: uid always non-null — generate deterministic fallback so upsert key never null
          uid: current.uid ?? `${current.dtstart.toISOString()}-${current.dtend.toISOString()}-fallback`,
          summary: current.summary ?? "Blocked",
          dtstart: current.dtstart,
          dtend: current.dtend,
        });
      }
      current = null;
    } else if (current) {
      const colonIdx = line.indexOf(":");
      if (colonIdx < 0) continue;
      const propName = line.slice(0, colonIdx).replace(/;[^:]+$/, "");
      const value = line.slice(colonIdx + 1).trim();

      if (propName === "UID") {
        current.uid = value;
      } else if (propName === "SUMMARY") {
        current.summary = value;
      } else if (propName.startsWith("DTSTART") || propName === "DTSTART") {
        current.dtstart = parseIcalDate(value);
      } else if (propName.startsWith("DTEND") || propName === "DTEND") {
        current.dtend = parseIcalDate(value);
      }
    }
  }
  return events;
}

function parseIcalDate(value: string): Date {
  // DATE-TIME: 20240115T100000Z or 20240115T100000
  // DATE: 20240115
  const cleaned = value.replace(/[^0-9TZ]/g, "");
  if (cleaned.length === 8) {
    return new Date(`${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`);
  }
  const year = cleaned.slice(0, 4);
  const month = cleaned.slice(4, 6);
  const day = cleaned.slice(6, 8);
  if (cleaned.length >= 15) {
    const hour = cleaned.slice(9, 11);
    const min = cleaned.slice(11, 13);
    const sec = cleaned.slice(13, 15);
    const isUtc = value.endsWith("Z");
    return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}${isUtc ? "Z" : ""}`);
  }
  return new Date(`${year}-${month}-${day}`);
}

// ── Alert helper (FIX #5: real alerting, not just console.error) ──────────────

async function sendSyncAlert(feedId: string, platform: string, failures: number, lastError: string) {
  // Pluggable alert — swap in Slack/email/PagerDuty webhook via env var
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;

  console.error(
    `[iCal Poller] ⚠️  ALERT: Feed ${feedId} (${platform}) has failed ${failures} consecutive times. ` +
    `Last error: ${lastError}. Manual intervention may be required.`
  );

  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 iCal Sync Alert`,
          feedId,
          platform,
          consecutiveFailures: failures,
          lastError,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch (alertErr) {
      console.error("[iCal Poller] Failed to send webhook alert:", alertErr);
    }
  }
}

// ── Sync helper ───────────────────────────────────────────────────────────────

export async function syncFeed(feedId: string): Promise<{ synced: number; error?: string }> {
  const feed = await prisma.icalFeed.findUnique({ where: { id: feedId } });
  if (!feed || !feed.isActive) return { synced: 0 };

  let text: string;
  try {
    const res = await fetch(feed.feedUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Fetch failed";
    const failures = feed.consecutiveFailures + 1;

    // Progressive backoff: 1min → 5min → 15min (PRD §3.6)
    const backoffMs = failures === 1 ? 60_000 : failures === 2 ? 5 * 60_000 : 15 * 60_000;
    const nextRetryAt = new Date(Date.now() + backoffMs);

    await prisma.icalFeed.update({
      where: { id: feedId },
      data: { lastError: msg, consecutiveFailures: failures, nextRetryAt, updatedAt: new Date() },
    });

    // FIX #5: Alert after 3 consecutive failures — use real alert helper
    if (failures >= 3) {
      await sendSyncAlert(feedId, feed.platform, failures, msg);
    }

    return { synced: 0, error: msg };
  }

  let events: IcalEvent[];
  try {
    events = parseIcal(text);
  } catch {
    const msg = "Failed to parse iCal data";
    const failures = feed.consecutiveFailures + 1;
    const backoffMs = failures === 1 ? 60_000 : failures === 2 ? 5 * 60_000 : 15 * 60_000;
    const nextRetryAt = new Date(Date.now() + backoffMs);
    await prisma.icalFeed.update({
      where: { id: feedId },
      data: { lastError: msg, consecutiveFailures: failures, nextRetryAt, updatedAt: new Date() },
    });
    if (failures >= 3) {
      await sendSyncAlert(feedId, feed.platform, failures, msg);
    }
    return { synced: 0, error: msg };
  }

  // Upsert blocked dates — UID is idempotency key (PRD §3.6)
  let synced = 0;
  for (const ev of events) {
    await prisma.icalBlockedDate.upsert({
      where: { feedId_uid: { feedId, uid: ev.uid } },
      update: { startDate: ev.dtstart, endDate: ev.dtend, summary: ev.summary },
      create: {
        feedId,
        listingId: feed.listingId,
        startDate: ev.dtstart,
        endDate: ev.dtend,
        summary: ev.summary,
        uid: ev.uid,
      },
    });
    synced++;
  }

  // Reset failure counters on success
  await prisma.icalFeed.update({
    where: { id: feedId },
    data: { lastSyncedAt: new Date(), lastError: null, consecutiveFailures: 0, nextRetryAt: null, updatedAt: new Date() },
  });

  return { synced };
}

// ── Derive channel status from feed state (FIX #2) ────────────────────────────

function deriveFeedStatus(feed: {
  lastSyncedAt: Date | null;
  lastError: string | null;
  consecutiveFailures: number;
}): "synced" | "error" | "pending" {
  if (feed.consecutiveFailures >= 1 || feed.lastError) return "error";
  if (feed.lastSyncedAt) return "synced";
  return "pending";
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function icalRoutes(app: FastifyInstance) {

  // ── GET /listings/:id/ical-feeds — list provider's iCal feeds ─────────────
  app.get("/listings/:id/ical-feeds", { schema: { tags: ["iCal Calendar Sync"] }, preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const providerId = (req as ProviderRequest).providerId;

    const listing = await prisma.listing.findFirst({ where: { id, providerId, deletedAt: null } });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

    const feeds = await prisma.icalFeed.findMany({
      where: { listingId: id },
      orderBy: { createdAt: "desc" },
    });

    return sendSuccess(reply, 200, {
      feeds: feeds.map((f) => ({
        id: f.id,
        platform: f.platform,
        feedUrl: f.feedUrl,
        isActive: f.isActive,
        // FIX #2: derive status field for host dashboard channels panel
        status: deriveFeedStatus(f),
        lastSyncedAt: f.lastSyncedAt?.toISOString() ?? null,
        lastError: f.lastError,
        consecutiveFailures: f.consecutiveFailures,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  });

  // ── POST /listings/:id/ical-feeds — add a new iCal feed ───────────────────
  app.post("/listings/:id/ical-feeds", { schema: { tags: ["iCal Calendar Sync"] }, preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const providerId = (req as ProviderRequest).providerId;
    const body = req.body as { platform: string; feedUrl: string };

    if (!body.platform || !body.feedUrl) {
      return sendError(reply, 400, "VALIDATION_ERROR", "platform and feedUrl are required.");
    }

    try {
      new URL(body.feedUrl);
    } catch {
      return sendError(reply, 400, "VALIDATION_ERROR", "feedUrl must be a valid URL.");
    }

    const listing = await prisma.listing.findFirst({ where: { id, providerId, deletedAt: null } });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

    // FIX (minor): Prevent duplicate feed URLs for same listing
    const existing = await prisma.icalFeed.findFirst({ where: { listingId: id, feedUrl: body.feedUrl } });
    if (existing) {
      return sendError(reply, 409, "CONFLICT", "This feed URL is already connected to this listing.");
    }

    const feed = await prisma.icalFeed.create({
      data: {
        listingId: id,
        platform: body.platform,
        feedUrl: body.feedUrl,
      },
    });

    // Trigger initial sync in background
    syncFeed(feed.id).catch(() => null);

    return sendSuccess(reply, 201, {
      id: feed.id,
      platform: feed.platform,
      feedUrl: feed.feedUrl,
      isActive: feed.isActive,
      // FIX #2: return status on create
      status: "pending" as const,
      lastSyncedAt: null,
      consecutiveFailures: 0,
      createdAt: feed.createdAt.toISOString(),
    });
  });

  // ── DELETE /listings/:id/ical-feeds/:feedId — remove an iCal feed ─────────
  app.delete("/listings/:id/ical-feeds/:feedId", { schema: { tags: ["iCal Calendar Sync"] }, preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id, feedId } = req.params as { id: string; feedId: string };
    const providerId = (req as ProviderRequest).providerId;

    const listing = await prisma.listing.findFirst({ where: { id, providerId, deletedAt: null } });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

    const feed = await prisma.icalFeed.findFirst({ where: { id: feedId, listingId: id } });
    if (!feed) return sendError(reply, 404, "NOT_FOUND", "Feed not found.");

    await prisma.icalFeed.delete({ where: { id: feedId } });

    return sendSuccess(reply, 200, { message: "Feed removed." });
  });

  // ── POST /listings/:id/ical-feeds/:feedId/sync — manual sync trigger ───────
  app.post("/listings/:id/ical-feeds/:feedId/sync", { schema: { tags: ["iCal Calendar Sync"] }, preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id, feedId } = req.params as { id: string; feedId: string };
    const providerId = (req as ProviderRequest).providerId;

    const listing = await prisma.listing.findFirst({ where: { id, providerId, deletedAt: null } });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

    const feed = await prisma.icalFeed.findFirst({ where: { id: feedId, listingId: id } });
    if (!feed) return sendError(reply, 404, "NOT_FOUND", "Feed not found.");

    const result = await syncFeed(feedId);

    if (result.error) {
      return sendSuccess(reply, 200, { synced: 0, error: result.error, message: "Sync failed — check the feed URL." });
    }

    return sendSuccess(reply, 200, { synced: result.synced, message: `Synced ${result.synced} events.` });
  });

  // ── GET /listings/:id/blocked-dates — external blocked dates + held dates ──
  // FIX #3: Returns ical-blocked dates, confirmed bookings (green),
  // and pending_payment bookings as "held" (amber) — per PRD §3.6
  app.get("/listings/:id/blocked-dates", { schema: { tags: ["iCal Calendar Sync"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { from, to } = req.query as { from?: string; to?: string };

    const dateFilter = {
      ...(from ? { startDate: { gte: new Date(from) } } : {}),
      ...(to ? { endDate: { lte: new Date(to) } } : {}),
    };

    // 1. iCal-blocked dates from external feeds (grey)
    const externalBlocked = await prisma.icalBlockedDate.findMany({
      where: { listingId: id, ...dateFilter },
      include: { feed: { select: { platform: true } } },
      orderBy: { startDate: "asc" },
    });

    // 2. Confirmed bookings (green)
    const confirmedBookings = await prisma.booking.findMany({
      where: {
        listingId: id,
        status: "confirmed",
        ...(from ? { checkIn: { gte: new Date(from) } } : {}),
        ...(to ? { checkOut: { lte: new Date(to) } } : {}),
      },
      select: { id: true, checkIn: true, checkOut: true, pickupDatetime: true, returnDatetime: true, reference: true },
      orderBy: { checkIn: "asc" },
    });

    // 3. FIX #3: Pending payment bookings (amber "Held")
    const heldBookings = await prisma.booking.findMany({
      where: {
        listingId: id,
        status: "pending_payment",
        ...(from ? { checkIn: { gte: new Date(from) } } : {}),
        ...(to ? { checkOut: { lte: new Date(to) } } : {}),
      },
      select: { id: true, checkIn: true, checkOut: true, pickupDatetime: true, returnDatetime: true, reference: true },
      orderBy: { checkIn: "asc" },
    });

    const toDateStr = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

    return sendSuccess(reply, 200, {
      blockedDates: [
        // External iCal blocked (grey)
        ...externalBlocked.map((b) => ({
          id: b.id,
          type: "blocked" as const,       // grey
          startDate: toDateStr(b.startDate),
          endDate: toDateStr(b.endDate),
          summary: b.summary,
          // FIX (minor): return actual platform instead of hardcoded "external"
          platform: b.feed?.platform ?? "external",
        })),
        // Confirmed bookings (green)
        ...confirmedBookings.map((b) => ({
          id: b.id,
          type: "confirmed" as const,     // green
          startDate: toDateStr(b.checkIn ?? b.pickupDatetime),
          endDate: toDateStr(b.checkOut ?? b.returnDatetime),
          summary: `Booking ${b.reference}`,
          platform: "zikabooking",
        })),
        // Held / pending payment (amber)
        ...heldBookings.map((b) => ({
          id: b.id,
          type: "held" as const,          // amber
          startDate: toDateStr(b.checkIn ?? b.pickupDatetime),
          endDate: toDateStr(b.checkOut ?? b.returnDatetime),
          summary: `Held ${b.reference}`,
          platform: "zikabooking",
        })),
      ].sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? "")),
    });
  });

  // ── GET /listings/:id/channel-status — host dashboard channels panel ────────
  // FIX #2: New endpoint — returns per-OTA sync status for the host dashboard
  app.get("/listings/:id/channel-status", { schema: { tags: ["iCal Calendar Sync"] }, preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const providerId = (req as ProviderRequest).providerId;

    const listing = await prisma.listing.findFirst({ where: { id, providerId, deletedAt: null } });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

    const feeds = await prisma.icalFeed.findMany({
      where: { listingId: id, isActive: true },
      include: {
        blockedDates: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return sendSuccess(reply, 200, {
      channels: feeds.map((f) => ({
        id: f.id,
        platform: f.platform,
        // "synced" | "error" | "pending"
        status: deriveFeedStatus(f),
        lastSyncedAt: f.lastSyncedAt?.toISOString() ?? null,
        lastError: f.lastError,
        consecutiveFailures: f.consecutiveFailures,
        // how many date-ranges imported from this feed
        blockedDatesImported: f.blockedDates.length,
        nextRetryAt: f.nextRetryAt?.toISOString() ?? null,
      })),
    });
  });

  // ── GET /listings/:id/ical — outbound iCal export (public) ─────────────────
  // Returns a standards-compliant .ics feed of all confirmed bookings so
  // external calendars (Airbnb, Google Calendar, etc.) can subscribe to it.
  app.get("/listings/:id/ical", async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const listing = await prisma.listing.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, name: true, status: true },
    });

    if (!listing) {
      return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
    }

    const validStatuses = ["approved", "active"];
    if (!validStatuses.includes(listing.status)) {
      return reply.status(410).send({ success: false, error: { code: "LISTING_INACTIVE", message: "This listing is not available." } });
    }

    // Fetch only confirmed bookings (no pending/cancelled)
    const bookings = await prisma.booking.findMany({
      where: { listingId: id, status: "confirmed" },
      select: {
        id: true,
        reference: true,
        checkIn: true,
        checkOut: true,
        pickupDatetime: true,
        returnDatetime: true,
        guestFirstName: true,
        guestLastName: true,
        confirmedAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Helper: format a Date as iCal UTC datetime string (YYYYMMDDTHHmmssZ)
    function toIcalUtc(d: Date): string {
      return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    }

    // Helper: fold long iCal lines at 75 octets per RFC 5545 §3.1
    function foldLine(line: string): string {
      const bytes = Buffer.from(line, "utf8");
      if (bytes.length <= 75) return line;
      const chunks: string[] = [];
      let offset = 0;
      let first = true;
      while (offset < bytes.length) {
        const chunkSize = first ? 75 : 74;
        chunks.push((first ? "" : " ") + bytes.slice(offset, offset + chunkSize).toString("utf8"));
        offset += chunkSize;
        first = false;
      }
      return chunks.join("\r\n");
    }

    const prodId = "-//ZikaBooking//Listing Service//EN";
    const now = toIcalUtc(new Date());
    const listingName = (listing.name ?? "ZikaBooking").replace(/[\\;,]/g, "\\$&");

    const vevents = bookings.map((b) => {
      const dtstart = b.checkIn ?? b.pickupDatetime;
      const dtend = b.checkOut ?? b.returnDatetime;
      if (!dtstart || !dtend) return "";

      // UID is deterministic: booking reference + listing id (idempotency key)
      const uid = `${b.reference}@${id}.zikabooking`;
      const dtstamp = toIcalUtc(b.updatedAt ?? new Date());
      const created = toIcalUtc(b.confirmedAt ?? new Date());
      const summary = foldLine(`SUMMARY:Booking - ${listingName}`);
      const guestName = `${b.guestFirstName} ${b.guestLastName}`.trim();
      const description = foldLine(`DESCRIPTION:Guest: ${guestName}\\nRef: ${b.reference}`);

      return [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `CREATED:${created}`,
        `DTSTART:${toIcalUtc(dtstart)}`,
        `DTEND:${toIcalUtc(dtend)}`,
        summary,
        description,
        "TRANSP:OPAQUE",      // BUSY — blocks availability on external calendars
        "STATUS:CONFIRMED",
        "END:VEVENT",
      ].join("\r\n");
    }).filter(Boolean);

    const icsBody = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      `PRODID:${prodId}`,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${listingName}`,
      `X-WR-CALDESC:Confirmed bookings for ${listingName}`,
      "X-WR-TIMEZONE:UTC",
      `LAST-MODIFIED:${now}`,
      ...vevents,
      "END:VCALENDAR",
    ].join("\r\n") + "\r\n";

    reply
      .header("Content-Type", "text/calendar; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="listing-${id}.ics"`)
      .header("Cache-Control", "no-cache")
      .status(200)
      .send(icsBody);
  });
}

// ── Background polling (15-min cycle) ────────────────────────────────────────
// FIX #1 (Critical): Actually calls syncFeed() for each active feed.
// FIX (minor): Poll interval driven by env var — ICAL_POLL_INTERVAL_MS
// Phase 2 TODO: Replace polling with Airbnb Connect API + Booking.com
//               Connectivity API push-based sync (<1 min latency) — PRD §3.6

export function startIcalPoller() {
  const POLL_INTERVAL_MS = parseInt(process.env.ICAL_POLL_INTERVAL_MS ?? "") || 15 * 60 * 1000;

  async function poll() {
    try {
      const feeds = await prisma.icalFeed.findMany({
        where: { isActive: true },
        select: { id: true, consecutiveFailures: true, nextRetryAt: true },
      });

      const now = new Date();
      for (const feed of feeds) {
        // Respect progressive backoff — skip if nextRetryAt is still in the future
        if (feed.nextRetryAt && feed.nextRetryAt > now) {
          console.log(`[iCal Poller] Skipping feed ${feed.id} — next retry at ${feed.nextRetryAt.toISOString()}`);
          continue;
        }

        // FIX #1: Actually sync the feed (was missing before!)
        try {
          const result = await syncFeed(feed.id);
          if (result.error) {
            console.warn(`[iCal Poller] Feed ${feed.id} sync error: ${result.error}`);
          } else {
            console.log(`[iCal Poller] Feed ${feed.id} synced ${result.synced} events.`);
          }
        } catch (syncErr) {
          console.error(`[iCal Poller] Unexpected error for feed ${feed.id}:`, syncErr);
        }
      }
    } catch (error) {
      console.warn("[iCal Poller] DB error (will retry):", error instanceof Error ? error.message : error);
    }
  }

  setInterval(() => { poll().catch(() => null); }, POLL_INTERVAL_MS);

  // Start polling with a small delay to avoid connection errors on startup
  setTimeout(() => {
    poll().catch(() => null);
  }, 5000);

  console.log(`[iCal Poller] Started — polling every ${POLL_INTERVAL_MS / 1000}s`);
}