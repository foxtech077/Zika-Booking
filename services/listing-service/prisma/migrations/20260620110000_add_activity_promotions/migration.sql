-- CreateTable: activity_promotions
-- One active promotion per activity category at a time.
-- status: scheduled | active | paused | expired | superseded

CREATE TABLE IF NOT EXISTS listing.activity_promotions (
    id              TEXT          NOT NULL,
    activity        VARCHAR(20)   NOT NULL,
    label_text      VARCHAR(6)    NOT NULL,
    label_colour    VARCHAR(10)   NOT NULL DEFAULT '#C84B2F',
    discount_type   VARCHAR(20)   NOT NULL DEFAULT 'label_only',
    discount_value  DECIMAL(10,2),
    valid_from      TIMESTAMP(3)  NOT NULL,
    valid_until     TIMESTAMP(3)  NOT NULL,
    apply_to_booking BOOLEAN      NOT NULL DEFAULT false,
    banner_title    VARCHAR(100)  NOT NULL,
    banner_subtitle VARCHAR(200),
    status          VARCHAR(20)   NOT NULL DEFAULT 'scheduled',
    country_scope   CHAR(2),
    created_at      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT activity_promotions_pkey PRIMARY KEY (id)
);

-- Only one promotion can be active per activity at a time (enforced in app logic,
-- but index keeps queries fast)
CREATE INDEX IF NOT EXISTS activity_promotions_activity_status_idx
    ON listing.activity_promotions (activity, status);

CREATE INDEX IF NOT EXISTS activity_promotions_status_valid_idx
    ON listing.activity_promotions (status, valid_from, valid_until);
