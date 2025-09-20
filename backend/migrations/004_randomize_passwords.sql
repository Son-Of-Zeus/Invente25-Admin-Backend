-- Migration 004: Randomize all admin passwords
-- Description: Updates all admin account passwords with secure random passwords for better security
-- Note: This migration requires password environment variables to be set in .env file

-- Update super_admin password
UPDATE admins SET password_hash = crypt('${SUPER_ADMIN_PASSWORD}', gen_salt('bf')) WHERE email = 'super_admin@invente.local';

-- Update master_admin password
UPDATE admins SET password_hash = crypt('${MASTER_ADMIN_PASSWORD}', gen_salt('bf')) WHERE email = 'master_admin@invente.local';

-- Update workshop_admin password
UPDATE admins SET password_hash = crypt('${WORKSHOP_ADMIN_PASSWORD}', gen_salt('bf')) WHERE email = 'workshop_admin@invente.local';

-- Update central volunteer password
UPDATE admins SET password_hash = crypt('${CENTRAL_VOLUNTEER_PASSWORD}', gen_salt('bf')) WHERE email = 'volunteer_central@invente.local';

-- Update department admin passwords
UPDATE admins SET password_hash = crypt('${DEPT_ADMIN_CSE_SSN_PASSWORD}', gen_salt('bf')) WHERE email = 'dept_admin_csessn@invente.local';
UPDATE admins SET password_hash = crypt('${DEPT_ADMIN_CSE_SNU_PASSWORD}', gen_salt('bf')) WHERE email = 'dept_admin_csesnu@invente.local';
UPDATE admins SET password_hash = crypt('${DEPT_ADMIN_IT_PASSWORD}', gen_salt('bf')) WHERE email = 'dept_admin_it@invente.local';
UPDATE admins SET password_hash = crypt('${DEPT_ADMIN_ECE_PASSWORD}', gen_salt('bf')) WHERE email = 'dept_admin_ece@invente.local';
UPDATE admins SET password_hash = crypt('${DEPT_ADMIN_EEE_PASSWORD}', gen_salt('bf')) WHERE email = 'dept_admin_eee@invente.local';
UPDATE admins SET password_hash = crypt('${DEPT_ADMIN_CHEM_PASSWORD}', gen_salt('bf')) WHERE email = 'dept_admin_chem@invente.local';
UPDATE admins SET password_hash = crypt('${DEPT_ADMIN_MECH_PASSWORD}', gen_salt('bf')) WHERE email = 'dept_admin_mech@invente.local';
UPDATE admins SET password_hash = crypt('${DEPT_ADMIN_CIVIL_PASSWORD}', gen_salt('bf')) WHERE email = 'dept_admin_civil@invente.local';
UPDATE admins SET password_hash = crypt('${DEPT_ADMIN_BME_PASSWORD}', gen_salt('bf')) WHERE email = 'dept_admin_bme@invente.local';
UPDATE admins SET password_hash = crypt('${DEPT_ADMIN_COM_PASSWORD}', gen_salt('bf')) WHERE email = 'dept_admin_com@invente.local';
UPDATE admins SET password_hash = crypt('${DEPT_ADMIN_WORKSHOP_PASSWORD}', gen_salt('bf')) WHERE email = 'dept_admin_workshop@invente.local';

-- Update event admin passwords
UPDATE admins SET password_hash = crypt('${EVENT_ADMIN_CSE_SSN_PASSWORD}', gen_salt('bf')) WHERE email = 'event_admin_csessn@invente.local';
UPDATE admins SET password_hash = crypt('${EVENT_ADMIN_CSE_SNU_PASSWORD}', gen_salt('bf')) WHERE email = 'event_admin_csesnu@invente.local';
UPDATE admins SET password_hash = crypt('${EVENT_ADMIN_IT_PASSWORD}', gen_salt('bf')) WHERE email = 'event_admin_it@invente.local';
UPDATE admins SET password_hash = crypt('${EVENT_ADMIN_ECE_PASSWORD}', gen_salt('bf')) WHERE email = 'event_admin_ece@invente.local';
UPDATE admins SET password_hash = crypt('${EVENT_ADMIN_EEE_PASSWORD}', gen_salt('bf')) WHERE email = 'event_admin_eee@invente.local';
UPDATE admins SET password_hash = crypt('${EVENT_ADMIN_CHEM_PASSWORD}', gen_salt('bf')) WHERE email = 'event_admin_chem@invente.local';
UPDATE admins SET password_hash = crypt('${EVENT_ADMIN_MECH_PASSWORD}', gen_salt('bf')) WHERE email = 'event_admin_mech@invente.local';
UPDATE admins SET password_hash = crypt('${EVENT_ADMIN_CIVIL_PASSWORD}', gen_salt('bf')) WHERE email = 'event_admin_civil@invente.local';
UPDATE admins SET password_hash = crypt('${EVENT_ADMIN_BME_PASSWORD}', gen_salt('bf')) WHERE email = 'event_admin_bme@invente.local';
UPDATE admins SET password_hash = crypt('${EVENT_ADMIN_COM_PASSWORD}', gen_salt('bf')) WHERE email = 'event_admin_com@invente.local';
UPDATE admins SET password_hash = crypt('${EVENT_ADMIN_WORKSHOP_PASSWORD}', gen_salt('bf')) WHERE email = 'event_admin_workshop@invente.local';

-- Update department volunteer passwords
UPDATE admins SET password_hash = crypt('${VOLUNTEER_CSE_SSN_PASSWORD}', gen_salt('bf')) WHERE email = 'volunteer_dept_csessn@invente.local';
UPDATE admins SET password_hash = crypt('${VOLUNTEER_CSE_SNU_PASSWORD}', gen_salt('bf')) WHERE email = 'volunteer_dept_csesnu@invente.local';
UPDATE admins SET password_hash = crypt('${VOLUNTEER_IT_PASSWORD}', gen_salt('bf')) WHERE email = 'volunteer_dept_it@invente.local';
UPDATE admins SET password_hash = crypt('${VOLUNTEER_ECE_PASSWORD}', gen_salt('bf')) WHERE email = 'volunteer_dept_ece@invente.local';
UPDATE admins SET password_hash = crypt('${VOLUNTEER_EEE_PASSWORD}', gen_salt('bf')) WHERE email = 'volunteer_dept_eee@invente.local';
UPDATE admins SET password_hash = crypt('${VOLUNTEER_CHEM_PASSWORD}', gen_salt('bf')) WHERE email = 'volunteer_dept_chem@invente.local';
UPDATE admins SET password_hash = crypt('${VOLUNTEER_MECH_PASSWORD}', gen_salt('bf')) WHERE email = 'volunteer_dept_mech@invente.local';
UPDATE admins SET password_hash = crypt('${VOLUNTEER_CIVIL_PASSWORD}', gen_salt('bf')) WHERE email = 'volunteer_dept_civil@invente.local';
UPDATE admins SET password_hash = crypt('${VOLUNTEER_BME_PASSWORD}', gen_salt('bf')) WHERE email = 'volunteer_dept_bme@invente.local';
UPDATE admins SET password_hash = crypt('${VOLUNTEER_COM_PASSWORD}', gen_salt('bf')) WHERE email = 'volunteer_dept_com@invente.local';
UPDATE admins SET password_hash = crypt('${VOLUNTEER_WORKSHOP_PASSWORD}', gen_salt('bf')) WHERE email = 'volunteer_dept_workshop@invente.local';
