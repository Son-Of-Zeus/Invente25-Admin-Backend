-- Migration 002: Add new admin roles
-- Description: Adds master_admin and workshop_admin roles to the system

-- Add master_admin role (can do everything super_admin can except database operations)
INSERT INTO admins (email, password_hash, role, department_id)
VALUES ('master_admin@invente.local', crypt('Inv3nt3Master@2025', gen_salt('bf')), 'master_admin', NULL);

-- Add workshop_admin role (can handle workshop registrations and analytics)  
INSERT INTO admins (email, password_hash, role, department_id)
VALUES ('workshop_admin@invente.local', crypt('Inv3nt3Workshop@2025', gen_salt('bf')), 'workshop_admin', (SELECT id FROM departments WHERE name = 'WORKSHOP'));
