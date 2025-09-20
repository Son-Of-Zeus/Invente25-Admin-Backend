-- Migration 004: Randomize all admin passwords
-- Description: Updates all admin account passwords with secure random passwords for better security
-- Note: This migration requires password environment variables to be set in .env file

-- Update super_admin password  
UPDATE admins SET password_hash = crypt('X7k@9NvE2pQm', gen_salt('bf')) WHERE email = 'super_admin@invente.local';

-- Update master_admin password
UPDATE admins SET password_hash = crypt('F4n$8RwY6tLz', gen_salt('bf')) WHERE email = 'master_admin@invente.local';

-- Update workshop_admin password
UPDATE admins SET password_hash = crypt('M3g%5KxU9sHj', gen_salt('bf')) WHERE email = 'workshop_admin@invente.local';

-- Update central volunteer password
UPDATE admins SET password_hash = crypt('P2r*7VnI4qBw', gen_salt('bf')) WHERE email = 'volunteer_central@invente.local';

-- Update department admin passwords
UPDATE admins SET password_hash = crypt('L8x@3ZcA9mYt', gen_salt('bf')) WHERE email = 'dept_admin_csessn@invente.local';
UPDATE admins SET password_hash = crypt('R5j$6WbD2kPv', gen_salt('bf')) WHERE email = 'dept_admin_csesnu@invente.local';
UPDATE admins SET password_hash = crypt('N9h%4QfG7xLs', gen_salt('bf')) WHERE email = 'dept_admin_it@invente.local';
UPDATE admins SET password_hash = crypt('T6w@8MnK3yRz', gen_salt('bf')) WHERE email = 'dept_admin_ece@invente.local';
UPDATE admins SET password_hash = crypt('K4v*9XjH5cBm', gen_salt('bf')) WHERE email = 'dept_admin_eee@invente.local';
UPDATE admins SET password_hash = crypt('G7q$2YnL8wFt', gen_salt('bf')) WHERE email = 'dept_admin_chem@invente.local';
UPDATE admins SET password_hash = crypt('S3x%6ZpM9kJv', gen_salt('bf')) WHERE email = 'dept_admin_mech@invente.local';
UPDATE admins SET password_hash = crypt('B8r@4WcN7mQy', gen_salt('bf')) WHERE email = 'dept_admin_civil@invente.local';
UPDATE admins SET password_hash = crypt('H5t&9VxF2nLw', gen_salt('bf')) WHERE email = 'dept_admin_bme@invente.local';
UPDATE admins SET password_hash = crypt('D6s$3KjG8pRz', gen_salt('bf')) WHERE email = 'dept_admin_com@invente.local';
UPDATE admins SET password_hash = crypt('A9m%7XnH4yBv', gen_salt('bf')) WHERE email = 'dept_admin_workshop@invente.local';

-- Update event admin passwords
UPDATE admins SET password_hash = crypt('E2k@8YwL6tQm', gen_salt('bf')) WHERE email = 'event_admin_csessn@invente.local';
UPDATE admins SET password_hash = crypt('J7n$4RvM9xHs', gen_salt('bf')) WHERE email = 'event_admin_csesnu@invente.local';
UPDATE admins SET password_hash = crypt('W3p%6ZcN2kFy', gen_salt('bf')) WHERE email = 'event_admin_it@invente.local';
UPDATE admins SET password_hash = crypt('Q8x@5MjB7wLt', gen_salt('bf')) WHERE email = 'event_admin_ece@invente.local';
UPDATE admins SET password_hash = crypt('Y4r&9VnG3mPz', gen_salt('bf')) WHERE email = 'event_admin_eee@invente.local';
UPDATE admins SET password_hash = crypt('U6w$2XkH8qRv', gen_salt('bf')) WHERE email = 'event_admin_chem@invente.local';
UPDATE admins SET password_hash = crypt('I9t%7ZpL4yBm', gen_salt('bf')) WHERE email = 'event_admin_mech@invente.local';
UPDATE admins SET password_hash = crypt('O3s@6WcM9kJs', gen_salt('bf')) WHERE email = 'event_admin_civil@invente.local';
UPDATE admins SET password_hash = crypt('C5v*8YnF2nQw', gen_salt('bf')) WHERE email = 'event_admin_bme@invente.local';
UPDATE admins SET password_hash = crypt('V7k$4XjD9pLz', gen_salt('bf')) WHERE email = 'event_admin_com@invente.local';
UPDATE admins SET password_hash = crypt('Z2m%6RwG8xHt', gen_salt('bf')) WHERE email = 'event_admin_workshop@invente.local';

-- Update department volunteer passwords
UPDATE admins SET password_hash = crypt('Q4j@7MnK3yRv', gen_salt('bf')) WHERE email = 'volunteer_dept_csessn@invente.local';
UPDATE admins SET password_hash = crypt('W8x$2ZpL6wBm', gen_salt('bf')) WHERE email = 'volunteer_dept_csesnu@invente.local';
UPDATE admins SET password_hash = crypt('E5r%9VcN4kFt', gen_salt('bf')) WHERE email = 'volunteer_dept_it@invente.local';
UPDATE admins SET password_hash = crypt('T3s*6XjM8qJz', gen_salt('bf')) WHERE email = 'volunteer_dept_ece@invente.local';
UPDATE admins SET password_hash = crypt('Y7w@4YnH2mLy', gen_salt('bf')) WHERE email = 'volunteer_dept_eee@invente.local';
UPDATE admins SET password_hash = crypt('U9k$8ZxG6pQw', gen_salt('bf')) WHERE email = 'volunteer_dept_chem@invente.local';
UPDATE admins SET password_hash = crypt('I2v%5WcF9yRs', gen_salt('bf')) WHERE email = 'volunteer_dept_mech@invente.local';
UPDATE admins SET password_hash = crypt('O6t&3MjB7kHv', gen_salt('bf')) WHERE email = 'volunteer_dept_civil@invente.local';
UPDATE admins SET password_hash = crypt('P4n@9XpD2wLz', gen_salt('bf')) WHERE email = 'volunteer_dept_bme@invente.local';
UPDATE admins SET password_hash = crypt('A8s$6VnL5xFm', gen_salt('bf')) WHERE email = 'volunteer_dept_com@invente.local';
UPDATE admins SET password_hash = crypt('S7r%4ZkG9qJt', gen_salt('bf')) WHERE email = 'volunteer_dept_workshop@invente.local';
