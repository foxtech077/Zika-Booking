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
  checkinTime: string;
  checkoutTime: string;
  cancellationPolicy: "flexible" | "moderate" | "strict" | "non_refundable";
  address: string;
  lat: number;
  lng: number;
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
  promoBadge?: { labelText: string; labelColour?: string } | null;
  mrpPrice?: number | null;
  instantBooking?: boolean;
  roomTypes?: HotelRoomType[];
}

