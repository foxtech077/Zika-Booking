const BOOKING_SERVICE_URL =
  process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";
const INTERNAL_SERVICE_KEY = process.env["INTERNAL_SERVICE_KEY"] ?? "";

/**
 * Human-readable, structured "why is this payout where it is" classification.
 * Resolved at read time from the booking (listing service) + merchant row, so
 * admins always see the current reason instead of a stale stored failureReason.
 */

export type PayoutFlowState =
  | "awaiting_checkout"
  | "awaiting_merchant_setup"
  | "awaiting_merchant_verification"
  | "merchant_inactive"
  | "booking_cancelled_or_refunded"
  | "manual_disbursement_required"
  | "ready_for_payout"
  | "paid"
  | "processing"
  | "failed"
  | "cancelled"
  | "unknown";

export interface BookingStatusInfo {
  id: string;
  status: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  listingType?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  pickupDatetime?: string | null;
  returnDatetime?: string | null;
}

export interface FlowStateResult {
  flowState: PayoutFlowState;
  label: string;
  reason: string;
}

const BOOKING_CANCELLED_STATUSES = new Set([
  "cancelled_by_guest",
  "cancelled_by_provider",
  "cancelled_by_system",
]);

function merchantSetupState(merchant: {
  isActive?: boolean | null;
  isVerified?: boolean | null;
  payoutMethod?: string | null;
  stripeConnectAccountId?: string | null;
  mobileMoneyNumber?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
}): { flowState: PayoutFlowState; label: string; reason: string } | null {
  if (merchant.isActive === false) {
    return {
      flowState: "merchant_inactive",
      label: "Merchant inactive",
      reason:
        "This merchant has been deactivated. Reactivate them before a payout can be disbursed.",
    };
  }

  if (!merchant.isVerified) {
    return {
      flowState: "awaiting_merchant_verification",
      label: "Awaiting merchant verification",
      reason:
        "Checkout is complete but the merchant has not been verified by an admin yet. Verify them in Merchant Management to release this payout.",
    };
  }

  const method = merchant.payoutMethod;
  const methodReady =
    (method === "stripe_connect" && !!merchant.stripeConnectAccountId) ||
    (method === "bank_transfer" &&
      !!merchant.bankName &&
      !!merchant.bankAccountNumber &&
      !!merchant.bankAccountName) ||
    (method === "mobile_money" && !!merchant.mobileMoneyNumber) ||
    method === "manual";

  if (!method || !methodReady) {
    return {
      flowState: "awaiting_merchant_setup",
      label: "Awaiting merchant payout setup",
      reason:
        "Checkout is complete but the merchant has not configured a valid payout method yet. Ask them to set up Stripe Connect, bank transfer, or mobile money in Payment Options.",
    };
  }

  return null;
}

/**
 * Build a human-facing flow state + reason for a payout. The booking status is
 * resolved live from the listing service; the merchant state comes from the
 * already-loaded merchant row (never cross-service).
 */
