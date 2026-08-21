// ── Booking & Payment shared types ────────────────────────────────────────────
// These are inferred from the API contracts used throughout the app.
// Extend as the backend evolves.

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "pending_payment"
  | "active"
  | "completed"
  | "cancelled_by_guest"
  | "cancelled_by_provider"
  | "cancelled_by_system"
  | "refunded";

export type ListingType = "hotel" | "apartment" | "car";

export type PaymentProvider = "stripe" | "tara";

// ── Booking list item (GET /guests/me/bookings) ───────────────────────────────

export interface BookingSummary {
  id: string;
  reference: string;
  status: BookingStatus;
  listingType: ListingType;
  listingTitle: string;
  listingPrimaryPhotoUrl: string | null;
  checkIn?: string;
  checkOut?: string;
  pickupDatetime?: string;
  returnDatetime?: string;
  nightsOrDays: number;
  totalAmount: number;
  currency: string;
  createdAt: string;
}

export interface BookingsResponse {
  total: number;
  nextCursor: number | null;
  bookings: BookingSummary[];
}

// ── Booking detail (GET /guests/me/bookings/:id) ──────────────────────────────

export interface BookingListing {
  id: string;
  title: string;
  address: string;
  town: string;
  country: string;
  primaryPhotoUrl: string | null;
}

export interface BookingDetail {
  id: string;
  reference: string;
  status: BookingStatus;
  listingType: ListingType;
  listing: BookingListing;
  listingId: string;
  listingTitle: string;
  checkIn?: string;
  checkOut?: string;
  pickupDatetime?: string;
  returnDatetime?: string;
  nightsOrDays: number;
  adults?: number;
  children?: number;
  specialRequests?: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  driverFirstName?: string;
  driverLastName?: string;
  driverAge?: number;
  subtotal: number;
  discountAmount?: number;
  serviceFee?: number;
  serviceFeeRate?: number;
  deliveryFee?: number;
  securityDeposit?: number;
  totalAmount: number;
  currency: string;
  cancellationPolicy?: string;
  cancellationPolicyName?: string;
  refundAmount?: number;
  cancelledAt?: string;
  confirmedAt?: string;
  completedAt?: string;
  checkedInAt?: string;
  createdAt: string;
  canCancel: boolean;
  hasReview?: boolean;
  reviewId?: string;
  // For payment screen
  adults_?: number;
  children_?: number;
}

// ── Receipt (GET /guests/me/bookings/:id/receipt) ─────────────────────────────
// Backend returns a nested structure — these sub-interfaces mirror it exactly.

export interface ReceiptLineItem {
  label: string;
  amount: number;
  // values from backend: "subtotal" | "fee" | "discount" | "voucher"
  type: string;
}

export interface ReceiptGuest {
  name: string;
  email: string;
  phone?: string | null;
}

export interface ReceiptListing {
  id: string;
  title: string | null;
  type: string;             // "hotel" | "apartment" | "car"
  address: string | null;
  town: string | null;
  country: string | null;
}

export interface ReceiptPeriod {
  checkIn?: string | null;
  checkOut?: string | null;
  pickupDatetime?: string | null;
  returnDatetime?: string | null;
  nightsOrDays: number;
}

export interface ReceiptTotals {
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  voucherDiscount: number;
  securityDeposit: number;
  total: number;
  currency: string;
}

export interface ReceiptPayment {
  paymentId: string | null;
  confirmedAt: string | null;
}

export interface Receipt {
  receiptNumber: string;
  bookingReference: string;
  bookingId: string;
  issuedAt: string;
  status: string;
  guest: ReceiptGuest;
  listing: ReceiptListing;
  period: ReceiptPeriod;
  lineItems: ReceiptLineItem[];
  totals: ReceiptTotals;
  payment: ReceiptPayment;
}

// ── QR Code (GET /guests/me/bookings/:id/qr-code) ────────────────────────────

export interface QRCodeData {
  qrCodeUrl: string;          // presigned S3 PNG URL, valid 1 hour
  bookingReference: string;
  expiresAt: string;
}

// ── Voucher PDF (GET /guests/me/bookings/:id/voucher-pdf) ─────────────────────

export interface VoucherPdf {
  voucherPdfUrl: string;      // presigned S3 PDF URL, valid 1 hour
  expiresAt: string;
}

// ── Payment methods (GET /guests/me/payment-methods) ─────────────────────────
// Matches the backend's formatMethod() response shape

export interface SavedPaymentMethod {
  id: string;
  type: string;               // "card" | "mobile_money"
  paymentProvider: PaymentProvider;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
  mobileNumberMasked: string | null;
  isDefault: boolean;
}

// ── Stripe setup intent (POST /guests/me/payment-methods/stripe/setup) ────────

export interface StripeSetupIntentResponse {
  setupIntentId: string;     // seti_...
  clientSecret: string;      // seti_..._secret_...
  publishableKey?: string;   // pk_...
}

// ── Stripe setup confirm (POST /guests/me/payment-methods/stripe/confirm) ─────

export interface StripeSetupConfirmPayload {
  paymentMethodId: string;   // pm_... from confirmed SetupIntent
}

// ── Add Tara account (POST /guests/me/payment-methods/tara) ──────────────────

export interface AddTaraPayload {
  mobileNumber: string;   // E.164 — e.g. "+254700000000"
}

// ── Payment intent (POST /payments/create-intent) ────────────────────────────

export interface CreateIntentResponse {
  paymentId: string;
  clientSecret: string;
  publishableKey?: string;
}

// ── Payment initiate (POST /payments/initiate) ────────────────────────────────

export interface InitiatePaymentPayload {
  bookingId: string;
  paymentProvider: PaymentProvider;
  paymentMethodId?: string;
  mobileNumber?: string;
  savedPaymentMethodId?: string;
}

export interface InitiatePaymentResponse {
  paymentId: string;
  clientSecret?: string;
  publishableKey?: string;
  requiresAction?: boolean;
  taraReference?: string;
  message?: string;
}

// ── Payment status (GET /payments/:id/status) ─────────────────────────────────

export type PaymentStatus =
  | "pending"
  | "processing"
  | "captured"
  | "failed"
  | "timed_out"
  | "refunded"
  | "cancelled";

export interface PaymentStatusResponse {
  status: PaymentStatus;
  paymentId: string;
  bookingId?: string;
  message?: string;
}

// ── Lock state (stored in SecureStore) ───────────────────────────────────────

export interface PricingPreview {
  ratePerUnit: number;
  units: number;
  unitLabel: string;
  subtotal: number;
  discountAmount?: number;
  serviceFee?: number;
  deliveryFee?: number;
  securityDeposit?: number;
  total: number;
  currency: string;
  cancellationPolicyName?: string;
}

export interface ActiveLockCache {
  listingId: string;
  checkIn?: string;
  checkOut?: string;
  pickupDatetime?: string;
  returnDatetime?: string;
  guests?: string;
  expiresAt: string;
  lockStartMs: number;
  lockState: {
    lockToken: string;
    expiresAt: string;
    pricingPreview: PricingPreview;
  };
}
