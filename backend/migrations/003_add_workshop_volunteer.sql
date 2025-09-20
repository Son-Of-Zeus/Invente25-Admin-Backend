-- Migration 003: Add workshop_volunteer role
-- Description: Adds workshop_volunteer role to the WORKSHOP department
-- Note: This migration requires WORKSHOP_VOLUNTEER_PASSWORD environment variable

-- Add workshop_volunteer role (can handle workshop volunteer tasks)
INSERT INTO admins (email, password_hash, role, department_id)
VALUES ('workshop_volunteer@invente.local', crypt('S7r%4ZkG9qJt', gen_salt('bf')), 'workshop_volunteer', 11);
