export interface ListingPhoto {
  id: string;
  cdnUrl: string;
  position: number;
}

export interface ListingAmenity {
  id: string;
  amenityKey: string;
}

export interface CustomAmenity {
  id: string;
  name: string;
}

export interface HotelRoomType {
  id: string;
  listingId: string;
  name: string;
  roomType: "standard" | "superior" | "deluxe" | "suite" | "junior_suite" | "studio" | "family_room" | "presidential_suite";
  description?: string | null;
  pricePerNight: number;
  unitCount: number;
  maxGuests?: number | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicListingDetail {
  id: string;
  providerId: string;
  category: "hotel" | "apartment" | "car";
  name: string;
  roomType?: string;
  bedrooms?: number;
  bathrooms?: number;
  maxGuests?: number;
  description: string;
  pricePerNight: number;
  currency: string;
  minStayNights: number;
  /** Service-fee rate for this listing's country, as a decimal fraction
   *  (0.05 = 5%). Served by GET /listings/:id/public — the same value the
   *  booking flow charges. Never hardcode a rate alongside this. */
  commissionRate?: number | null;
  checkinTime: string;
  checkoutTime: string;
  cancellationPolicy: "flexible" | "moderate" | "strict" | "non_refundable";
  address: string;
  lat?: number;
  lng?: number;
  town: string;
  neighborhood?: string | null;
  country: string;
  starRating?: number;
  carMake?: string;
  carModel?: string;
  carYear?: number;
  transmission?: string;
  fuelType?: string;
  seats?: number;
  mileagePolicy?: string;
  securityDeposit?: number;
  /** Provider supplies a driver with the vehicle. When true the backend waives
   *  the security deposit, so any deposit shown to a guest must be gated on this. */
  driverProvided?: boolean;
  deliveryAvailable?: boolean;
  deliveryFee?: number | null;
  deliveryRadiusKm?: number | null;
  primaryPhotoUrl?: string | null;
  photos: ListingPhoto[];
  amenities: ListingAmenity[];
  customAmenities: CustomAmenity[];
  distanceKm?: number;
  isFavourited?: boolean;
  isAccredited?: boolean;
  longStayDiscountEnabled?: boolean;
  longStayEnabled?: boolean | null;
  longStayMinNights?: number | null;
  longStayDiscountType?: string | null;
  longStayDiscountValue?: number | null;
  allowPreBooking?: boolean;
  promoBadge?: { labelText: string; labelColour?: string } | null;
  mrpPrice?: number | null;
  instantBooking?: boolean;
  roomTypes?: HotelRoomType[];
}

