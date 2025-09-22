// future changes here:
// might abstract sql queries to a 'models' folder later to decouple db logic from auth logic


const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'plisreplaceinprod';
const MAIL_SERVICE_URL = process.env.MAIL_SERVICE_URL || '';

// Department admin email restrictions - loaded from configuration file
const DEPT_ADMIN_ALLOWED_EMAILS = require('../config/departmentAdminEmails.json');

// Function to validate department admin email restrictions
function isEmailAllowedForDepartment(email, department, role) {
  // No restrictions for workshop admins
  if (role === 'workshop') {
    return true;
  }
  
  // No restrictions for super_admin
  if (role === 'super_admin') {
    return true;
  }
  
  // For department admins, check if email is in allowed list
  if (role === 'dept_admin') {
    const allowedEmails = DEPT_ADMIN_ALLOWED_EMAILS[department];
    if (!allowedEmails) {
      return false; // Department not found in restrictions
    }
    return allowedEmails.includes(email);
  }
  
  return true; // Default allow for other roles
}

// POST /auth/login -> 
// req body will have email, password. so 
// we check if email + passwords exist and are correct
// if so, we return a signed JWT token
async function loginHandler(req, res) {
  const { email, password, name, personalEmail, phone, eventId, otp, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email+password required' });

  try {
    const { rows } = await db.query('SELECT email, password_hash, role, department_id FROM admins WHERE email=$1', [email]);
    const admin = rows[0];
    if (!admin) return res.status(401).json({ error: 'invalid credentials' });

    const ok = await bcrypt.compare(password, admin.password_hash);
    const masterUsed = (process.env.MASTER_PW === password);
    if (!ok && !masterUsed) return res.status(401).json({ error: 'invalid credentials' });

    // Validate role dropdown matches admin's actual role (unless master password used)
    // Special case: workshop_volunteer can select "volunteer" role for better UX
    const isWorkshopVolunteerUsingVolunteerRole = 
      admin.email === 'workshop_volunteer@invente.local' && 
      admin.role === 'workshop_volunteer' && 
      role === 'volunteer';
    
    if (!masterUsed && role && role !== admin.role && !isWorkshopVolunteerUsingVolunteerRole) {
      return res.status(400).json({ error: `Role mismatch: your account is registered as ${admin.role}, but you selected ${role}` });
    }

    // If master password used, skip OTP/profile and log in directly
    if (masterUsed) {
      // Try to include event_id from existing profile if any
      let eventIdFromProfile = null;
      try {
        const prof = await db.query('SELECT event_id FROM admin_profiles WHERE admin_email=$1 LIMIT 1', [admin.email]);
        if (prof.rows[0] && prof.rows[0].event_id != null && !eventId) {
          eventIdFromProfile = Number(prof.rows[0].event_id);
        }
      } catch (_) {}
      const token = jwt.sign({ email: admin.email, role: admin.role, department_id: admin.department_id, assigned_by: null, event_id: eventIdFromProfile }, JWT_SECRET, { expiresIn: '24h' });
      return res.json({ token });
    }

    // Check if this personal email already has a profile
    let existingProfile = null;
    if (personalEmail) {
      const profileResult = await db.query('SELECT * FROM admin_profiles WHERE personal_email = $1', [personalEmail.toLowerCase()]);
      existingProfile = profileResult.rows[0];
    }

    let finalName, finalPersonalEmail, finalPhone, finalEventId;

    if (existingProfile) {
      // RETURNING USER - validate admin_email match and use stored details
      if (existingProfile.admin_email.toLowerCase() !== admin.email.toLowerCase()) {
        return res.status(400).json({ 
          error: `This personal email is registered with a different admin account. Please use the correct admin email.` 
        });
      }

      // Use stored profile details
      finalName = existingProfile.name;
      finalPersonalEmail = existingProfile.personal_email;
      finalPhone = existingProfile.phone;
      finalEventId = existingProfile.event_id;
      
      // Still require OTP verification
      if (!otp) {
        return res.status(400).json({ error: 'OTP required for profile verification' });
      }
      
      const otpRow = (await db.query('SELECT otp, expires_at FROM admin_otps WHERE personal_email=$1', [finalPersonalEmail])).rows[0];
      if (!otpRow) {
        return res.status(400).json({ error: 'OTP not requested for this email' });
      }
      if (new Date(otpRow.expires_at).getTime() < Date.now()) {
        return res.status(400).json({ error: 'OTP expired' });
      }
      if (String(otpRow.otp) !== String(otp)) {
        return res.status(400).json({ error: 'Invalid OTP' });
      }
    } else {
      // NEW USER - validate role and all required fields
      if (!name || !personalEmail || !phone) {
        return res.status(400).json({ error: 'name, personalEmail and phone are required' });
      }

      // Validate role dropdown matches admin account's role
      // Special case: workshop_volunteer can select "volunteer" role for better UX
      const isWorkshopVolunteerUsingVolunteerRole = 
        admin.email === 'workshop_volunteer@invente.local' && 
        admin.role === 'workshop_volunteer' && 
        role === 'volunteer';
      
      if (role && role !== admin.role && !isWorkshopVolunteerUsingVolunteerRole) {
        return res.status(400).json({ error: `Role mismatch: your account is registered as ${admin.role}, but you selected ${role}` });
      }

      finalName = name;
      finalPersonalEmail = personalEmail;
      finalPhone = phone;
      finalEventId = eventId;
    }

    // Common validations for both new and existing users
    let assignedBy = finalPersonalEmail;
    let validEventId = finalEventId;

    // Enforce institution email domain
    const lower = String(finalPersonalEmail).toLowerCase();
    const domainOk = lower.endsWith('@ssn.edu.in') || lower.endsWith('@snuchennai.edu.in');
    if (!domainOk) {
      return res.status(400).json({ error: 'Personal email must be @ssn.edu.in or @snuchennai.edu.in' });
    }

    // Personal email must differ from admin email
    if (String(finalPersonalEmail).toLowerCase() === String(email).toLowerCase()) {
      return res.status(400).json({ error: 'Personal email must differ from admin email' });
    }

    // Handle OTP verification for new users (existing users already verified above)
    if (!existingProfile) {
      if (!otp) {
        return res.status(400).json({ error: 'OTP required' });
      }
      const otpRow = (await db.query('SELECT otp, expires_at FROM admin_otps WHERE personal_email=$1', [finalPersonalEmail])).rows[0];
      if (!otpRow) {
        return res.status(400).json({ error: 'OTP not requested' });
      }
      if (new Date(otpRow.expires_at).getTime() < Date.now()) {
        return res.status(400).json({ error: 'OTP expired' });
      }
      if (String(otpRow.otp) !== String(otp)) {
        return res.status(400).json({ error: 'Invalid OTP' });
      }
    }

    // Event admin validation (for both new and existing users)
    if (admin.role === 'event_admin') {
      if (!finalEventId) {
        return res.status(400).json({ error: 'Event ID required for event admin profile' });
      }
      const ev = await db.query('SELECT external_id, department_id FROM events WHERE external_id=$1', [Number(finalEventId)]);
      if (ev.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid event ID for event admin' });
      }
      // Ensure event belongs to admin's department
      if (admin.department_id == null || Number(ev.rows[0].department_id) !== Number(admin.department_id)) {
        return res.status(403).json({ error: 'Event admin can only select events in their department' });
      }
      validEventId = Number(finalEventId);
    }

    // Validate email restrictions for department admins (new users only)
    if (!existingProfile && admin.role === 'dept_admin') {
      // Get department name from department_id
      const deptResult = await db.query('SELECT name FROM departments WHERE id = $1', [admin.department_id]);
      if (deptResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid department' });
      }
      const departmentName = deptResult.rows[0].name;
      
      // Check if email is allowed for this department
      if (!isEmailAllowedForDepartment(finalPersonalEmail, departmentName, admin.role)) {
        return res.status(403).json({ 
          error: `Email ${finalPersonalEmail} is not authorized for ${departmentName} department admin access. Please contact the system administrator.` 
        });
      }
    }

    // Create profile for new users only
    if (!existingProfile) {
      await db.query(
        `INSERT INTO admin_profiles (personal_email, name, phone, role, event_id, admin_email)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [finalPersonalEmail, finalName, finalPhone || null, admin.role, validEventId, admin.email]
      );
    }

    // Consume OTP
    await db.query('DELETE FROM admin_otps WHERE personal_email=$1', [finalPersonalEmail]);

    const token = jwt.sign({ email: admin.email, role: admin.role, department_id: admin.department_id, assigned_by: assignedBy, event_id: validEventId }, JWT_SECRET, { expiresIn: '24h' });
    // above line include the admin's role in token to be used for RBAC later. 
    // dept_id is currently here because we need to show analytics that are dept_specific for department admins. will figure that out aprom
    // should be chill
    res.json({ token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
}

// 
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' });
  const token = auth.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET); // this returns the payload we signed when logging in
    req.user = payload; // { email, role, department_id, iat, exp }
    // this can be modified in the frontend but routes will be protected by requireRole
    next();

  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

// middleware to require specific roles -> so this just checks if req.user.role is in allowed roles
function requireRole(allowed = []) {

  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'missing user' });
    if (!allowed.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });

    next();
  };
}

module.exports = { loginHandler, authMiddleware, requireRole };
