// routes/non-tech-registration.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');
const axios = require('axios');
const { createPaymentHeaders } = require('../paymentAuth');

const router = express.Router();

router.post('/', 
  authMiddleware, 
  requireRole(['volunteer', 'super_admin', 'master_admin', 'dept_admin']),
  async (req, res) => {
    const { emailID, name, phoneNumber, institution, paymentMethod, events, customAmount, teamMembers } = req.body;

    // Basic validation
    if (!emailID || !name || !phoneNumber || !institution || !paymentMethod || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate custom amount
    if (!customAmount || Number(customAmount) <= 0) {
      return res.status(400).json({ error: 'Valid custom amount is required' });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailID)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate events array is not empty
    if (events.length === 0) {
      return res.status(400).json({ error: 'At least one event must be selected' });
    }

    // Validate team members if provided
    const validatedTeamMembers = teamMembers || [];
    for (let i = 0; i < validatedTeamMembers.length; i++) {
      const member = validatedTeamMembers[i];
      if (!member.name || !member.email) {
        return res.status(400).json({ error: `Team member ${i + 1}: name and email are required` });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)) {
        return res.status(400).json({ error: `Team member ${i + 1}: invalid email format` });
      }
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Validate that all event IDs exist and are non-technical events
      const eventIds = events.map(e => e.event_id);
      const eventValidationQuery = `
        SELECT external_id, department_id 
        FROM events 
        WHERE external_id = ANY($1) AND event_type = 'non-technical'
      `;
      
      const validEvents = await client.query(eventValidationQuery, [eventIds]);
      
      if (validEvents.rows.length !== events.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'One or more invalid non-technical event IDs' });
      }

      // Check department access permissions
      if (req.user.role === 'dept_admin' || (req.user.role === 'volunteer' && req.user.department_id)) {
        // Department-specific roles can only register for events from their department
        const userDeptId = req.user.department_id;

        if (!userDeptId) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Department ID not found for user' });
        }
        
        const userDeptEvents = validEvents.rows.filter(event => event.department_id === userDeptId);
        
        if (userDeptEvents.length !== events.length) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'You can only register for non-technical events from your department' });
        }
      }

      const paymentID = uuidv4();
      const timestamp = new Date().toISOString();

      // Use custom amount instead of database costs
      const amount = Number(customAmount).toFixed(2);

      // Prepare eventBookingDetails in the same format as workshops
      const eventBookingDetails = events.map(event => ({
        "1": event.event_id
      }));

      // Call payment service with HMAC authentication (no type parameter needed)
      const paymentHeaders = createPaymentHeaders(process.env.PAYMENT_SERVICE_SECRET);
      await axios.post(process.env.PAYMENT_SERVICE_URL, {
        emailID,
        name,
        paymentID,
        phoneNumber,
        institution,
        createdAt: timestamp,
        eventBookingDetails,
        type: "n",
        assigned_by: req.user?.assigned_by || null
      }, {
        headers: paymentHeaders
      });

      // Call receipt service (same as cash registration)
      await axios.post(process.env.RECEIPT_SERVICE_URL, {
        emailID,
        paymentID,
        paidOn: timestamp,
        method: paymentMethod,
        amount,
        phoneNumber
      });

      // Store team members in nt_team_members table
      const eventId = events[0].event_id; // Non-tech registration is single event
      
      // First, add the team leader
      await client.query(
        `INSERT INTO nt_team_members (team_leader_email, event_id, member_email, member_name, member_phone, member_institution, is_leader)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [emailID, eventId, emailID, name, phoneNumber, institution, true]
      );

      // Then add additional team members
      for (const member of validatedTeamMembers) {
        await client.query(
          `INSERT INTO nt_team_members (team_leader_email, event_id, member_email, member_name, member_phone, member_institution, is_leader)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [emailID, eventId, member.email, member.name, member.phone || null, member.institution || null, false]
        );
      }

      await client.query('COMMIT');
      res.json({ 
        success: true, 
        paymentID,
        amount,
        eventCount: events.length,
        teamSize: 1 + validatedTeamMembers.length
      });

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Non-tech registration error:', err);
      res.status(500).json({ 
        error: err.message === 'One or more invalid non-technical event IDs' 
          ? err.message 
          : 'Server error during non-tech registration' 
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
