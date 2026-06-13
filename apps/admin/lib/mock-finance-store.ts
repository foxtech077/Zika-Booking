"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  reference: string;
  listingId: string;
  listingName: string;
  listingType: "hotel" | "apartment" | "car";
  travellerName: string;
  travellerEmail: string;
  providerId: string;
  providerName: string;
  amount: number;
  currency: string;
  commissionRate: number;
  commissionAmount: number;
  providerPayout: number;
  date: string;
  status: "successful" | "failed" | "pending" | "refunded";
  gateway: "Stripe" | "PayPal" | "Tara";
  transactionId: string;
  country: string;
  logs: string[];
}

export interface Payout {
  id: string;
  bookingId: string;
  bookingReference: string;
  providerId: string;
  providerName: string;
  amount: number;
  currency: string;
  status: "pending" | "scheduled" | "completed" | "failed";
  method: string;
  scheduledDate: string;
  processedDate?: string;
  failureReason?: string;
  country: string;
}

export interface Refund {
  id: string;
  bookingId: string;
  bookingReference: string;
  travellerName: string;
  travellerEmail: string;
  originalAmount: number;
  refundAmount: number;
  currency: string;
  reason: string;
  status: "pending_approval" | "approved" | "rejected" | "processed";
  requestedDate: string;
  processedDate?: string;
  rejectionReason?: string;
  country: string;
  type: "full" | "partial";
}

export interface CommissionRule {
  id: string;
  country: string; // "Global" or 2-letter ISO code
  rate: number;
  setBy: string;
  updatedAt: string;
  effectiveDate?: string;
  isScheduled?: boolean;
}

export interface CommissionHistoryEntry {
  id: string;
  previousRate: number;
  newRate: number;
  country: string;
  effectiveDate: string;
  changedBy: string;
  changeReason: string;
  createdAt: string;
}

interface FinanceState {
  transactions: Transaction[];
  payouts: Payout[];
  refunds: Refund[];
  commissionRules: CommissionRule[];
  commissionHistory: CommissionHistoryEntry[];
  
  // Actions
  addTransaction: (tx: Transaction) => void;
  updateTransactionStatus: (id: string, status: Transaction["status"], log?: string) => void;
  
  approvePayout: (id: string, changer: string) => void;
  retryPayout: (id: string) => void;
  
  createRefund: (refund: Omit<Refund, "id" | "status" | "requestedDate">) => void;
  approveRefund: (id: string) => void;
  rejectRefund: (id: string, reason: string) => void;
  processRefund: (id: string) => void;
  
  createCommissionRule: (rule: Omit<CommissionRule, "id" | "updatedAt">) => void;
  updateCommissionRule: (id: string, rate: number, setBy: string) => void;
  deleteCommissionRule: (id: string, setBy: string) => void;
  scheduleCommissionRule: (rule: Omit<CommissionRule, "id" | "updatedAt" | "isScheduled"> & { effectiveDate: string }) => void;
}

// ── Default Mock Data ────────────────────────────────────────────────────────

