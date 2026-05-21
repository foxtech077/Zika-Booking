-- CreateEnum
CREATE TYPE "ListingCategory" AS ENUM ('hotel', 'apartment', 'car');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('draft', 'pending_review', 'approved', 'rejected', 'active', 'deactivated', 'suspended', 'auto_suspended', 'permanently_banned');

-- CreateEnum
CREATE TYPE "LongStayDiscountType" AS ENUM ('percentage', 'fixed');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('manual', 'automatic');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('petrol', 'diesel', 'electric', 'hybrid');

-- CreateEnum
CREATE TYPE "MileagePolicy" AS ENUM ('unlimited', 'limited');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('standard', 'superior', 'deluxe', 'suite', 'junior_suite', 'studio', 'family_room', 'presidential_suite');

-- CreateEnum
CREATE TYPE "CancellationPolicy" AS ENUM ('flexible', 'moderate', 'strict');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('business_licence', 'operating_permit', 'tourism_certificate');

-- CreateEnum
CREATE TYPE "ReviewTaskStatus" AS ENUM ('open', 'awaiting_provider_response', 'resolved', 'escalated');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending_payment', 'confirmed', 'completed', 'cancelled_by_guest', 'cancelled_by_provider', 'cancelled_by_system');

-- CreateEnum
CREATE TYPE "VoucherDiscountType" AS ENUM ('percentage', 'fixed');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('open', 'closed');

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "category" "ListingCategory" NOT NULL,
    "name" VARCHAR(200),
    "room_type" "RoomType",
    "unit_count" INTEGER,
    "description" TEXT,
    "price_per_night" DECIMAL(10,2),
    "currency" CHAR(3),
    "min_stay_nights" INTEGER NOT NULL DEFAULT 1,
    "checkin_time" VARCHAR(5),
    "checkout_time" VARCHAR(5),
    "cancellation_policy" "CancellationPolicy",
    "smoking_allowed" BOOLEAN NOT NULL DEFAULT false,
    "pets_allowed" BOOLEAN NOT NULL DEFAULT false,
    "address" TEXT,
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "town" VARCHAR(100),
    "country" CHAR(2),
    "claimed_star_rating" INTEGER,
    "star_rating" INTEGER,
    "status" "ListingStatus" NOT NULL DEFAULT 'draft',
    "submission_count" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "rejection_reasons" TEXT[],
    "rejection_note" TEXT,
    "suspended_at" TIMESTAMP(3),
    "suspended_by" TEXT,
    "suspension_reason" TEXT,
    "consecutive_negative_count" INTEGER NOT NULL DEFAULT 0,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "max_guests" INTEGER,
    "long_stay_discount_enabled" BOOLEAN NOT NULL DEFAULT false,
    "long_stay_min_nights" INTEGER,
    "long_stay_discount_type" "LongStayDiscountType",
    "long_stay_discount_value" DECIMAL(10,2),
    "activated_at" TIMESTAMP(3),
    "car_make" VARCHAR(80),
    "car_model" VARCHAR(80),
    "car_year" INTEGER,
    "transmission" "Transmission",
    "fuel_type" "FuelType",
    "seats" INTEGER,
    "doors" INTEGER DEFAULT 4,
    "mileage_policy" "MileagePolicy",
    "mileage_limit_km" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_review_tasks" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "submission_number" INTEGER NOT NULL,
    "assigned_to" TEXT,
    "status" "ReviewTaskStatus" NOT NULL DEFAULT 'open',
    "outcome" TEXT,
    "admin_note" TEXT,
    "sla_deadline" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "listing_review_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_photos" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "s3_key" VARCHAR(500) NOT NULL,
    "cdn_url" VARCHAR(500) NOT NULL,
    "position" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "listing_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_documents" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "s3_key" VARCHAR(500) NOT NULL,
    "file_type" VARCHAR(10) NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replaced_at" TIMESTAMP(3),

    CONSTRAINT "listing_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_amenities" (
    "listing_id" TEXT NOT NULL,
    "amenity_key" VARCHAR(100) NOT NULL,

    CONSTRAINT "listing_amenities_pkey" PRIMARY KEY ("listing_id","amenity_key")
);

-- CreateTable
CREATE TABLE "listing_custom_amenities" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_custom_amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_favourites" (
    "user_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favourites_pkey" PRIMARY KEY ("user_id","listing_id")
);

-- CreateTable
CREATE TABLE "user_recently_viewed" (
    "user_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_recently_viewed_pkey" PRIMARY KEY ("user_id","listing_id")
);

