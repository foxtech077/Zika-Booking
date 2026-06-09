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
  instantBooking?: boolean;
}