const DEFAULT_TRANSACTIONS: Transaction[] = [
  {
    id: "tx-1",
    reference: "ZIK-883719",
    listingId: "lst-1",
    listingName: "Grand Hotel Excelsior",
    listingType: "hotel",
    travellerName: "Alice Smith",
    travellerEmail: "alice@example.com",
    providerId: "prov-1",
    providerName: "Excelsior Hotels Group Ltd",
    amount: 1200,
    currency: "USD",
    commissionRate: 12,
    commissionAmount: 144,
    providerPayout: 1056,
    date: "2026-06-01T14:32:00Z",
    status: "successful",
    gateway: "Stripe",
    transactionId: "ch_3Mv8x1LkdIwHu7ix2b1yR7c8",
    country: "MT",
    logs: [
      "Stripe Checkout Session created (cs_test_A1B2C3)",
      "Webhook received: checkout.session.completed",
      "Stripe Charge successful: ch_3Mv8x1LkdIwHu7ix2b1yR7c8",
      "Payment verification checks passed",
    ],
  },
  {
    id: "tx-2",
    reference: "ZIK-492831",
    listingId: "lst-2",
    listingName: "Cozy Beachside Studio",
    listingType: "apartment",
    travellerName: "Bob Johnson",
    travellerEmail: "bob@example.com",
    providerId: "prov-2",
    providerName: "Mediterranean Rentals",
    amount: 850,
    currency: "EUR",
    commissionRate: 10,
    commissionAmount: 85,
    providerPayout: 765,
    date: "2026-06-03T09:15:00Z",
    status: "successful",
    gateway: "PayPal",
    transactionId: "PAYID-MPE72Y48H891",
    country: "ES",
    logs: [
      "PayPal payment intent authorized",
      "Captured transaction PAYID-MPE72Y48H891",
      "Payment marked as completed in PayPal logs",
    ],
  },
  {
    id: "tx-3",
    reference: "ZIK-901843",
    listingId: "lst-3",
    listingName: "Vibrant City Center Condo",
    listingType: "apartment",
    travellerName: "Charlie Brown",
    travellerEmail: "charlie@example.com",
    providerId: "prov-3",
    providerName: "Metropolitan Escapes LLC",
    amount: 420,
    currency: "USD",
    commissionRate: 12,
    commissionAmount: 50.4,
    providerPayout: 369.6,
    date: "2026-06-04T18:45:00Z",
    status: "refunded",
    gateway: "Stripe",
    transactionId: "ch_3Mw0y2LkdIwHu7ix8c8zX9d4",
    country: "US",
    logs: [
      "Stripe Charge successful: ch_3Mw0y2LkdIwHu7ix8c8zX9d4",
      "Guest requested cancellation under Flexible policy",
      "Refund requested by Admin (Full Refund $420.00)",
      "Stripe Refund processed: re_3Mw0y2LkdIwHu7ixRefund1",
    ],
  },
  {
    id: "tx-4",
    reference: "ZIK-773819",
    listingId: "lst-4",
    listingName: "Luxury SUV Rental",
    listingType: "car",
    travellerName: "Diana Prince",
    travellerEmail: "diana@example.com",
    providerId: "prov-4",
    providerName: "Zika Wheels Malta",
    amount: 320,
    currency: "EUR",
    commissionRate: 15,
    commissionAmount: 48,
    providerPayout: 272,
    date: "2026-06-09T11:00:00Z",
    status: "pending",
    gateway: "Tara",
    transactionId: "TARA_TX_990123847",
    country: "MT",
    logs: [
      "Tara Transaction initialized",
      "Awaiting callback confirmation from Tara Bank gateway",
    ],
  },
  {
    id: "tx-5",
    reference: "ZIK-332918",
    listingId: "lst-5",
    listingName: "Romantic Sea-View Villa",
    listingType: "apartment",
    travellerName: "Ethan Hunt",
    travellerEmail: "ethan@example.com",
    providerId: "prov-2",
    providerName: "Mediterranean Rentals",
    amount: 1500,
    currency: "EUR",
    commissionRate: 10,
    commissionAmount: 150,
    providerPayout: 1350,
    date: "2026-06-05T08:20:00Z",
    status: "failed",
    gateway: "Stripe",
    transactionId: "ch_3Mx2z9LkdIwHu7ix9d8wY0e5",
    country: "FR",
    logs: [
      "Stripe Checkout Session initialized",
      "Stripe Charge attempt failed: card_declined",
      "Error: Insufficient funds on traveller card",
    ],
  },
  {
    id: "tx-6",
    reference: "ZIK-112093",
    listingId: "lst-6",
    listingName: "Heritage Palace Resort",
    listingType: "hotel",
    travellerName: "Fiona Gallagher",
    travellerEmail: "fiona@example.com",
    providerId: "prov-5",
    providerName: "Heritage Resorts & Spa",
    amount: 900,
    currency: "USD",
    commissionRate: 12,
    commissionAmount: 108,
    providerPayout: 792,
    date: "2026-05-25T16:00:00Z",
    status: "successful",
    gateway: "Stripe",
    transactionId: "ch_3Ms9f1LkdIwHu7ix1a8sT2d9",
    country: "IN",
    logs: [
      "Stripe Charge successful: ch_3Ms9f1LkdIwHu7ix1a8sT2d9",
      "Completed check-in on 2026-05-26",
      "Hold period passed. Payout approved.",
    ],
  },
  {
    id: "tx-7",
    reference: "ZIK-554832",
    listingId: "lst-1",
    listingName: "Grand Hotel Excelsior",
    listingType: "hotel",
    travellerName: "George Clooney",
    travellerEmail: "george@example.com",
    providerId: "prov-1",
    providerName: "Excelsior Hotels Group Ltd",
    amount: 800,
    currency: "USD",
    commissionRate: 12,
    commissionAmount: 96,
    providerPayout: 704,
    date: "2026-06-08T10:10:00Z",
    status: "successful",
    gateway: "Stripe",
    transactionId: "ch_3Mu5w2LkdIwHu7ix3c7yS8a9",
    country: "MT",
    logs: [
      "Stripe Charge successful: ch_3Mu5w2LkdIwHu7ix3c7yS8a9",
      "Holding in T+24 escrow",
    ],
  },
  {
    id: "tx-8",
    reference: "ZIK-662948",
    listingId: "lst-7",
    listingName: "Loft in Central London",
    listingType: "apartment",
    travellerName: "Hannah Abbott",
    travellerEmail: "hannah@example.com",
    providerId: "prov-6",
    providerName: "London Properties Ltd",
    amount: 1100,
    currency: "USD",
    commissionRate: 10,
    commissionAmount: 110,
    providerPayout: 990,
    date: "2026-06-06T15:20:00Z",
    status: "successful",
    gateway: "PayPal",
    transactionId: "PAYID-NQF88Y99M888",
    country: "GB",
    logs: [
      "Captured PayPal transaction PAYID-NQF88Y99M888",
      "Funds settled in platform gateway",
    ],
  },
  {
    id: "tx-9",
    reference: "ZIK-293847",
    listingId: "lst-8",
    listingName: "Berlin Hatchback Rental",
    listingType: "car",
    travellerName: "Ian Wright",
    travellerEmail: "ian@example.com",
    providerId: "prov-7",
    providerName: "Deutschland AutoRent",
    amount: 300,
    currency: "EUR",
    commissionRate: 10,
    commissionAmount: 30,
    providerPayout: 270,
    date: "2026-06-10T12:00:00Z",
    status: "pending",
    gateway: "Stripe",
    transactionId: "ch_3My0z2LkdIwHu7ix0e8eX4c5",
    country: "DE",
    logs: [
      "Stripe Checkout Session initialized",
      "Customer entered credentials, awaiting gateway authorization",
    ],
  },
  {
    id: "tx-10",
    reference: "ZIK-774829",
    listingId: "lst-9",
    listingName: "Ibiza Luxury Beach Resort",
    listingType: "hotel",
    travellerName: "Julia Roberts",
    travellerEmail: "julia@example.com",
    providerId: "prov-8",
    providerName: "Baleares Hotels & Resorts Group",
    amount: 2500,
    currency: "EUR",
    commissionRate: 15,
    commissionAmount: 375,
    providerPayout: 2125,
    date: "2026-06-07T17:15:00Z",
    status: "successful",
    gateway: "Stripe",
    transactionId: "ch_3Mv6e1LkdIwHu7ix4f2yG5d9",
    country: "ES",
    logs: [
      "Stripe Charge successful: ch_3Mv6e1LkdIwHu7ix4f2yG5d9",
      "Check-in verified. Moving to payout.",
    ],
  }
];

