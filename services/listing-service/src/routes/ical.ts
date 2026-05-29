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
          uid: current.uid ?? `${current.dtstart.toISOString()}-${Math.random()}`,
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
  // Full datetime
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
    await prisma.icalFeed.update({ where: { id: feedId }, data: { lastError: msg, updatedAt: new Date() } });
    return { synced: 0, error: msg };
  }

  let events: IcalEvent[];
  try {
    events = parseIcal(text);
  } catch {
    const msg = "Failed to parse iCal data";
    await prisma.icalFeed.update({ where: { id: feedId }, data: { lastError: msg, updatedAt: new Date() } });
    return { synced: 0, error: msg };
  }

  // Upsert blocked dates
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

  await prisma.icalFeed.update({
    where: { id: feedId },
    data: { lastSyncedAt: new Date(), lastError: null, updatedAt: new Date() },
  });

  return { synced };
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function icalRoutes(app: FastifyInstance) {
  // ── GET /listings/:id/ical-feeds — list provider's iCal feeds ─────────
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
        lastSyncedAt: f.lastSyncedAt?.toISOString() ?? null,
        lastError: f.lastError,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  });

  // ── POST /listings/:id/ical-feeds — add a new iCal feed ───────────────
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

    const feed = await prisma.icalFeed.create({
      data: {
        listingId: id,
        platform: body.platform,
        feedUrl: body.feedUrl,
      },
    });

    // Trigger initial sync
    syncFeed(feed.id).catch(() => null);

    return sendSuccess(reply, 201, {
      id: feed.id,
      platform: feed.platform,
      feedUrl: feed.feedUrl,
      isActive: feed.isActive,
      lastSyncedAt: null,
      createdAt: feed.createdAt.toISOString(),
    });
  });

  // ── DELETE /listings/:id/ical-feeds/:feedId — remove an iCal feed ─────
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

  // ── POST /listings/:id/ical-feeds/:feedId/sync — manual sync trigger ──
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

  // ── GET /listings/:id/blocked-dates — get external blocked date ranges ─
  app.get("/listings/:id/blocked-dates", { schema: { tags: ["iCal Calendar Sync"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { from, to } = req.query as { from?: string; to?: string };

    const blocked = await prisma.icalBlockedDate.findMany({
      where: {
        listingId: id,
        ...(from ? { startDate: { gte: new Date(from) } } : {}),
        ...(to ? { endDate: { lte: new Date(to) } } : {}),
      },
      orderBy: { startDate: "asc" },
    });

    return sendSuccess(reply, 200, {
      blockedDates: blocked.map((b) => ({
        id: b.id,
        startDate: b.startDate.toISOString().slice(0, 10),
        endDate: b.endDate.toISOString().slice(0, 10),
        summary: b.summary,
        platform: "external",
      })),
    });
  });

  // ── GET /listings/:id/ical — outbound iCal export (public) ────────────
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
      where: {
        listingId: id,
        status: "confirmed",
      },
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
      const dtend   = b.checkOut ?? b.returnDatetime;
      if (!dtstart || !dtend) return "";

      // UID is deterministic: booking reference + listing id
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
        "TRANSP:OPAQUE",
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
      `X-WR-TIMEZONE:UTC`,
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

export function startIcalPoller() {
  const POLL_INTERVAL_MS = 15 * 60 * 1000;
  // Track consecutive failures per feed
  const failureCounts = new Map<string, number>();

  async function poll() {
    try {
      const feeds = await prisma.icalFeed.findMany({
        where: { isActive: true },
        select: { id: true, lastError: true, updatedAt: true },
      });

      const now = new Date();
      for (const feed of feeds) {
        const failures = failureCounts.get(feed.id) ?? 0;

        if (feed.lastError && feed.updatedAt) {
          const ageMinutes = (now.getTime() - feed.updatedAt.getTime()) / 60_000;
          // Backoff: 1 failure = wait 1min, 2 = wait 5min, 3+ = wait 15min + alert
          const backoffMinutes = failures === 1 ? 1 : failures === 2 ? 5 : 15;
          if (ageMinutes < backoffMinutes) {
            console.log(`[iCal Poller] Backoff feed ${feed.id} (failure #${failures}, wait ${backoffMinutes}min)`);
            continue;
          }
          if (failures >= 3) {
            console.error(`[iCal Poller] ALERT: feed ${feed.id} has failed ${failures} consecutive times`);
            // TODO: wire to alerting system (PagerDuty / Slack)
          }
        }

        const result = await syncFeed(feed.id).catch((e) => ({ synced: 0, error: String(e) }));
        if (result.error) {
          failureCounts.set(feed.id, failures + 1);
        } else {
          failureCounts.set(feed.id, 0); // reset on success
        }
      }
    } catch (error) {
      console.warn("[iCal Poller] DB error (will retry):", error instanceof Error ? error.message : error);
    }
  }

  setInterval(() => { poll().catch(() => null); }, POLL_INTERVAL_MS);
  setTimeout(() => { poll().catch(() => null); }, 5000);
}