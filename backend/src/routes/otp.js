const express = require('express');
const db = require('../db');
const axios = require('axios');
const { createPaymentHeaders } = require('../paymentAuth');
const router = express.Router();

function isValidInstitutionEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const lower = email.toLowerCase();
  return lower.endsWith('@ssn.edu.in') || lower.endsWith('@snuchennai.edu.in');
}

// Send OTP to personal email
router.post('/send-otp', async (req, res) => {
  try {
    // Trim inputs to prevent whitespace issues
    const personalEmail = req.body.personalEmail?.trim();
    const name = req.body.name?.trim();
    
    if (!personalEmail || !name) return res.status(400).json({ error: 'personalEmail and name required' });
    if (!isValidInstitutionEmail(personalEmail)) return res.status(400).json({ error: 'email must be @ssn.edu.in or @snuchennai.edu.in' });

    const otp = String(Math.floor(10000 + Math.random() * 90000)); // 5-digit
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.query(
      `INSERT INTO admin_otps (personal_email, otp, expires_at, attempts)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (personal_email)
       DO UPDATE SET otp = EXCLUDED.otp, expires_at = EXCLUDED.expires_at, attempts = 0` ,
      [personalEmail, otp, expires]
    );

    if (!process.env.MAIL_SERVICE_URL) {
      console.warn('MAIL_SERVICE_URL not set; skipping email send');
    } else {
      const mailHeaders = createPaymentHeaders(process.env.PAYMENT_SERVICE_SECRET);
      await axios.post(process.env.MAIL_SERVICE_URL, {
        email: personalEmail,
        otp: otp
      }, { timeout: 10000, headers: mailHeaders });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('POST /auth/send-otp error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Verify OTP for personal email
router.post('/verify-otp', async (req, res) => {
  try {
    // Trim inputs to prevent whitespace issues
    const personalEmail = req.body.personalEmail?.trim();
    const otp = req.body.otp?.trim();
    
    if (!personalEmail || !otp) return res.status(400).json({ error: 'personalEmail and otp required' });
    if (!isValidInstitutionEmail(personalEmail)) return res.status(400).json({ error: 'email must be @ssn.edu.in or @snuchennai.edu.in' });

    const row = (await db.query('SELECT otp, expires_at, attempts FROM admin_otps WHERE personal_email=$1', [personalEmail])).rows[0];
    if (!row) return res.status(400).json({ error: 'otp not requested' });
    if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'otp expired' });
    if (String(row.otp) !== String(otp)) {
      await db.query('UPDATE admin_otps SET attempts = attempts + 1 WHERE personal_email=$1', [personalEmail]);
      return res.status(400).json({ error: 'invalid otp' });
    }

    // Invalidate used OTP
    await db.query('DELETE FROM admin_otps WHERE personal_email=$1', [personalEmail]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('POST /auth/verify-otp error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;