-- CreateTable
CREATE TABLE "search_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "category" VARCHAR(20) NOT NULL,
    "place_name" TEXT NOT NULL,
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,
    "radius_km" INTEGER NOT NULL DEFAULT 25,
    "check_in" DATE,
    "check_out" DATE,
    "pickup_datetime" TIMESTAMP(3),
    "return_datetime" TIMESTAMP(3),
    "guests" INTEGER,
    "filters_applied" JSONB NOT NULL DEFAULT '{}',
    "sort_applied" VARCHAR(20) NOT NULL DEFAULT 'recommended',
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "reference" VARCHAR(25) NOT NULL,
    "listing_id" TEXT NOT NULL,
    "guest_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "listing_type" VARCHAR(20) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending_payment',
    "check_in" DATE,
    "check_out" DATE,
    "pickup_datetime" TIMESTAMP(3),
    "return_datetime" TIMESTAMP(3),
    "nights_or_days" INTEGER NOT NULL,
    "guest_first_name" VARCHAR(100) NOT NULL,
    "guest_last_name" VARCHAR(100) NOT NULL,
    "guest_email" VARCHAR(255) NOT NULL,
    "guest_phone" VARCHAR(30),
    "adults" INTEGER,
    "children" INTEGER DEFAULT 0,
    "special_requests" TEXT,
    "driver_first_name" VARCHAR(100),
    "driver_last_name" VARCHAR(100),
    "driver_age" INTEGER,
    "delivery_requested" BOOLEAN NOT NULL DEFAULT false,
    "delivery_address" TEXT,
    "nightly_rate" DECIMAL(12,2),
    "daily_rate" DECIMAL(12,2),
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "delivery_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "security_deposit" DECIMAL(12,2),
    "commission_rate" DECIMAL(6,4) NOT NULL,
    "commission_amount" DECIMAL(12,2) NOT NULL,
    "provider_payout" DECIMAL(12,2) NOT NULL,
    "cancellation_policy" VARCHAR(20) NOT NULL,
    "refund_amount" DECIMAL(12,2),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" VARCHAR(20),
    "cancellation_reason" TEXT,
    "payment_id" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "voucher_code" VARCHAR(30),
    "voucher_discount" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_log" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "from_status" VARCHAR(30),
    "to_status" VARCHAR(30) NOT NULL,
    "changed_by" TEXT,
    "actor_type" VARCHAR(20),
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_reviews" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "guest_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(100),
    "body" TEXT,
    "provider_reply" TEXT,
    "provider_replied_at" TIMESTAMP(3),
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "hidden_by" TEXT,
    "hidden_at" TIMESTAMP(3),
    "hidden_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rates" (
    "id" TEXT NOT NULL,
    "country" CHAR(2) NOT NULL,
    "rate" DECIMAL(6,4) NOT NULL,
    "set_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "discount_type" "VoucherDiscountType" NOT NULL,
    "discount_value" DECIMAL(10,2) NOT NULL,
    "min_order_value" DECIMAL(10,2),
    "max_discount" DECIMAL(10,2),
    "usage_limit" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_redemptions" (
    "id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "guest_id" TEXT NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ical_feeds" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "feed_url" VARCHAR(1000) NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "last_error" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ical_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ical_blocked_dates" (
    "id" TEXT NOT NULL,
    "feed_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "summary" VARCHAR(500),
    "uid" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ical_blocked_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT,
    "listing_id" TEXT NOT NULL,
    "guest_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_type" VARCHAR(20) NOT NULL,
    "body" TEXT NOT NULL,
    "is_filtered" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_reference_key" ON "bookings"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "listing_reviews_booking_id_key" ON "listing_reviews"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_rates_country_key" ON "commission_rates"("country");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_redemptions_booking_id_key" ON "voucher_redemptions"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "ical_blocked_dates_feed_id_uid_key" ON "ical_blocked_dates"("feed_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_booking_id_key" ON "conversations"("booking_id");

-- AddForeignKey
ALTER TABLE "listing_review_tasks" ADD CONSTRAINT "listing_review_tasks_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_documents" ADD CONSTRAINT "listing_documents_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_amenities" ADD CONSTRAINT "listing_amenities_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_custom_amenities" ADD CONSTRAINT "listing_custom_amenities_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favourites" ADD CONSTRAINT "user_favourites_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_recently_viewed" ADD CONSTRAINT "user_recently_viewed_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_log" ADD CONSTRAINT "booking_status_log_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ical_feeds" ADD CONSTRAINT "ical_feeds_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ical_blocked_dates" ADD CONSTRAINT "ical_blocked_dates_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "ical_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
