"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { listingApi } from "@/lib/listing-api";
import { useAuthStore } from "@/stores/auth";
import { useFavourites } from "@/hooks/useFavourites";
import { showToast } from "@/components/ui/Toast";
import { isPromotionValid, type ActivePromotion } from "../../traveller/utils/promo-utils";
import PhotoGallery from "../../traveller/components/PhotoGallery";
import MapView from "../../traveller/components/MapView";
import DateRangePicker from "../../traveller/components/DateRangePicker";
import { MessageProviderButton } from "../../traveller/components/MessageProviderButton";
import { GiveReviewEntry } from "../../traveller/components/GiveReviewEntry";
import { PublicReviewsSection } from "../../traveller/components/PublicReviewsSection";
import type { PublicListingDetail } from "@/types";

const AMENITY_LABELS: Record<string, string> = {
  wifi: "High-Speed Wi-Fi", smart_tv: "Smart TV", work_desk: "Work Desk",
  printer: "Printer", workspace: "Workspace", breakfast: "Breakfast",
  restaurant_on_site: "Restaurant", coffee_machine: "Coffee Machine",
  minibar: "Minibar", kitchen: "Kitchen", pool: "Pool", gym: "Gym",
  spa: "Spa", sauna: "Sauna", hot_tub: "Hot Tub", fitness_centre: "Fitness Centre",
  ac: "Air Conditioning", heating: "Heating", laundry: "Laundry", parking: "Parking",
  elevator: "Elevator", accessible: "Wheelchair Accessible", reception_24h: "24/7 Reception",
  airport_shuttle: "Airport Shuttle", security_24h: "24/7 Security",
  shop_on_site: "Shop On-Site", pet_friendly: "Pet Friendly", tv: "TV",
  fireplace: "Fireplace", balcony: "Balcony", washer: "Washer & Dryer",
};

interface PricingPreview {
  baseAmount: number;
  promotionDiscount: number;
  serviceFee: number;
  taxAmount: number;
  taxRate?: number;
  deliveryFee?: number;
  securityDeposit?: number;
  totalAmount: number;
  commissionRate?: number;
}

interface ListingDetailClientProps {
  listingId: string;
  checkIn?: string;
  checkOut?: string;
  pickup?: string;
  returnDate?: string;
  guests?: string;
}

