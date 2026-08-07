-- Create schema
CREATE SCHEMA IF NOT EXISTS listing;

-- Create reports table
CREATE TABLE IF NOT EXISTS listing.reports (
    id TEXT PRIMARY KEY,

    reporter_id TEXT NOT NULL,

    target_type VARCHAR(50) NOT NULL,
    target_id TEXT NOT NULL,

    reason VARCHAR(100) NOT NULL,
    description TEXT,

    status VARCHAR(50) NOT NULL DEFAULT 'pending',

    admin_note TEXT,
    resolved_at TIMESTAMP,
    resolved_by TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes from Prisma
CREATE INDEX IF NOT EXISTS reports_status_idx
ON listing.reports(status);

CREATE INDEX IF NOT EXISTS reports_target_type_target_id_idx
ON listing.reports(target_type, target_id);