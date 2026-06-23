// ── Shared TypeScript interfaces for the admin panel ─────────────────────────

// ── Auth / Session ────────────────────────────────────────────────────────────

export type AdminRole =
  | "super_admin"
  | "admin"
  | "country_manager"
  | "sales"
  | "support"
  | "finance";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  countryScope: string[];
  totpEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSession {
  token: string;
  user: AdminUser;
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  adminId: string;
  adminName?: string;
  adminEmail?: string;
  role: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string;
  timestamp: string;
}

export interface AuditLogListResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

// ── User Management ───────────────────────────────────────────────────────────

export type UserStatus = "pending_verification" | "active" | "suspended" | "banned";
export type UserType = "guest" | "provider";

export interface PlatformUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: UserStatus;
  userType: UserType;
  emailVerified: boolean;
  currentTier: "bronze" | "silver" | "gold" | "diamond" | null;
  loyaltyPoints: number | null;
  businessName: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserListResponse {
  users: PlatformUser[];
  total: number;
  page: number;
  limit: number;
}

// ── Listings ──────────────────────────────────────────────────────────────────

export type ListingCategory = "hotel" | "apartment" | "car";
export type ListingStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "active"
  | "deactivated"
  | "suspended"
  | "auto_suspended"
  | "permanently_banned";

export interface Listing {
  id: string;
  providerId: string;
  category: ListingCategory;
  name: string | null;
  status: ListingStatus;
  country: string | null;
  town: string | null;
  pricePerNight: string | null;
  currency: string | null;
  starRating: number | null;
  claimedStarRating: number | null;
  submissionCount: number;
  approvedAt: string | null;
  rejectedAt: string | null;
  suspendedAt: string | null;
  updatedAt: string;
  createdAt: string;
  photos?: ListingPhoto[];
}

export interface ListingReviewTask {
  id: string;
  listingId: string;
  submissionNumber: number;
  assignedTo: string | null;
  status: string;
  outcome: string | null;
  adminNote: string | null;
  slaDeadline: string;
  createdAt: string;
  resolvedAt: string | null;
  listing: {
    id: string;
    name: string | null;
    country: string | null;
    town: string | null;
    claimedStarRating: number | null;
    submissionCount: number;
    submittedAt: string | null;
    providerId: string;
    category: ListingCategory;
    photos?: ListingPhoto[];
  };
}

export interface ListingDetail extends Listing {
  description: string | null;
  address: string | null;
  lat: string | null;
  lng: string | null;
  cancellationPolicy: string | null;
  photos: ListingPhoto[];
  documents: ListingDocument[];
  amenities: { amenityKey: string }[];
  customAmenities: { id: string; label: string }[];
  reviewTasks: ListingReviewTask[];
  rejectionReasons: string[];
  rejectionNote: string | null;
  suspensionReason: string | null;
  approvedBy: string | null;
  rejectedBy: string | null;
  suspendedBy: string | null;
}

export interface ListingPhoto {
  id: string;
  cdnUrl: string;
  position: number;
}

export interface ListingDocument {
  id: string;
  documentType: string;
  fileType: string;
  uploadedAt: string;
}

// ── Bookings ──────────────────────────────────────────────────────────────────

export type BookingStatus =
  | "draft"
  | "pending_payment"
  | "confirmed"
  | "completed"
  | "cancelled_by_guest"
  | "cancelled_by_provider"
  | "cancelled_by_system";

export interface Booking {
  id: string;
  reference: string;
  listingId: string;
  guestId: string;
  providerId: string;
  listingType: string;
  status: BookingStatus;
  checkIn: string | null;
  checkOut: string | null;
  pickupDatetime: string | null;
  returnDatetime: string | null;
  nightsOrDays: number;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string | null;
  adults: number | null;
  children: number | null;
  subtotal: string;
  discountAmount: string;
  deliveryFee: string;
  totalAmount: string;
  currency: string;
  commissionRate: string;
  commissionAmount: string;
  providerPayout: string;
  voucherCode: string | null;
  voucherDiscount: string;
  refundAmount: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  paymentId: string | null;
  createdAt: string;
  updatedAt: string;
  listing?: { name: string | null; country?: string | null };
}

export interface BookingStatusLog {
  id: string;
  bookingId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string | null;
  actorType: string | null;
  reason: string | null;
  createdAt: string;
}

export interface BookingDetail extends Booking {
  statusLog: BookingStatusLog[];
}

// ── Finance / Commission ──────────────────────────────────────────────────────

export interface CommissionRate {
  id: string;
  country: string;
  rate: number;
  setBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionRatesResponse {
  defaultRate: number;
  rates: CommissionRate[];
}

// ── Vouchers ──────────────────────────────────────────────────────────────────

export type VoucherDiscountType = "percentage" | "fixed";

export interface Voucher {
  id: string;
  code: string;
  discountType: VoucherDiscountType;
  discountValue: number;
  minOrderValue: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usageCount: number;
  redemptionCount?: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  title?: string;
  activityScope?: string;
  countryScope?: string;
  usageLimitPerGuest?: number;
  applicableTiers?: string[];
  autoAssign?: boolean;
  status?: string;
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export interface ListingReview {
  id: string;
  bookingId: string;
  listingId: string;
  guestId: string;
  rating: number;
  title: string | null;
  body: string | null;
  providerReply: string | null;
  providerRepliedAt: string | null;
  isHidden: boolean;
  hiddenBy: string | null;
  hiddenAt: string | null;
  hiddenReason: string | null;
  createdAt: string;
  updatedAt: string;
  listing?: { name: string | null };
}

// ── Messaging ─────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  listingId: string;
  bookingId: string | null;
  guestId: string;
  providerId: string;
  status: "open" | "closed";
  lastMessage: {
    body: string;
    senderId: string;
    senderType: string;
    createdAt: string;
  } | null;
  updatedAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderType: string;
  body: string;
  isFiltered: boolean;
  readAt: string | null;
  createdAt: string;
}

// ── iCal / Channel ────────────────────────────────────────────────────────────

export interface IcalFeed {
  id: string;
  listingId: string;
  platform: string;
  feedUrl: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  isActive: boolean;
  createdAt: string;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ── API response wrapper ──────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

// ── Activity Promotions ───────────────────────────────────────────────────────

export interface Promotion {
  id: string;
  activity: "hotel" | "apartment" | "car";
  labelText: string;
  labelColour: string;
  discountType: "percentage" | "fixed" | "label_only";
  discountValue: number;
  validFrom: string;
  validUntil: string;
  applyToBooking: boolean;
  bannerTitle: string;
  bannerSubtitle: string;
  status: "scheduled" | "active" | "paused" | "expired" | "superseded";
  countryScope: string;
  createdAt: string;
  createdBy: string;
}