const DEFAULT_PAYOUTS: Payout[] = [
  {
    id: "pay-1",
    bookingId: "tx-1",
    bookingReference: "ZIK-883719",
    providerId: "prov-1",
    providerName: "Excelsior Hotels Group Ltd",
    amount: 1056,
    currency: "USD",
    status: "scheduled",
    method: "Bank Transfer (BOV Malta)",
    scheduledDate: "2026-06-12",
    country: "MT",
  },
  {
    id: "pay-2",
    bookingId: "tx-2",
    bookingReference: "ZIK-492831",
    providerId: "prov-2",
    providerName: "Mediterranean Rentals",
    amount: 765,
    currency: "EUR",
    status: "completed",
    method: "Stripe Connect (acc_901842)",
    scheduledDate: "2026-06-05",
    processedDate: "2026-06-05T10:00:00Z",
    country: "ES",
  },
  {
    id: "pay-3",
    bookingId: "tx-6",
    bookingReference: "ZIK-112093",
    providerId: "prov-5",
    providerName: "Heritage Resorts & Spa",
    amount: 792,
    currency: "USD",
    status: "completed",
    method: "Bank Transfer (HDFC India)",
    scheduledDate: "2026-05-28",
    processedDate: "2026-05-28T14:30:00Z",
    country: "IN",
  },
  {
    id: "pay-4",
    bookingId: "tx-7",
    bookingReference: "ZIK-554832",
    providerId: "prov-1",
    providerName: "Excelsior Hotels Group Ltd",
    amount: 704,
    currency: "USD",
    status: "pending",
    method: "Bank Transfer (BOV Malta)",
    scheduledDate: "2026-06-11",
    country: "MT",
  },
  {
    id: "pay-5",
    bookingId: "tx-8",
    bookingReference: "ZIK-662948",
    providerId: "prov-6",
    providerName: "London Properties Ltd",
    amount: 990,
    currency: "USD",
    status: "failed",
    method: "Stripe Connect (acc_failed882)",
    scheduledDate: "2026-06-08",
    failureReason: "Stripe Account restricted. Payout rejected by recipient gateway.",
    country: "GB",
  },
];