export async function resolvePayoutFlowState(
  payout: {
    id: string;
    status: string;
    bookingId: string;
    createdAt?: Date | string | null;
    failureReason?: string | null;
    scheduledAt?: Date | string | null;
    processedAt?: Date | string | null;
  },
  merchant: {
    isActive?: boolean | null;
    isVerified?: boolean | null;
    payoutMethod?: string | null;
    stripeConnectAccountId?: string | null;
    mobileMoneyNumber?: string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
  } | null,
  booking?: BookingStatusInfo | null,
): Promise<FlowStateResult> {
  // Always classify resolved states first regardless of the booking/merchant.
  if (payout.status === "paid") {
    return {
      flowState: "paid",
      label: "Paid",
      reason:
        payout.processedAt
          ? `Payout settled on ${new Date(payout.processedAt).toLocaleString()}.`
          : "Payout has been settled.",
    };
  }
  if (payout.status === "processing") {
    const method = merchant?.payoutMethod;
    const isOfflineMethod =
      method === "bank_transfer" ||
      method === "mobile_money" ||
      !method ||
      method === "manual";
    if (isOfflineMethod) {
      return {
        flowState: "manual_disbursement_required",
        label: "Manual disbursement required",
        reason:
          "The stay is complete and funds are ready, but this merchant uses an offline payout method (bank transfer / mobile money / manual). An admin must execute the transfer and click 'Mark Paid' to settle this payout.",
      };
    }
    return {
      flowState: "processing",
      label: "Processing",
      reason:
        "This payout is being processed automatically (Stripe Connect). It will settle shortly.",
    };
  }
  if (payout.status === "failed") {
    return {
      flowState: "failed",
      label: "Failed",
      reason:
        payout.failureReason || "The payout attempt failed. Retry after resolving the reason below.",
    };
  }
  if (payout.status === "cancelled") {
    return {
      flowState: "cancelled",
      label: "Cancelled",
      reason:
        payout.failureReason ||
        "This payout was cancelled and will not be disbursed.",
    };
  }

  // Booking-level blockers (only meaningful while the payout is still pending).
  if (booking) {
    if (
      booking.status &&
      BOOKING_CANCELLED_STATUSES.has(booking.status)
    ) {
      return {
        flowState: "booking_cancelled_or_refunded",
        label: "Booking cancelled",
        reason: `The booking is ${booking.status.replace(/_/g, " ")}. This payout will not be disbursed.`,
      };
    }

    // Mirror the payout job's disbursement eligibility. Non-legacy payouts
    // disburse only once the booking is "completed"; legacy rows (created
    // before the cutoff) can also disburse from confirmed / checked_in.
    const isLegacy =
      !payout.createdAt ||
      new Date(payout.createdAt) < new Date("2026-06-27T12:00:00.000Z");
    const disbursableStatuses = isLegacy
      ? ["checked_in", "completed", "confirmed"]
      : ["completed"];

    const stayComplete =
      booking.status === "completed"
        ? !!booking.completedAt && Date.parse(booking.completedAt) <= Date.now()
        : disbursableStatuses.includes(booking.status ?? "");

    if (!stayComplete) {
      const checkoutDate =
        booking.returnDatetime ||
        booking.checkOut ||
        booking.pickupDatetime ||
        booking.checkIn;
      return {
        flowState: "awaiting_checkout",
        label: "Awaiting stay completion",
        reason: checkoutDate
          ? `The guest's stay has not completed yet (checkout ${new Date(checkoutDate).toLocaleDateString()}). Payout becomes eligible after checkout.`
          : "The guest's stay has not completed yet. Payout becomes eligible after checkout.",
      };
    }
  } else if (payout.status === "pending" || payout.status === "scheduled") {
    // Booking info is required to distinguish an un-completed stay from a
    // merchant-side blocker. If it's unavailable (e.g. listing-service fetch
    // failed), avoid mislabelling — show an explicit resolving state instead.
    return {
      flowState: "unknown",
      label: "Resolving state",
      reason:
        "Could not confirm whether this guest's stay has completed. Re-check shortly; if this persists, investigate the linked booking.",
    };
  }

  // Checkout is complete (or booking info unavailable) — merchant-side blockers.
  const merchantBlocker = merchantSetupState(merchant ?? {});
  if (merchantBlocker) return merchantBlocker;

  // If we reach here, checkout is complete and the merchant is ready.
  if (payout.status === "pending" || payout.status === "scheduled") {
    const method = merchant?.payoutMethod;
    const isOfflineMethod =
      method === "bank_transfer" ||
      method === "mobile_money" ||
      method === "manual";
    if (isOfflineMethod) {
      return {
        flowState: "manual_disbursement_required",
        label: "Manual disbursement required",
        reason:
          "The stay is complete and the merchant payout method is ready, but this merchant uses an offline method (bank transfer / mobile money / manual). An admin must execute the transfer and click 'Mark Paid' to settle this payout.",
      };
    }
    return {
      flowState: "ready_for_payout",
      label: "Ready for payout",
      reason:
        "Checkout is complete and the merchant's Stripe Connect is ready. The payout processor will disburse this automatically on its next run.",
    };
  }

  return {
    flowState: "unknown",
    label: "Unknown state",
    reason: "Unable to determine the current payout state.",
  };
}

/**
 * Batch-resolve booking status metadata for many booking ids from the listing
 * service. Resilient: any failure returns an empty map (callers degrade to
 * merchant-only classification).
 */
export async function fetchBookingsStatusBatch(
  bookingIds: string[],
): Promise<Map<string, BookingStatusInfo>> {
  const map = new Map<string, BookingStatusInfo>();
  const ids = [...new Set(bookingIds.filter(Boolean))];
  if (ids.length === 0) return map;

  try {
    const res = await fetch(`${BOOKING_SERVICE_URL}/bookings/internal/statuses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-key": INTERNAL_SERVICE_KEY,
      },
      body: JSON.stringify({ bookingIds: ids }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return map;
    const json = (await res.json()) as {
      success?: boolean;
      data?: BookingStatusInfo[];
    };
    for (const row of json.data ?? []) {
      if (row?.id) map.set(row.id, row);
    }
  } catch (err) {
    console.error(
      `[payout-flow] Failed to batch-fetch booking statuses (${ids.length} ids):`,
      (err as Error).message,
    );
  }
  return map;
}

/**
 * Attach a structured flowState / reason to payout rows returned by the admin
 * list and detail endpoints. Booking status is only needed for rows that are
 * still pending/scheduled — resolved terminal states don't require it.
 */
export async function enrichPayoutsWithFlowState<T extends { id: string; bookingId: string; status: string; createdAt?: Date | string | null; failureReason?: string | null; scheduledAt?: Date | string | null; processedAt?: Date | string | null; merchant?: unknown }>(payouts: T[]): Promise<T[]> {
  const needsBooking = payouts.filter((p) =>
    p.status === "pending" || p.status === "scheduled",
  );
  const bookingsMap = await fetchBookingsStatusBatch(
    needsBooking.map((p) => p.bookingId),
  );
  const enriched = await Promise.all(
    payouts.map(async (p) => {
      const booking = p.status === "pending" || p.status === "scheduled"
        ? (bookingsMap.get(p.bookingId) ?? null)
        : null;
      const result = await resolvePayoutFlowState(
        p as never,
        (p.merchant ?? null) as never,
        booking,
      );
      return {
        ...p,
        flowState: result.flowState,
        flowLabel: result.label,
        flowReason: result.reason,
      } as T & {
        flowState: PayoutFlowState;
        flowLabel: string;
        flowReason: string;
      };
    }),
  );
  return enriched as T[];
}