function toIsoDatetime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  if (dateStr.includes("T")) return dateStr;
  return new Date(dateStr + "T00:00:00Z").toISOString();
}

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  try {
    const [sy, sm, sd] = start.split("-").map(Number);
    const [ey, em, ed] = end.split("-").map(Number);
    if (
      sy !== undefined && sm !== undefined && sd !== undefined &&
      ey !== undefined && em !== undefined && ed !== undefined &&
      !isNaN(sy) && !isNaN(sm) && !isNaN(sd) && !isNaN(ey) && !isNaN(em) && !isNaN(ed)
    ) {
      const s = new Date(sy, sm - 1, sd).getTime();
      const e = new Date(ey, em - 1, ed).getTime();
      const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
      return Math.max(1, diff);
    }
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

export default function ListingDetailClient({
  listingId,
  checkIn = "",
  checkOut = "",
  pickup = "",
  returnDate = "",
  guests = "",
}: ListingDetailClientProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { isFavourited, toggleFavourite } = useFavourites();
  const getTodayString = () => new Date().toISOString().slice(0, 10);

  const [listing, setListing] = useState<PublicListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [detailCheckIn, setDetailCheckIn] = useState(checkIn);
  const [detailCheckOut, setDetailCheckOut] = useState(checkOut);
  const [detailPickupDate, setDetailPickupDate] = useState(pickup);
  const [detailReturnDate, setDetailReturnDate] = useState(returnDate);
  const [guestsCount, setGuestsCount] = useState<number>(() => {
    const parsed = parseInt(guests, 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : 2;
  });
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string | null>(null);
  const [deliveryRequested, setDeliveryRequested] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");

  const [availabilityStatus, setAvailabilityStatus] = useState<"checking" | "available" | "unavailable" | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState("");
  const [estimatedPricing, setEstimatedPricing] = useState<PricingPreview | null>(null);
  const [activePromotion, setActivePromotion] = useState<ActivePromotion | null>(null);
  const [promotionLoaded, setPromotionLoaded] = useState(false);
  const [lockingListing, setLockingListing] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const lockAcquiredRef = useRef(false);

  useEffect(() => {
    if (user) {
      setFirstName((prev) => prev || user.firstName || "");
      setLastName((prev) => prev || user.lastName || "");
      setEmail((prev) => prev || user.email || "");
      setPhone((prev) => prev || user.phone || "");
    }
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    listingApi
      .get<any>(`/listings/${listingId}/public`)
      .then((res) => {
        if (!isMounted) return;
        if (res.data.success && res.data.data) {
          const item = res.data.data;
          const rawRoomTypes = item.hotelRoomTypes || item.roomTypes || [];
          const details: PublicListingDetail = {
            id: item.id,
            providerId: item.providerId,
            category: item.category,
            name: item.name,
            description: item.description ?? "",
            pricePerNight: (() => {
              let basePrice = Number(item.pricePerNight || item.pricePerDay || 0);
              if ((item.category === "hotel" || item.listingType === "hotel") && Array.isArray(rawRoomTypes) && rawRoomTypes.length > 0) {
                const activeRts = rawRoomTypes.filter((rt: any) => rt.isActive !== false);
                if (activeRts.length > 0) {
                  const prices = activeRts
                    .map((rt: any) => Number(rt.pricePerNight))
                    .filter((p: number) => !isNaN(p) && p > 0);
                  if (prices.length > 0) basePrice = Math.min(...prices);
                }
              }
              return basePrice;
            })(),
            currency: item.currency || "KES",
            minStayNights: item.minStayNights || 1,
            commissionRate: item.commissionRate ?? null,
            checkinTime: item.checkinTime ?? "",
            checkoutTime: item.checkoutTime ?? "",
            cancellationPolicy: item.cancellationPolicy || "flexible",
            address: item.address ?? "",
            lat: item.lat ?? undefined,
            lng: item.lng ?? undefined,
            town: item.town ?? "",
            neighborhood: item.neighborhood ?? null,
            country: item.country ?? "",
            starRating: item.starRating,
            carMake: item.carMake,
            carModel: item.carModel,
            carYear: item.carYear,
            transmission: item.transmission,
            fuelType: item.fuelType,
            seats: item.seats,
            mileagePolicy: item.mileagePolicy,
            securityDeposit: item.securityDeposit ? Number(item.securityDeposit) : undefined,
            driverProvided: item.driverProvided ?? false,
            deliveryAvailable: !!item.deliveryEnabled,
            deliveryFee: item.deliveryFee != null ? Number(item.deliveryFee) : null,
            deliveryRadiusKm: item.deliveryRadiusKm != null ? Number(item.deliveryRadiusKm) : null,
            primaryPhotoUrl: item.primaryPhotoUrl || item.photos?.[0]?.cdnUrl || null,
            photos: item.photos || (item.primaryPhotoUrl ? [{ id: "ph", cdnUrl: item.primaryPhotoUrl, position: 1 }] : []),
            amenities: item.amenities || [],
            customAmenities: item.customAmenities || [],
            isAccredited: item.isAccredited ?? false,
            longStayDiscountEnabled: item.longStayDiscountEnabled ?? false,
            longStayEnabled: item.longStayEnabled ?? null,
            longStayMinNights: item.longStayMinNights ?? null,
            longStayDiscountType: item.longStayDiscountType ?? null,
            longStayDiscountValue: item.longStayDiscountValue ?? null,
            allowPreBooking: item.allowPreBooking ?? false,
            promoBadge: item.promoBadge ?? null,
            mrpPrice: item.mrpPrice ?? null,
            instantBooking: item.instantBooking ?? false,
            roomTypes: rawRoomTypes,
            maxGuests: item.maxGuests,
            bedrooms: item.bedrooms,
            bathrooms: item.bathrooms,
            roomType: item.roomType,
            isFavourited: item.isFavourited,
          };
          setListing(details);
          if (details.category === "hotel" && Array.isArray(rawRoomTypes)) {
            const activeRts = rawRoomTypes.filter((rt: any) => rt.isActive !== false);
            if (activeRts.length > 0) {
              const sorted = [...activeRts].sort((a: any, b: any) => a.pricePerNight - b.pricePerNight);
              setSelectedRoomTypeId(sorted[0]?.id ?? null);
            }
          }
          listingApi.post("/guests/me/recently-viewed", { listingId }).catch(() => { });
        } else {
          setLoadError("Listing not found.");
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          const code = err?.response?.data?.error?.code;
          if (code === "NO_TOKEN" || err?.response?.status === 401) {
            router.push("/auth/login");
            return;
          }
          setLoadError("Unable to load this listing. Please try again.");
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [listingId]);

  const isCar = listing?.category === "car";
  const isHotel = listing?.category === "hotel";
  const selectedRt = isHotel
    ? (listing?.roomTypes ?? []).find((r) => r.id === selectedRoomTypeId) ?? null
    : null;
  const pricePerNight = selectedRt ? selectedRt.pricePerNight : (listing?.pricePerNight ?? 0);
  const days = calcDays(isCar ? detailPickupDate : detailCheckIn, isCar ? detailReturnDate : detailCheckOut);

  async function checkAvailability() {
    if (!listing) return;
    const start = isCar ? detailPickupDate : detailCheckIn;
    const end = isCar ? detailReturnDate : detailCheckOut;
    if (!start || !end) { setAvailabilityStatus(null); return; }
    setAvailabilityStatus("checking");
    try {
      const res = await listingApi.get<any>(`/listings/${listing.id}/availability`, {
        params: { start, end },
      });
      if (res.data.success) {
        const d = res.data.data ?? {};
        let unavailableRanges: { start: string; end: string }[] = [];
        if (isHotel) {
          if (!selectedRoomTypeId) { setAvailabilityStatus(null); return; }
          const rtAvail = (d.roomTypeAvailability ?? []).find((rt: any) => rt.roomTypeId === selectedRoomTypeId);
          unavailableRanges = rtAvail?.unavailableRanges ?? [];
        } else {
          unavailableRanges = d.unavailableRanges ?? [];
        }
        const userStart = isCar ? detailPickupDate : detailCheckIn;
        const userEnd = isCar ? detailReturnDate : detailCheckOut;
        if (!userStart || !userEnd) { setAvailabilityStatus(null); return; }
        const hasOverlap = unavailableRanges.some((r) => userStart < r.end && userEnd > r.start);
        setAvailabilityStatus(hasOverlap ? "unavailable" : "available");
      } else {
        setAvailabilityStatus("unavailable");
      }
    } catch {
      setAvailabilityStatus(null);
    }
  }

  async function fetchPricing(deliveryOverride?: boolean) {
    if (!listing) return;
    setPricingLoading(true);
    setPricingError("");
    const hasDates = (!!detailCheckIn && !!detailCheckOut) || (!!detailPickupDate && !!detailReturnDate);
    const start = isCar ? detailPickupDate : detailCheckIn;
    const end = isCar ? detailReturnDate : detailCheckOut;
    const wantDelivery = deliveryOverride ?? deliveryRequested;

    const promotionPromise = listingApi.get<any>("/promotions/active", {
      params: { activity: listing.category },
    });
    const pricingPromise = hasDates && !!start && !!end
      ? listingApi.post<any>("/bookings/pricing-estimate", {
          listingId: listing.id,
          roomTypeId: selectedRoomTypeId || undefined,
          checkIn: isCar ? undefined : detailCheckIn || undefined,
          checkOut: isCar ? undefined : detailCheckOut || undefined,
          pickupDatetime: isCar ? toIsoDatetime(detailPickupDate) || undefined : undefined,
          returnDatetime: isCar ? toIsoDatetime(detailReturnDate) || undefined : undefined,
          deliveryRequested: isCar ? wantDelivery : undefined,
          guests: guestsCount,
        })
      : Promise.resolve(null);

    try {
      const [promotionRes, pricingRes] = await Promise.all([promotionPromise, pricingPromise]);
      if (promotionRes.data?.success) {
        const raw = promotionRes.data.data ?? [];
        const promos: ActivePromotion[] = Array.isArray(raw) ? raw : (raw?.promotions ?? []);
        const normalised = promos.map((p: any) => ({ ...p, discountValue: Number(p.discountValue) }));
        const matched = normalised.filter((p: any) => p.activity === listing.category && isPromotionValid(p));
        setActivePromotion(matched.length > 0 ? (matched[0] ?? null) : null);
      } else {
        setActivePromotion(null);
      }
      setPromotionLoaded(true);

      if (pricingRes) {
        if (pricingRes.data?.success && pricingRes.data.data?.pricingPreview) {
          setEstimatedPricing(pricingRes.data.data.pricingPreview);
        } else {
          setEstimatedPricing(null);
          setPricingError("Service is currently unavailable. Please try again later.");
        }
      } else {
        setEstimatedPricing(null);
      }
    } catch {
      setEstimatedPricing(null);
      setActivePromotion(null);
      setPricingError("Service is currently unavailable. Please try again later.");
    } finally {
      setPricingLoading(false);
    }
  }

  useEffect(() => {
    if (!listing) return;
    setBookingError("");
    checkAvailability();
    fetchPricing();
  }, [detailCheckIn, detailCheckOut, detailPickupDate, detailReturnDate, listing?.id, selectedRoomTypeId, guestsCount, deliveryRequested]);

  async function handleShare() {
    const url = window.location.href;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      showToast("Link copied to clipboard");
    } catch {
      showToast("Could not copy the link. Copy it manually from the address bar.");
    }
  }

  async function handleToggleFavourite() {
    if (!listing) return;
    const res = await toggleFavourite(listing.id);
    if (res === "auth_required") {
      showToast("Please sign in to save listings");
    }
  }

  async function handleReserve() {
    if (!listing || lockAcquiredRef.current) return;
    setLockingListing(true);
    setBookingError("");

    const token = useAuthStore.getState().token ||
      (typeof window !== "undefined" ? (sessionStorage.getItem("zika:access_token") ?? localStorage.getItem("zika:access_token")) : null);
    const isAuth = useAuthStore.getState().isAuthenticated || !!token;
    if (!isAuth) {
      setLockingListing(false);
      router.push("/auth/login");
      return;
    }

    const body: Record<string, any> = {
      listingId: listing.id,
      guests: guestsCount,
    };

    if (isHotel) {
      if (!selectedRoomTypeId) {
        setBookingError("Please select a room type.");
        setLockingListing(false);
        return;
      }
      body.roomTypeId = selectedRoomTypeId;
    }

    if (!isCar) {
      if (!detailCheckIn || !detailCheckOut) {
        setBookingError("Please select check-in and check-out dates.");
        setLockingListing(false);
        return;
      }
      body.checkIn = detailCheckIn;
      body.checkOut = detailCheckOut;
    } else {
      if (!detailPickupDate || !detailReturnDate) {
        setBookingError("Please select pickup and return dates.");
        setLockingListing(false);
        return;
      }
      if (deliveryRequested && !deliveryAddress.trim()) {
        setBookingError("Please enter a delivery address.");
        setLockingListing(false);
        return;
      }
      body.pickupDatetime = toIsoDatetime(detailPickupDate);
      body.returnDatetime = toIsoDatetime(detailReturnDate);
      body.deliveryRequested = deliveryRequested;
      body.deliveryAddress = deliveryAddress.trim();
    }

    try {
      const res = await listingApi.post<any>("/bookings/initiate", body);
      if (res.data.success && res.data.data?.lockToken) {
        const lockToken = res.data.data.lockToken as string;
        const pricingPreview = res.data.data.pricingPreview ?? null;
        lockAcquiredRef.current = true;
        setLockingListing(false);

        const serverPromotionDiscount = pricingPreview?.promotionDiscount ?? 0;
        const discountSource: "promotion" | null =
          serverPromotionDiscount > 0 && activePromotion ? "promotion" : null;

        const ctx: Record<string, any> = {
          listingId: listing.id,
          listingTitle: listing.name,
          listingCategory: listing.category,
          listingPhoto: listing.primaryPhotoUrl ?? null,
          listingTown: listing.town,
          listingCountry: listing.country,
          pricePerNight,
          currency: listing.currency,
          checkIn: !isCar ? detailCheckIn : undefined,
          checkOut: !isCar ? detailCheckOut : undefined,
          pickupDatetime: isCar ? toIsoDatetime(detailPickupDate) : undefined,
          returnDatetime: isCar ? toIsoDatetime(detailReturnDate) : undefined,
          nightsOrDays: days,
          adults: guestsCount,
          children: 0,
          lockToken,
          lockExpiresAt: new Date(Date.now() + 300 * 1000).toISOString(),
          discountSource: discountSource ?? undefined,
          promotionId: discountSource === "promotion" && activePromotion ? activePromotion.id : undefined,
          firstName: firstName.trim() || (user?.firstName ?? ""),
          lastName: lastName.trim() || (user?.lastName ?? ""),
          email: email.trim() || (user?.email ?? ""),
          phone: phone.trim() || (user?.phone ?? ""),
          driverFirstName: isCar ? (firstName.trim() || user?.firstName || "") : undefined,
          driverLastName: isCar ? (lastName.trim() || user?.lastName || "") : undefined,
          driverAge: isCar ? 25 : undefined,
          deliveryRequested: isCar ? deliveryRequested : undefined,
          deliveryAddress: isCar ? deliveryAddress : undefined,
          roomTypeId: selectedRt ? selectedRt.id : undefined,
          roomTypeName: selectedRt ? selectedRt.name : undefined,
          roomType: selectedRt ? selectedRt.roomType : undefined,
          pricingPreview: pricingPreview ?? undefined,
          commissionRate: listing.commissionRate ?? undefined,
        };
        sessionStorage.setItem("zika:checkout", JSON.stringify(ctx));
        router.push("/booking/review");
      } else {
        const msg = res.data?.error?.message ?? (res.data as any)?.message ?? "Unable to hold these dates. Please try again.";
        setBookingError(msg);
      }
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      const msg =
        err?.response?.data?.error?.message ??
        err?.response?.data?.message ??
        err?.message ??
        "Unable to hold these dates. Please try again.";
      setBookingError(msg);
      if (code === "NO_TOKEN" || err?.response?.status === 401) {
        router.push("/auth/login");
      }
    } finally {
      setLockingListing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin h-10 w-10 border-4 border-[#1D8D2B] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (loadError || !listing) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-lg font-bold text-slate-800 mb-2">{loadError ?? "Listing not found."}</p>
          <Link href="/traveller" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1D8D2B] hover:underline">
            ← Back to search
          </Link>
        </div>
      </div>
    );
  }

  const isValidPromo = activePromotion && activePromotion.activity === listing.category && isPromotionValid(activePromotion);
  const basePrice = selectedRt ? selectedRt.pricePerNight : listing.pricePerNight;
  let displayPrice = basePrice;
  const hasLongStay = listing.longStayDiscountEnabled;
  const longStayPct = hasLongStay ? 15 : 0;
  if (isValidPromo) {
    const promoDiscount = activePromotion.discountType === "percentage"
      ? Number((basePrice * (Number(activePromotion.discountValue) / 100)).toFixed(2))
      : Number(Number(activePromotion.discountValue).toFixed(2));
    displayPrice = Math.max(0, basePrice - promoDiscount);
  } else if (hasLongStay) {
    displayPrice = Number((basePrice * (1 - longStayPct / 100)).toFixed(2));
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans antialiased">
      <main className="min-h-[calc(100vh-76px)]">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
          <div className="lg:col-span-12">
            <Link
              href="/traveller"
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-[#1D8D2B] transition shrink-0 uppercase tracking-wide"
            >
              <span>←</span> Back to Search
            </Link>
          </div>

          <div className="lg:col-span-12 space-y-4">
            <h1 className="text-4xl font-serif font-bold text-slate-900 leading-tight">
              {listing.name}
            </h1>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                {listing.starRating && <span className="flex items-center gap-1"><span className="text-[#1D8D2B]">⭐</span> {listing.starRating}</span>}
                <span className="text-slate-400">•</span>
                <span>{listing.address || `${listing.town}, ${listing.country}`}</span>
              </div>
              <div className="flex items-center gap-4 text-sm font-semibold text-slate-700">
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Share this listing"
                  className="flex items-center gap-2 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition border border-slate-300 bg-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Share
                </button>
                <button
                  type="button"
                  onClick={handleToggleFavourite}
                  aria-label={isFavourited(listing.id) ? "Remove from wishlist" : "Save to wishlist"}
                  className="flex items-center gap-2 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition border border-slate-300 bg-white"
                >
                  <svg className={`w-4 h-4 ${isFavourited(listing.id) ? "text-red-500 fill-current" : "text-slate-500"}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {isFavourited(listing.id) ? "Saved" : "Save"}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-12">
            <PhotoGallery
              listingId={listing.id}
              name={listing.name}
              imageUrl={listing.primaryPhotoUrl || listing.photos?.[0]?.cdnUrl}
              photos={listing.photos}
            />
          </div>

          <div className="lg:col-span-8 space-y-8 text-left text-slate-800">
            <div className="pb-5 border-b border-slate-200">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                {listing.category !== "car" ? (
                  <>
                    {listing.maxGuests && <span>{listing.maxGuests} guests</span>}
                    {listing.bedrooms && <><span>·</span><span>{listing.bedrooms} bedrooms</span></>}
                    {listing.bathrooms && <><span>·</span><span>{listing.bathrooms} baths</span></>}
                    {listing.roomType && <><span>·</span><span className="capitalize">{listing.roomType}</span></>}
                  </>
                ) : (
                  <>
                    {listing.carMake && <span>{listing.carMake} {listing.carModel} {listing.carYear}</span>}
                    {listing.seats && <><span>·</span><span>{listing.seats} seats</span></>}
                    {listing.transmission && <><span>·</span><span className="capitalize">{listing.transmission}</span></>}
                    {listing.fuelType && <><span>·</span><span className="capitalize">{listing.fuelType}</span></>}
                    {listing.driverProvided
                      ? <><span>·</span><span className="font-semibold text-emerald-700">Driver included</span></>
                      : listing.securityDeposit != null && listing.securityDeposit > 0 && <><span>·</span><span>Deposit: {listing.currency} {listing.securityDeposit.toLocaleString()}</span></>}
                  </>
                )}
              </div>
            </div>

            {listing.description && (
              <div className="pb-6 border-b border-slate-200">
                <p className="text-slate-600 leading-relaxed">{listing.description}</p>
              </div>
            )}

            {(listing.amenities?.length > 0 || listing.customAmenities?.length > 0) && (
              <div className="pb-6 border-b border-slate-200">
                <h2 className="text-xl font-semibold mb-5">What this place offers</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {listing.amenities.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 text-slate-700 text-sm">
                      <svg className="w-5 h-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {AMENITY_LABELS[a.amenityKey] ?? a.amenityKey}
                    </div>
                  ))}
                  {listing.customAmenities.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 text-slate-700 text-sm">
                      <svg className="w-5 h-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {a.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pb-6 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              {listing.cancellationPolicy && (
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cancellation</p>
                  <p className="font-semibold text-slate-800 mt-1 capitalize">{listing.cancellationPolicy}</p>
                </div>
              )}
              {listing.category !== "car" && listing.minStayNights > 1 && (
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Min Stay</p>
                  <p className="font-semibold text-slate-800 mt-1">{listing.minStayNights} nights</p>
                </div>
              )}
              {listing.category !== "car" && listing.checkinTime && (
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Check-in / out</p>
                  <p className="font-semibold text-slate-800 mt-1">{listing.checkinTime} → {listing.checkoutTime}</p>
                </div>
              )}
              {listing.category === "car" && listing.mileagePolicy && (
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mileage</p>
                  <p className="font-semibold text-slate-800 mt-1 capitalize">{listing.mileagePolicy}</p>
                </div>
              )}
            </div>

            <div className="pb-6">
              <h2 className="text-2xl font-semibold mb-3">Where you'll be</h2>
              {listing.address && <p className="text-slate-500 text-sm mb-4">{listing.address}</p>}
              <div className="w-full h-[300px] rounded-3xl overflow-hidden border border-slate-200 relative z-0">
                {listing.lat && listing.lng ? (
                  <MapView
                    listings={[listing]}
                    hoveredId={listing.id}
                    onHover={() => { }}
                    onSelect={() => { }}
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <div className="text-center space-y-2 text-slate-400">
                      <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      <p className="text-sm font-semibold text-slate-600">{listing.town}{listing.country ? `, ${listing.country}` : ""}</p>
                      <p className="text-xs text-slate-400 mt-1">Location coordinates not available</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <PublicReviewsSection listingId={listing.id} />
          </div>

          <div className="lg:col-span-4 relative lg:sticky lg:top-28 top-4 self-start">
            <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-6 text-left shadow-slate-200/50">
              {!promotionLoaded ? (
                <div className="mb-3 animate-pulse">
                  <div className="h-8 bg-slate-200 rounded w-1/2 mb-2" />
                  <div className="h-4 bg-slate-200 rounded w-1/4" />
                </div>
              ) : (
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-2xl font-extrabold text-slate-900">
                        {listing.currency} {displayPrice.toLocaleString()}
                      </span>
                      {basePrice > displayPrice && (
                        <span className="text-sm font-semibold line-through text-slate-400">
                          {listing.currency} {basePrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 font-medium mt-0.5">
                      / {isCar ? "day" : "night"}
                    </div>
                  </div>
                  {listing.starRating && (
                    <div className="text-sm font-semibold flex items-center gap-1 text-slate-800 bg-slate-50 border border-slate-100 rounded-full px-2.5 py-1">
                      ⭐ {listing.starRating}
                    </div>
                  )}
                </div>
              )}

              {isCar && listing.driverProvided && (
                <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 mb-3">
                  <span className="shrink-0">🧑‍✈️</span>
                  <span><strong>Driver included:</strong> a driver is provided with this vehicle — no security deposit is required.</span>
                </div>
              )}
              {isCar && !listing.driverProvided && listing.securityDeposit != null && listing.securityDeposit > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-3">
                  <span className="text-amber-600 font-bold">🔒</span>
                  <span><strong>Security deposit:</strong> {listing.currency} {listing.securityDeposit.toLocaleString()} — collected at booking.</span>
                </div>
              )}
              {activePromotion && (
                <div className="mb-4 flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                  <span className="text-base shrink-0">🏷️</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Best Offer</p>
                    <p className="text-xs font-semibold text-emerald-800 truncate">{activePromotion.name}</p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {activePromotion.discountType === "percentage"
                      ? `${activePromotion.discountValue}% off`
                      : `${listing.currency} ${activePromotion.discountValue} off`}
                  </span>
                </div>
              )}

              <div className="mb-4 space-y-3">
                {listing.allowPreBooking && <MessageProviderButton listingId={listing.id} />}
                <GiveReviewEntry listingId={listing.id} listingName={listing.name} />
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  {isCar ? (
                    <DateRangePicker
                      label="Rental Dates"
                      isCar
                      startDate={detailPickupDate}
                      endDate={detailReturnDate}
                      onChange={(start, end) => {
                        setDetailPickupDate(start);
                        setDetailReturnDate(end);
                      }}
                      minDate={getTodayString()}
                    />
                  ) : (
                    <>
                      <DateRangePicker
                        label="Check-in – Check-out"
                        startDate={detailCheckIn}
                        endDate={detailCheckOut}
                        onChange={(start, end) => {
                          setDetailCheckIn(start);
                          setDetailCheckOut(end);
                        }}
                        minDate={getTodayString()}
                      />
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guests</p>
                        <select
                          value={guestsCount}
                          onChange={(e) => setGuestsCount(Number(e.target.value))}
                          className="w-full mt-1 text-sm bg-transparent outline-none font-bold text-slate-700"
                        >
                          {[1, 2, 3, 4, 5, 6].map((n) => (
                            <option key={n} value={n}>{n} guest{n > 1 ? "s" : ""}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {isCar && listing.deliveryAvailable && (
                  <div className="p-3 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
                    <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Request vehicle delivery</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {listing.deliveryFee && listing.deliveryFee > 0
                            ? `${listing.currency} ${listing.deliveryFee.toLocaleString()} delivery fee · within ${listing.deliveryRadiusKm ?? "—"} km`
                            : `Free delivery · within ${listing.deliveryRadiusKm ?? "—"} km`}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={deliveryRequested}
                        onChange={(e) => {
                          setDeliveryRequested(e.target.checked);
                          if (detailPickupDate && detailReturnDate) {
                            fetchPricing(e.target.checked);
                          }
                        }}
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                      />
                    </label>
                    {deliveryRequested && (
                      <input
                        type="text"
                        required
                        placeholder="Delivery address"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D8D2B]"
                      />
                    )}
                  </div>
                )}

                {isHotel && listing.roomTypes && listing.roomTypes.length > 0 && (
                  <div className="p-3 border-t border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Room Type</p>
                    <select
                      value={selectedRoomTypeId || ""}
                      onChange={(e) => setSelectedRoomTypeId(e.target.value || null)}
                      className="w-full mt-1 text-sm bg-transparent outline-none font-semibold text-slate-800"
                    >
                      {listing.roomTypes
                        .filter((rt) => rt.isActive !== false)
                        .map((rt) => {
                          const rtBase = rt.pricePerNight;
                          let rtDisplay = rtBase;
                          if (isValidPromo) {
                            const promoDiscount = activePromotion.discountType === "percentage"
                              ? Number((rtBase * (Number(activePromotion.discountValue) / 100)).toFixed(2))
                              : Number(Number(activePromotion.discountValue).toFixed(2));
                            rtDisplay = Math.max(0, rtBase - promoDiscount);
                          } else if (hasLongStay) {
                            rtDisplay = Number((rtBase * (1 - longStayPct / 100)).toFixed(2));
                          }
                          return (
                            <option key={rt.id} value={rt.id}>
                              {rt.name} — {listing.currency} {rtDisplay.toLocaleString()}/night{rtBase > rtDisplay ? ` (was ${listing.currency} ${rtBase.toLocaleString()})` : ""}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                )}

                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guest details</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D8D2B]"
                    />
                    <input
                      type="text"
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D8D2B]"
                    />
                  </div>
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D8D2B]"
                  />
                  <input
                    type="tel"
                    placeholder="Phone (optional)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1D8D2B]"
                  />
                </div>

                {availabilityStatus === "checking" && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    Checking availability…
                  </div>
                )}
                {availabilityStatus === "unavailable" && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs font-semibold text-red-700">
                    Selected dates are no longer available. Please choose different dates.
                  </div>
                )}

                {bookingError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs font-semibold text-red-600">
                    {bookingError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleReserve}
                  disabled={lockingListing || pricingLoading || availabilityStatus === "unavailable" || availabilityStatus === "checking"}
                  className="w-full py-3.5 bg-[#0c2614] hover:bg-[#081b0d] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition text-sm"
                >
                  {lockingListing ? "Securing your dates…" : "Reserve — You won't be charged yet"}
                </button>

                {days > 0 && (
                  pricingLoading ? (
                    <div className="space-y-3 pt-2 border-t border-slate-100 animate-pulse">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-4 bg-slate-200 rounded w-1/2" />
                      <div className="h-4 bg-slate-200 rounded w-5/6" />
                      <div className="h-5 bg-slate-200 rounded w-2/3 mt-2" />
                    </div>
                  ) : pricingError ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs font-semibold text-red-600">
                      {pricingError}
                    </div>
                  ) : estimatedPricing ? (
                    <div className="space-y-2 pt-2 border-t border-slate-100 text-sm text-slate-600">
                      <div className="flex justify-between">
                        <span>{listing.currency} {pricePerNight.toLocaleString()} × {days} {isCar ? "day" : "night"}{days > 1 ? "s" : ""}</span>
                        <span>{listing.currency} {estimatedPricing.baseAmount.toLocaleString()}</span>
                      </div>
                      {isValidPromo && estimatedPricing.promotionDiscount > 0 && (
                        <div className="flex justify-between text-emerald-600 font-semibold">
                          <span>Promotional discount ({activePromotion.discountValue}%)</span>
                          <span>−{listing.currency} {estimatedPricing.promotionDiscount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Service fee{estimatedPricing.commissionRate ? ` (${Math.round(estimatedPricing.commissionRate * 100)}%)` : ''}</span>
                        <span>{listing.currency} {estimatedPricing.serviceFee.toLocaleString()}</span>
                      </div>
                      {estimatedPricing.taxAmount > 0 && (
                        <div className="flex justify-between text-slate-500">
                          <span>Taxes{estimatedPricing.taxRate ? ` (${Math.round(estimatedPricing.taxRate * 100)}%)` : ''}</span>
                          <span>{listing.currency} {estimatedPricing.taxAmount.toLocaleString()}</span>
                        </div>
                      )}
                      {estimatedPricing.deliveryFee != null && estimatedPricing.deliveryFee > 0 && (
                        <div className="flex justify-between">
                          <span>Delivery fee</span>
                          <span>{listing.currency} {estimatedPricing.deliveryFee.toLocaleString()}</span>
                        </div>
                      )}
                      {isCar && estimatedPricing.securityDeposit != null && estimatedPricing.securityDeposit > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>Security deposit</span>
                          <span>{listing.currency} {estimatedPricing.securityDeposit.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 mt-1">
                        <span>Total</span>
                        <span>{listing.currency} {estimatedPricing.totalAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
