
CREATE TABLE listing.platform_settings (
    id VARCHAR(255) PRIMARY KEY DEFAULT 'global',

    global_commission_rate DECIMAL(6,4) NOT NULL DEFAULT 0.0500,

    pending_global_rate DECIMAL(6,4),

    pending_global_effective_from TIMESTAMP,

    pending_global_reason VARCHAR(500),

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_by VARCHAR(100)
);

INSERT INTO listing.platform_settings (
    id,
    global_commission_rate
)
VALUES (
    'global',
    0.0500
)
ON CONFLICT (id) DO NOTHING;