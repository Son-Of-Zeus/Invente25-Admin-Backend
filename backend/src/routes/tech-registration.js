// routes/tech-registration.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');
const axios = require('axios');
const { createPaymentHeaders } = require('../paymentAuth');

const router = express.Router();

router.post('/', 
  authMiddleware, 
  requireRole(['volunteer', 'super_admin', 'master_admin']),
  async (req, res) => {
    const { emailID, name, phoneNumber, institution, paymentMethod, passes } = req.body;

    // Basic validation
    if (!emailID || !name || !phoneNumber || !institution || !paymentMethod || !Array.isArray(passes)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailID)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Extract all event IDs for validation
    const eventIds = passes.flatMap(pass => 
      Object.values(pass.slots || {})
    ).filter(id => id);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // RBAC Check: Department admins and department volunteers cannot register technical passes
      // This check must happen BEFORE any event validation to prevent bypass with zero events
      if (req.user.role === 'dept_admin' || (req.user.role === 'volunteer' && req.user.department_id)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ 
          error: 'Department admins and department volunteers are not authorized to register technical passes. Technical registrations are restricted to master_admin, and central volunteers only.' 
        });
      }

      // Validate that all event IDs exist and are technical events (only if events are provided)
      if (eventIds.length > 0) {
        const eventValidationQuery = `
          SELECT external_id, department_id, event_type 
          FROM events 
          WHERE external_id = ANY($1) AND event_type = 'technical'
        `;
        
        const validEvents = await client.query(eventValidationQuery, [eventIds]);
        
        if (validEvents.rows.length !== eventIds.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'One or more invalid technical event IDs' });
        }
      }


      const paymentID = uuidv4();
      const timestamp = new Date().toISOString();
      const unitPrice = Number(process.env.TECH_PASS_PRICE || 300);
      const amount = (passes.length * unitPrice).toFixed(2);
      console.log(req.user?.assigned_by);
      // Call payment service with HMAC authentication
      const paymentHeaders = createPaymentHeaders(process.env.PAYMENT_SERVICE_SECRET);
      await axios.post(process.env.PAYMENT_SERVICE_URL, {
        emailID,
        name,
        paymentID,
        phoneNumber,
        institution,
        createdAt: timestamp,
        eventBookingDetails: passes.map(p => p.slots || {}),
        type: "t",
        assigned_by: req.user?.assigned_by || "WAS NOT INCLUDED"
      }, {
        headers: paymentHeaders
      });

      // Call receipt service
      await axios.post(process.env.RECEIPT_SERVICE_URL, {
        emailID,
        paymentID,
        paidOn: timestamp,
        method: paymentMethod,
        amount,
        phoneNumber
      });

    //   // Create user if doesn't exist
    //   await client.query(
    //     'INSERT INTO users (email, name, phone) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET name = $2, phone = $3',
    //     [emailID, name, phoneNumber]
    //   );

      await client.query('COMMIT');
      res.json({ 
        success: true, 
        paymentID,
        amount
      });

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Cash registration error:', err);
      res.status(500).json({ 
        error: err.message === 'One or more invalid event IDs' 
          ? err.message 
          : 'Server error during registration' 
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;