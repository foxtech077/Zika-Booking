-- E5: Search & Discovery tables
CREATE TABLE IF NOT EXISTS user_favourites (
    user_id    TEXT        NOT NULL,
    listing_id UUID        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, listing_id)
);
CREATE INDEX IF NOT EXISTS idx_user_fav_user    ON user_favourites(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_fav_listing ON user_favourites(listing_id);

CREATE TABLE IF NOT EXISTS user_recently_viewed (
    user_id    TEXT        NOT NULL,
    listing_id UUID        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, listing_id)
);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user ON user_recently_viewed(user_id, viewed_at DESC);

CREATE TABLE IF NOT EXISTS search_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         TEXT,
    category        VARCHAR(20) NOT NULL,
    place_name      TEXT        NOT NULL DEFAULT '',
    lat             NUMERIC(10,7) NOT NULL,
    lng             NUMERIC(10,7) NOT NULL,
    radius_km       SMALLINT    NOT NULL DEFAULT 25,
    check_in        DATE,
    check_out       DATE,
    pickup_datetime TIMESTAMPTZ,
    return_datetime TIMESTAMPTZ,
    guests          SMALLINT,
    filters_applied JSONB       NOT NULL DEFAULT '{}',
    sort_applied    VARCHAR(20) NOT NULL DEFAULT 'recommended',
    result_count    INTEGER     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_search_logs_category ON search_logs(category, created_at DESC);

-- E6: Booking Engine tables
CREATE SEQUENCE IF NOT EXISTS booking_seq START 1 INCREMENT 1 NO CYCLE;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
        CREATE TYPE booking_status AS ENUM (
            'pending_payment',
            'confirmed',
            'completed',
            'cancelled_by_guest',
            'cancelled_by_provider',
            'cancelled_by_system'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS bookings (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    reference           VARCHAR(25)     UNIQUE NOT NULL,
    listing_id          UUID            NOT NULL REFERENCES listings(id),
    guest_id            TEXT            NOT NULL,
    provider_id         TEXT            NOT NULL,
    listing_type        VARCHAR(20)     NOT NULL,
    status              booking_status  NOT NULL DEFAULT 'pending_payment',
    check_in            DATE,
    check_out           DATE,
    pickup_datetime     TIMESTAMPTZ,
    return_datetime     TIMESTAMPTZ,
    nights_or_days      SMALLINT        NOT NULL,
    guest_first_name    VARCHAR(100)    NOT NULL,
    guest_last_name     VARCHAR(100)    NOT NULL,
    guest_email         VARCHAR(255)    NOT NULL,
    guest_phone         VARCHAR(30),
    adults              SMALLINT,
    children            SMALLINT        DEFAULT 0,
    special_requests    TEXT,
    driver_first_name   VARCHAR(100),
    driver_last_name    VARCHAR(100),
    driver_age          SMALLINT,
    delivery_requested  BOOLEAN         DEFAULT FALSE,
    delivery_address    TEXT,
    nightly_rate        NUMERIC(12,2),
    daily_rate          NUMERIC(12,2),
    subtotal            NUMERIC(12,2)   NOT NULL,
    discount_amount     NUMERIC(12,2)   NOT NULL DEFAULT 0,
    delivery_fee        NUMERIC(12,2)   NOT NULL DEFAULT 0,
    total_amount        NUMERIC(12,2)   NOT NULL,
    currency            CHAR(3)         NOT NULL,
    security_deposit    NUMERIC(12,2),
    commission_rate     NUMERIC(6,4)    NOT NULL,
    commission_amount   NUMERIC(12,2)   NOT NULL,
    provider_payout     NUMERIC(12,2)   NOT NULL,
    cancellation_policy VARCHAR(20)     NOT NULL,
    refund_amount       NUMERIC(12,2),
    cancelled_at        TIMESTAMPTZ,
    cancelled_by        VARCHAR(20),
    cancellation_reason TEXT,
    payment_id          TEXT,
    confirmed_at        TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bookings_guest    ON bookings(guest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_listing  ON bookings(listing_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_status   ON bookings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_checkin  ON bookings(check_in) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_bookings_checkout ON bookings(check_out) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_bookings_return   ON bookings(return_datetime) WHERE status = 'confirmed';

CREATE TABLE IF NOT EXISTS booking_status_log (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id  UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    from_status VARCHAR(30),
    to_status   VARCHAR(30) NOT NULL,
    changed_by  TEXT,
    actor_type  VARCHAR(20),
    reason      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_status_log_booking ON booking_status_log(booking_id, created_at DESC);
