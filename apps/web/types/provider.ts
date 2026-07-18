import type { HotelRoomType } from "./index";

// ── Listing types ─────────────────────────────────────────────────────────────

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
  name: string | null;
  category: ListingCategory;
  status: ListingStatus;
  starRating: number | null;
  claimedStarRating: number | null;
  town: string | null;
  country: string | null;
  pricePerNight: string | null;
  pricePerDay?: string | null;
  currency: string | null;
  submissionCount: number;
  submittedAt?: string | null;
  approvedAt?: string | null;
  activatedAt?: string | null;
  rejectedAt?: string | null;
  suspendedAt?: string | null;
  rejectionReasons: string[];
  rejectionNote: string | null;
  createdAt: string;
  updatedAt: string;
  photos?: { cdnUrl: string }[];
  roomType?: string | null;
  unitCount?: number | null;
  description?: string | null;
  minStayNights?: number;
  checkinTime?: string | null;
  checkoutTime?: string | null;
  cancellationPolicy?: string | null;
  smokingAllowed?: boolean;
  petsAllowed?: boolean;
  allowPreBooking?: boolean;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  maxGuests?: number | null;
  longStayEnabled?: boolean;
  longStayMinNights?: number | null;
  longStayDiscountType?: string | null;
  longStayDiscountValue?: number | null;
  carMake?: string | null;
  carModel?: string | null;
  carYear?: number | null;
  transmission?: string | null;
  fuelType?: string | null;
  seats?: number | null;
  doors?: number | null;
  mileagePolicy?: string | null;
  mileageLimitKm?: number | null;
  hotelRoomTypes?: HotelRoomType[];
}

// ── Booking types ─────────────────────────────────────────────────────────────

export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "completed"
  | "cancelled_by_guest"
  | "cancelled_by_provider"
  | "cancelled_by_system";

export interface ProviderBooking {
  id: string;
  reference: string;
  listingTitle: string | null;
  listingCategory: ListingCategory;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string | null;
  adults: number | null;
  children: number | null;
  checkIn: string | null;
  checkOut: string | null;
  pickupDatetime: string | null;
  returnDatetime: string | null;
  nightsOrDays: number;
  totalAmount: number;
  providerPayout: number;
  commissionAmount: number;
  currency: string;
  status: BookingStatus;
  cancellationPolicy: string;
  specialRequests: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
}

// ── Review types ──────────────────────────────────────────────────────────────

export interface ProviderReview {
  id: string;
  listingId: string;
  listingName: string | null;
  listingCategory: ListingCategory;
  bookingReference: string;
  guestName: string;
  rating: number;
  title: string | null;
  body: string | null;
  providerReply: string | null;
  providerRepliedAt: string | null;
  createdAt: string;
}

// ── Dashboard types ───────────────────────────────────────────────────────────

export interface DashboardData {
  totalEarnings: number;
  thisMonthEarnings: number;
  activeListingsCount: number;
  pendingBookingsCount: number;
  completedBookingsCount: number;
  unreadMessages: number;
  pendingReviews: number;
  recentBookings: Array<{
    id: string;
    reference: string;
    listingTitle: string | null;
    listingCategory: ListingCategory;
    guestName: string;
    guestEmail: string;
    checkIn: string | null;
    checkOut: string | null;
    pickupDatetime: string | null;
    returnDatetime: string | null;
    totalAmount: number;
    providerPayout: number;
    currency: string;
    status: BookingStatus;
    createdAt: string;
  }>;
  monthlyRevenue: Array<{ month: string; revenue: number; bookings: number }>;
}

// ── Earnings types ────────────────────────────────────────────────────────────

export interface EarningsData {
  allTime: { revenue: number; commission: number; payout: number };
  monthly: Array<{
    month: string;
    revenue: number;
    commission: number;
    payout: number;
    bookings: number;
  }>;
  recentPayouts: Array<{
    id: string;
    reference: string;
    listingName: string | null;
    category: ListingCategory;
    totalAmount: number;
    commission: number;
    payout: number;
    currency: string;
    status: BookingStatus;
    confirmedAt: string | null;
  }>;
}

// ── Conversation types ────────────────────────────────────────────────────────

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

// ── iCal types ────────────────────────────────────────────────────────────────

export interface IcalFeed {
  id: string;
  platform: string;
  feedUrl: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

// ── Availability types ────────────────────────────────────────────────────────

export interface AvailabilityRange {
  id: string;
  reference?: string;
  start: string;
  end: string;
  status?: string;
  guestName?: string;
  summary?: string;
  platform?: string;
  type: "booking" | "ical_block";
}

// ── Paginated response ────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  total: number;
  offset: number;
  limit: number;
  data: T[];
}
