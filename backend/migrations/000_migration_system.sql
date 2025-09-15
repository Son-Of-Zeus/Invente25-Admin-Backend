-- Migration tracker table to keep track of applied migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

-- Insert the initial migration record (001_init.sql is considered already applied)
INSERT INTO schema_migrations (version, description) 
VALUES ('001_init', 'Initial database schema')
ON CONFLICT (version) DO NOTHING;