const DEFAULT_REFUNDS: Refund[] = [
  {
    id: "ref-1",
    bookingId: "tx-3",
    bookingReference: "ZIK-901843",
    travellerName: "Charlie Brown",
    travellerEmail: "charlie@example.com",
    originalAmount: 420,
    refundAmount: 420,
    currency: "USD",
    reason: "Guest cancelled booking before check-in due to medical emergency.",
    status: "processed",
    requestedDate: "2026-06-04T20:00:00Z",
    processedDate: "2026-06-04T21:30:00Z",
    country: "US",
    type: "full",
  },
  {
    id: "ref-2",
    bookingId: "tx-2",
    bookingReference: "ZIK-492831",
    travellerName: "Bob Johnson",
    travellerEmail: "bob@example.com",
    originalAmount: 850,
    refundAmount: 150,
    currency: "EUR",
    reason: "Compensation for broken AC in bedroom during first night of stay.",
    status: "approved",
    requestedDate: "2026-06-05T11:20:00Z",
    country: "ES",
    type: "partial",
  },
  {
    id: "ref-3",
    bookingId: "tx-10",
    bookingReference: "ZIK-774829",
    travellerName: "Julia Roberts",
    travellerEmail: "julia@example.com",
    originalAmount: 2500,
    refundAmount: 2500,
    currency: "EUR",
    reason: "Double booking on side of provider. Room unavailable upon arrival.",
    status: "pending_approval",
    requestedDate: "2026-06-10T16:00:00Z",
    country: "ES",
    type: "full",
  },
];

const DEFAULT_COMMISSION_RULES: CommissionRule[] = [
  { id: "comm-1", country: "Global", rate: 10, setBy: "System", updatedAt: "2026-01-01T00:00:00Z" },
  { id: "comm-2", country: "US", rate: 12, setBy: "super_admin", updatedAt: "2026-04-15T10:30:00Z" },
  { id: "comm-3", country: "MT", rate: 12, setBy: "super_admin", updatedAt: "2026-05-01T09:00:00Z" },
  { id: "comm-4", country: "ES", rate: 15, setBy: "super_admin", updatedAt: "2026-05-10T14:15:00Z" },
  { id: "comm-5", country: "IN", rate: 12, setBy: "super_admin", updatedAt: "2026-05-20T11:45:00Z" },
  {
    id: "comm-6",
    country: "FR",
    rate: 14,
    setBy: "super_admin",
    updatedAt: "2026-06-01T10:00:00Z",
    effectiveDate: "2026-07-01",
    isScheduled: true,
  }
];

const DEFAULT_COMMISSION_HISTORY: CommissionHistoryEntry[] = [
  {
    id: "ch-hist-1",
    previousRate: 10,
    newRate: 12,
    country: "US",
    effectiveDate: "2026-04-15",
    changedBy: "Sarah Connor (Super Admin)",
    changeReason: "Adjustment to cover regional marketing costs.",
    createdAt: "2026-04-15T10:30:00Z",
  },
  {
    id: "ch-hist-2",
    previousRate: 10,
    newRate: 12,
    country: "MT",
    effectiveDate: "2026-05-01",
    changedBy: "Sarah Connor (Super Admin)",
    changeReason: "Align with European Operations standard rate.",
    createdAt: "2026-05-01T09:00:00Z",
  },
  {
    id: "ch-hist-3",
    previousRate: 10,
    newRate: 15,
    country: "ES",
    effectiveDate: "2026-05-10",
    changedBy: "Sarah Connor (Super Admin)",
    changeReason: "High demand season rate adjust.",
    createdAt: "2026-05-10T14:15:00Z",
  },
];

// ── Store Implementation ──────────────────────────────────────────────────────

