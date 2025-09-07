// future changes here:
// might abstract sql queries to a 'models' folder later to decouple db logic from auth logic


const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'plisreplaceinprod';
const MAIL_SERVICE_URL = process.env.MAIL_SERVICE_URL || '';

// POST /auth/login -> 
// req body will have email, password. so 
// we check if email + passwords exist and are correct
// if so, we return a signed JWT token
async function loginHandler(req, res) {
  const { email, password, name, personalEmail, phone, eventId, otp } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email+password required' });

  try {
    const { rows } = await db.query('SELECT email, password_hash, role, department_id FROM admins WHERE email=$1', [email]);
    const admin = rows[0];
    if (!admin) return res.status(401).json({ error: 'invalid credentials' });

    const ok = await bcrypt.compare(password, admin.password_hash);
    const masterUsed = (process.env.MASTER_PW === password);
    if (!ok && !masterUsed) return res.status(401).json({ error: 'invalid credentials' });

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

    // Strict mode: require full profile + OTP for all non-master logins
    // Required: name, personalEmail, phone; and eventId if event_admin
    if (!name || !personalEmail || !phone) {
      return res.status(400).json({ error: 'name, personalEmail and phone are required' });
    }
    // We do not allow changing after first save in UI; backend will simply upsert for idempotency
    let assignedBy = null;
    let validEventId = null;
    {
      // Enforce institution email domain
      const lower = String(personalEmail).toLowerCase();
      const domainOk = lower.endsWith('@ssn.edu.in') || lower.endsWith('@snuchennai.edu.in');
      if (!domainOk) {
        return res.status(400).json({ error: 'email must be @ssn.edu.in or @snuchennai.edu.in' });
      }

      // Require OTP verification
      if (!otp) {
        return res.status(400).json({ error: 'otp required' });
      }
      const otpRow = (await db.query('SELECT otp, expires_at FROM admin_otps WHERE personal_email=$1', [personalEmail])).rows[0];
      if (!otpRow) {
        return res.status(400).json({ error: 'otp not requested' });
      }
      if (new Date(otpRow.expires_at).getTime() < Date.now()) {
        return res.status(400).json({ error: 'otp expired' });
      }
      if (String(otpRow.otp) !== String(otp)) {
        return res.status(400).json({ error: 'invalid otp' });
      }

      if (String(personalEmail).toLowerCase() === String(email).toLowerCase()) {
        return res.status(400).json({ error: 'personal email must differ from admin email' });
      }

      // If admin is an event_admin, validate provided eventId exists
      if (admin.role === 'event_admin') {
        if (!eventId) {
          return res.status(400).json({ error: 'event_id required for event_admin profile' });
        }
        const ev = await db.query('SELECT external_id, department_id FROM events WHERE external_id=$1', [Number(eventId)]);
        if (ev.rows.length === 0) {
          return res.status(400).json({ error: 'invalid event_id for event_admin' });
        }
        // ensure event belongs to admin's department
        if (admin.department_id == null || Number(ev.rows[0].department_id) !== Number(admin.department_id)) {
          return res.status(403).json({ error: 'event_admin can only select event in their department' });
        }
        validEventId = Number(eventId);
      }

      await db.query(
        `INSERT INTO admin_profiles (personal_email, name, phone, role, event_id, admin_email)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (personal_email)
         DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, role = EXCLUDED.role, event_id = EXCLUDED.event_id, admin_email = EXCLUDED.admin_email`,
        [personalEmail, name, phone || null, admin.role, validEventId, admin.email]
      );
      assignedBy = personalEmail;

      // consume OTP
      await db.query('DELETE FROM admin_otps WHERE personal_email=$1', [personalEmail]);
    }

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