export const useMockFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      transactions: DEFAULT_TRANSACTIONS,
      payouts: DEFAULT_PAYOUTS,
      refunds: DEFAULT_REFUNDS,
      commissionRules: DEFAULT_COMMISSION_RULES,
      commissionHistory: DEFAULT_COMMISSION_HISTORY,

      addTransaction: (tx) =>
        set((state) => ({ transactions: [tx, ...state.transactions] })),

      updateTransactionStatus: (id, status, log) =>
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.id === id
              ? {
                  ...tx,
                  status,
                  logs: log ? [...tx.logs, log] : tx.logs,
                }
              : tx
          ),
        })),

      approvePayout: (id, changer) =>
        set((state) => {
          const payout = state.payouts.find((p) => p.id === id);
          if (!payout) return {};

          const updatedPayouts = state.payouts.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: "completed" as const,
                  processedDate: new Date().toISOString(),
                }
              : p
          );

          // Update transactions logs if matching reference
          const updatedTransactions = state.transactions.map((tx) =>
            tx.reference === payout.bookingReference
              ? {
                  ...tx,
                  logs: [
                    ...tx.logs,
                    `Payout approved and processed by ${changer}. Status: completed.`,
                  ],
                }
              : tx
          );

          return {
            payouts: updatedPayouts,
            transactions: updatedTransactions,
          };
        }),

      retryPayout: (id) =>
        set((state) => {
          const payout = state.payouts.find((p) => p.id === id);
          if (!payout) return {};

          return {
            payouts: state.payouts.map((p) =>
              p.id === id
                ? {
                    ...p,
                    status: "scheduled" as const,
                    scheduledDate: new Date(Date.now() + 86400000).toISOString().split("T")[0]!, // Tomorrow
                    failureReason: undefined,
                  }
                : p
            ),
            transactions: state.transactions.map((tx) =>
              payout && tx.reference === payout.bookingReference
                ? {
                    ...tx,
                    logs: [...tx.logs, "Payout retry triggered. Scheduled for next batch."],
                  }
                : tx
            ),
          };
        }),

      createRefund: (refund) =>
        set((state) => {
          const newRefund: Refund = {
            ...refund,
            id: `ref-${state.refunds.length + 100}`,
            status: "pending_approval",
            requestedDate: new Date().toISOString(),
          };

          return {
            refunds: [newRefund, ...state.refunds],
            transactions: state.transactions.map((tx) =>
              tx.reference === refund.bookingReference
                ? {
                    ...tx,
                    logs: [
                      ...tx.logs,
                      `Refund of ${refund.currency} ${refund.refundAmount} requested. Status: pending_approval. Reason: ${refund.reason}`,
                    ],
                  }
                : tx
            ),
          };
        }),

      approveRefund: (id) =>
        set((state) => {
          const refund = state.refunds.find((r) => r.id === id);
          if (!refund) return {};

          return {
            refunds: state.refunds.map((r) =>
              r.id === id ? { ...r, status: "approved" as const } : r
            ),
            transactions: state.transactions.map((tx) =>
              refund && tx.reference === refund.bookingReference
                ? {
                    ...tx,
                    logs: [...tx.logs, "Refund request approved. Awaiting payment gateway processing."],
                  }
                : tx
            ),
          };
        }),

      rejectRefund: (id, reason) =>
        set((state) => {
          const refund = state.refunds.find((r) => r.id === id);
          if (!refund) return {};

          return {
            refunds: state.refunds.map((r) =>
              r.id === id
                ? {
                    ...r,
                    status: "rejected" as const,
                    rejectionReason: reason,
                  }
                : r
            ),
            transactions: state.transactions.map((tx) =>
              refund && tx.reference === refund.bookingReference
                ? {
                    ...tx,
                    logs: [...tx.logs, `Refund request rejected. Reason: ${reason}`],
                  }
                : tx
            ),
          };
        }),

      processRefund: (id) =>
        set((state) => {
          const refund = state.refunds.find((r) => r.id === id);
          if (!refund) return {};

          return {
            refunds: state.refunds.map((r) =>
              r.id === id
                ? {
                    ...r,
                    status: "processed" as const,
                    processedDate: new Date().toISOString(),
                  }
                : r
            ),
            transactions: state.transactions.map((tx) =>
              refund && tx.reference === refund.bookingReference
                ? {
                    ...tx,
                    status: refund.type === "full" ? "refunded" : tx.status,
                    logs: [
                      ...tx.logs,
                      `Refund of ${refund.currency} ${refund.refundAmount} successfully processed via ${tx.gateway}.`,
                    ],
                  }
                : tx
            ),
          };
        }),

      createCommissionRule: (rule) =>
        set((state) => {
          const defaultGlobal = state.commissionRules.find((r) => r.country === "Global");
          const oldRate = defaultGlobal ? defaultGlobal.rate : 10;
          
          const newRule: CommissionRule = {
            ...rule,
            id: `comm-${state.commissionRules.length + 100}`,
            updatedAt: new Date().toISOString(),
          };

          const newHistory: CommissionHistoryEntry = {
            id: `ch-hist-${state.commissionHistory.length + 100}`,
            previousRate: rule.country === "Global" ? oldRate : 10,
            newRate: rule.rate,
            country: rule.country,
            effectiveDate: new Date().toISOString().split("T")[0]!,
            changedBy: rule.setBy,
            changeReason: `Set custom override rate.`,
            createdAt: new Date().toISOString(),
          };

          // If global or override exists, replace it
          const exists = state.commissionRules.some((r) => r.country === rule.country && !r.isScheduled);
          let updatedRules;
          if (exists) {
            updatedRules = state.commissionRules.map((r) =>
              r.country === rule.country && !r.isScheduled
                ? { ...r, rate: rule.rate, setBy: rule.setBy, updatedAt: new Date().toISOString() }
                : r
            );
          } else {
            updatedRules = [...state.commissionRules, newRule];
          }

          return {
            commissionRules: updatedRules,
            commissionHistory: [newHistory, ...state.commissionHistory],
          };
        }),

      updateCommissionRule: (id, rate, setBy) =>
        set((state) => {
          const rule = state.commissionRules.find((r) => r.id === id);
          if (!rule) return {};

          const newHistory: CommissionHistoryEntry = {
            id: `ch-hist-${state.commissionHistory.length + 100}`,
            previousRate: rule.rate,
            newRate: rate,
            country: rule.country,
            effectiveDate: new Date().toISOString().split("T")[0]!,
            changedBy: setBy,
            changeReason: `Updated commission rate.`,
            createdAt: new Date().toISOString(),
          };

          return {
            commissionRules: state.commissionRules.map((r) =>
              r.id === id
                ? { ...r, rate, setBy, updatedAt: new Date().toISOString() }
                : r
            ),
            commissionHistory: [newHistory, ...state.commissionHistory],
          };
        }),

      deleteCommissionRule: (id, setBy) =>
        set((state) => {
          const rule = state.commissionRules.find((r) => r.id === id);
          if (!rule) return {};

          const newHistory: CommissionHistoryEntry = {
            id: `ch-hist-${state.commissionHistory.length + 100}`,
            previousRate: rule.rate,
            newRate: 10, // Global default fallback
            country: rule.country,
            effectiveDate: new Date().toISOString().split("T")[0]!,
            changedBy: setBy,
            changeReason: `Deleted custom override rate.`,
            createdAt: new Date().toISOString(),
          };

          return {
            commissionRules: state.commissionRules.filter((r) => r.id !== id),
            commissionHistory: [newHistory, ...state.commissionHistory],
          };
        }),

      scheduleCommissionRule: (rule) =>
        set((state) => {
          const newRule: CommissionRule = {
            ...rule,
            id: `comm-${state.commissionRules.length + 100}`,
            updatedAt: new Date().toISOString(),
            isScheduled: true,
          };

          const newHistory: CommissionHistoryEntry = {
            id: `ch-hist-${state.commissionHistory.length + 100}`,
            previousRate: 10, // Default fallback assumption
            newRate: rule.rate,
            country: rule.country,
            effectiveDate: rule.effectiveDate,
            changedBy: rule.setBy,
            changeReason: `Scheduled future change (Effective: ${rule.effectiveDate}).`,
            createdAt: new Date().toISOString(),
          };

          return {
            commissionRules: [...state.commissionRules, newRule],
            commissionHistory: [newHistory, ...state.commissionHistory],
          };
        }),
    }),
    {
      name: "zika:mock_finance_db",
      storage: {
        getItem: (name) => {
          if (typeof window === "undefined") return null;
          const val = localStorage.getItem(name);
          return val ? JSON.parse(val) : null;
        },
        setItem: (name, val) => {
          if (typeof window !== "undefined") {
            localStorage.setItem(name, JSON.stringify(val));
          }
        },
        removeItem: (name) => {
          if (typeof window !== "undefined") {
            localStorage.removeItem(name);
          }
        },
      },
    }
  )
);
