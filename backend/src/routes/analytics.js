// routes/analytics.js
const express = require("express");
const db = require("../db");
const { authMiddleware, requireRole } = require("../auth");
const XLSX = require("xlsx");

const router = express.Router();
// Event-level analytics for event_admin (their event only) and super_admin (any event via query)
// routes/analytics.js

// --- MODIFIED ROUTE: Event-level analytics ---
router.get(
  "/event",
  authMiddleware,
  requireRole(["event_admin", "super_admin", "master_admin", "dept_admin", "workshop_admin"]),
  async (req, res) => {
    try {
      let eventId;
      if (req.user.role === "event_admin") {
        if (!req.user.event_id)
          return res.status(403).json({ error: "no event assigned" });
        eventId = Number(req.user.event_id);
      } else {
        eventId = Number(req.query.event_id);
        if (Number.isNaN(eventId))
          return res.status(400).json({ error: "event_id required" });
      }

      const eventRes = await db.query(
        "SELECT external_id, name, event_type, cost, department_id FROM events WHERE external_id=$1",
        [eventId]
      );
      const eventRow = eventRes.rows[0];
      if (!eventRow) {
        return res.status(404).json({ error: "event not found" });
      }

      if (req.user.role === "dept_admin") {
        if (eventRow.department_id !== req.user.department_id) {
          return res
            .status(403)
            .json({ error: "You are not authorized to view this event" });
        }
      }

      // workshop_admin can only access workshop events
      if (req.user.role === "workshop_admin") {
        if (eventRow.event_type !== "workshop") {
          return res
            .status(403)
            .json({ error: "Workshop admins can only view workshop events" });
        }
      }

      const totals = (
        await db.query(
          `
            SELECT COUNT(*)::int AS registrations,
                   COALESCE(SUM(CASE WHEN attended THEN 1 ELSE 0 END),0)::int AS attendance
            FROM slots WHERE event_id = $1
          `,
          [eventId]
        )
      ).rows[0];

      // --- QUERY CHANGED: Fetch ALL registrations with user details, no limit ---
      const registrations = (
        await db.query(
          `
            SELECT 
                s.pass_id, 
                s.slot_no, 
                s.attended, 
                s.created_at,
                p.user_email,
                u.name AS user_name,
                u.phone AS user_phone,
                u.institution AS user_institution
            FROM slots s
            LEFT JOIN passes p ON s.pass_id = p.pass_id
            LEFT JOIN users u ON p.user_email = u.email
            WHERE s.event_id = $1
            ORDER BY s.created_at DESC
          `,
          [eventId]
        )
      ).rows;

      const eventAdmins = (
        await db.query(
          'SELECT name, personal_email, phone FROM admin_profiles WHERE event_id = $1',
          [eventId]
        )
      ).rows;

      // Online vs Attended stats for this specific event
      const onlineVsAttended = (
        await db.query(
          `
          SELECT 
            COUNT(DISTINCT CASE WHEN r.method = 'online' THEN p.user_email END)::int AS online_registered,
            COUNT(DISTINCT CASE WHEN s.attended = true THEN p.user_email END)::int AS actually_attended,
            COUNT(DISTINCT CASE WHEN r.method = 'online' AND s.attended = true THEN p.user_email END)::int AS online_and_attended
          FROM slots s
          JOIN passes p ON s.pass_id = p.pass_id
          JOIN receipts r ON p.payment_id = r.payment_id
          WHERE s.event_id = $1
          `,
          [eventId]
        )
      ).rows[0];

      return res.json({
        event: eventRow,
        totals: {
          registrations: totals.registrations,
          attendance: totals.attendance,
          online_registered: onlineVsAttended.online_registered || 0,
          actually_attended: onlineVsAttended.actually_attended || 0,
          online_and_attended: onlineVsAttended.online_and_attended || 0,
          online_percentage: totals.registrations > 0 ? 
            ((onlineVsAttended.online_registered / totals.registrations) * 100).toFixed(1) : "0.0",
        },
        registrations: registrations, // --- RESPONSE KEY UPDATED ---
        event_admins: eventAdmins,
      });
    } catch (err) {
      console.error("analytics/event error", err);
      return res.status(500).json({ error: "server error" });
    }
  }
);

// Event-level participants list with filtering
router.get(
  "/event/:eventId/participants",
  authMiddleware,
  requireRole(["event_admin", "super_admin", "master_admin", "dept_admin"]),
  async (req, res) => {
    try {
      const eventId = Number(req.params.eventId);
      const { payment_method, attended } = req.query;

      // Verify event exists and user has access
      const eventRes = await db.query(
        "SELECT external_id, name, event_type, department_id FROM events WHERE external_id=$1",
        [eventId]
      );
      const event = eventRes.rows[0];
      if (!event) {
        return res.status(404).json({ error: "event not found" });
      }

      // Access control
      if (req.user.role === "event_admin") {
        if (!req.user.event_id || req.user.event_id !== eventId) {
          return res.status(403).json({ error: "unauthorized" });
        }
      } else if (req.user.role === "dept_admin") {
        if (event.department_id !== req.user.department_id) {
          return res.status(403).json({ error: "unauthorized" });
        }
      }

      // Build query with filters
      let query = `
        SELECT DISTINCT
          p.user_email,
          u.name,
          u.phone,
          u.institution,
          r.method as payment_method,
          s.attended as attended_this_event,
          s.created_at as registration_date,
          p.pass_id,
          s.slot_no as slot_number
        FROM slots s
        JOIN passes p ON s.pass_id = p.pass_id
        JOIN users u ON p.user_email = u.email
        JOIN receipts r ON p.payment_id = r.payment_id
        WHERE s.event_id = $1
      `;
      
      const params = [eventId];
      
      if (payment_method) {
        if (payment_method === 'offline') {
          // Map 'offline' to both 'cash' and 'upi'
          query += ` AND r.method IN ('cash', 'upi')`;
        } else {
          query += ` AND r.method = $${params.length + 1}`;
          params.push(payment_method);
        }
      }
      
      if (attended === 'true') {
        query += ` AND s.attended = true`;
      } else if (attended === 'false') {
        query += ` AND s.attended = false`;
      }
      
      query += ` ORDER BY u.name`;

      const participants = await db.query(query, params);

      return res.json({
        event,
        participants: participants.rows,
        filters: { payment_method, attended }
      });
    } catch (err) {
      console.error("Event participants error:", err);
      return res.status(500).json({ error: "server error" });
    }
  }
);

// Enhanced Department analytics
router.get(
  "/department/:id",
  authMiddleware,
  requireRole(["dept_admin", "super_admin", "master_admin", "workshop_admin"]),
  async (req, res) => {
    const deptId = Number(req.params.id);
    if (Number.isNaN(deptId))
      return res.status(400).json({ error: "invalid department id" });

    // if dept_admin, ensure they can only access their own department
    if (req.user.role === "dept_admin" && req.user.department_id !== deptId) {
      return res.status(403).json({ error: "forbidden" });
    }

    // workshop_admin can only access WORKSHOP department
    if (req.user.role === "workshop_admin") {
      const workshopDept = await db.query("SELECT id FROM departments WHERE name = 'WORKSHOP'");
      if (workshopDept.rows.length === 0 || workshopDept.rows[0].id !== deptId) {
        return res.status(403).json({ error: "Workshop admins can only view workshop department analytics" });
      }
    }

    try {
      const deptRow = (
        await db.query("SELECT id, name FROM departments WHERE id=$1", [deptId])
      ).rows[0];
      if (!deptRow)
        return res.status(404).json({ error: "department not found" });

      // Basic counts
      const totEventsRes = await db.query(
        "SELECT COUNT(*)::int AS total_events FROM events WHERE department_id=$1",
        [deptId]
      );
      const total_events = totEventsRes.rows[0].total_events;

      // Technical events analytics
      const techRegRes = await db.query(
        `
      SELECT
        COUNT(s.*)::int AS total_registrations,
        COALESCE(SUM(CASE WHEN s.attended THEN 1 ELSE 0 END),0)::int AS total_attendance
      FROM slots s
      JOIN events e ON s.event_id = e.external_id
      WHERE e.department_id = $1 AND e.event_type = 'technical'
    `,
        [deptId]
      );
      const tech_registrations = techRegRes.rows[0].total_registrations || 0;
      const tech_attendance = techRegRes.rows[0].total_attendance || 0;

      // Non-technical events analytics
      const nonTechRegRes = await db.query(
        `
      SELECT
        COUNT(s.*)::int AS total_teams,
        COALESCE(SUM(CASE WHEN s.attended THEN 1 ELSE 0 END),0)::int AS total_attendance,
        (SELECT COUNT(*) FROM nt_team_members ntm
         JOIN events e2 ON ntm.event_id = e2.external_id
         WHERE e2.department_id = $1 AND e2.event_type = 'non-technical')::int AS total_participants
      FROM slots s
      JOIN events e ON s.event_id = e.external_id
      WHERE e.department_id = $1 AND e.event_type = 'non-technical'
    `,
        [deptId]
      );
      const nontech_teams = nonTechRegRes.rows[0].total_teams || 0;
      const nontech_participants = nonTechRegRes.rows[0].total_participants || 0;
      const nontech_attendance = nonTechRegRes.rows[0].total_attendance || 0;

      const total_registrations = tech_registrations + nontech_teams;
      const total_attendance = tech_attendance + nontech_attendance;

      // Per-event breakdown with event types - showing only non-technical revenue
      const perEvent = (
        await db.query(
          `
      SELECT
        e.external_id AS event_id,
        e.name AS event_name,
        e.event_type,
        e.cost,
        COUNT(s.*)::int AS registrations,
        COALESCE(SUM(CASE WHEN s.attended THEN 1 ELSE 0 END),0)::int AS attendance,
        CASE 
          WHEN e.event_type = 'non-technical' THEN COALESCE(SUM(r.amount), 0)
          ELSE 0
        END::decimal AS revenue
      FROM events e
      LEFT JOIN slots s ON s.event_id = e.external_id
      LEFT JOIN passes p ON p.pass_id = s.pass_id
      LEFT JOIN receipts r ON r.payment_id = p.payment_id
      WHERE e.department_id = $1
      GROUP BY e.external_id, e.name, e.event_type, e.cost
      ORDER BY registrations DESC, e.name
    `,
          [deptId]
        )
      ).rows;

      // Event type breakdown - showing only non-technical revenue
      const eventTypeBreakdown = (
        await db.query(
          `
      SELECT
        e.event_type,
        COUNT(DISTINCT e.external_id)::int AS event_count,
        COUNT(s.*)::int AS total_registrations,
        COALESCE(SUM(CASE WHEN s.attended THEN 1 ELSE 0 END),0)::int AS total_attendance,
        CASE 
          WHEN e.event_type = 'non-technical' THEN COALESCE(SUM(r.amount), 0)
          ELSE 0
        END::decimal AS total_revenue
      FROM events e
      LEFT JOIN slots s ON s.event_id = e.external_id
      LEFT JOIN passes p ON p.pass_id = s.pass_id
      LEFT JOIN receipts r ON r.payment_id = p.payment_id
      WHERE e.department_id = $1
      GROUP BY e.event_type
      ORDER BY total_registrations DESC
    `,
          [deptId]
        )
      ).rows;

      // Top events
      const top_event_by_registrations = perEvent.length ? perEvent[0] : null;
      const top_event_by_attendance =
        perEvent
          .slice()
          .sort(
            (a, b) =>
              b.attendance - a.attendance || b.registrations - a.registrations
          )[0] || null;

      // Time-based analytics
      const timeRes = (
        await db.query(
          `
      SELECT 
        date_trunc('day', s.created_at)::date AS day, 
        COUNT(*)::int AS count,
        e.event_type
      FROM slots s
      JOIN events e ON s.event_id = e.external_id
      WHERE e.department_id = $1 AND s.created_at >= now() - interval '30 days'
      GROUP BY day, e.event_type
      ORDER BY day, e.event_type
    `,
          [deptId]
        )
      ).rows;

      // Payment analytics
      const passesByPayment = (
        await db.query(
          `
      SELECT 
        r.method,
        COUNT(DISTINCT p.pass_id)::int AS total_passes,
        COALESCE(SUM(r.amount), 0)::decimal AS total_revenue
      FROM passes p
      JOIN receipts r ON p.payment_id = r.payment_id
      JOIN slots s ON s.pass_id = p.pass_id
      JOIN events e ON s.event_id = e.external_id
      WHERE e.department_id = $1
      GROUP BY r.method
    `,
          [deptId]
        )
      ).rows;

      // Revenue analytics
      const revenueRes = (
        await db.query(
          `
      SELECT 
        COALESCE(SUM(r.amount), 0)::decimal AS total_revenue,
        COALESCE(AVG(r.amount), 0)::decimal AS avg_transaction
      FROM passes p
      JOIN receipts r ON p.payment_id = r.payment_id
      JOIN slots s ON s.pass_id = p.pass_id
      JOIN events e ON s.event_id = e.external_id
      WHERE e.department_id = $1 AND e.event_type = 'non-technical'
    `,
          [deptId]
        )
      ).rows[0];

      // Online vs attended analytics by event type
      const onlineAttendedRes = (
        await db.query(
          `
      SELECT 
        e.event_type,
        COUNT(DISTINCT s.pass_id)::int AS total_registered,
        COUNT(DISTINCT CASE WHEN r.method = 'online' THEN s.pass_id END)::int AS online_registered,
        COUNT(DISTINCT CASE WHEN s.attended = true THEN s.pass_id END)::int AS attended_count
      FROM slots s
      JOIN passes p ON s.pass_id = p.pass_id
      JOIN receipts r ON p.payment_id = r.payment_id
      JOIN events e ON s.event_id = e.external_id
      WHERE e.department_id = $1
      GROUP BY e.event_type
    `,
          [deptId]
        )
      ).rows;

      // Overall department online vs attended stats
      const overallOnlineRes = (
        await db.query(
          `
      SELECT 
        COUNT(DISTINCT s.pass_id)::int AS total_registered,
        COUNT(DISTINCT CASE WHEN r.method = 'online' THEN s.pass_id END)::int AS online_registered,
        COUNT(DISTINCT CASE WHEN s.attended = true THEN s.pass_id END)::int AS attended_count
      FROM slots s
      JOIN passes p ON s.pass_id = p.pass_id
      JOIN receipts r ON p.payment_id = r.payment_id
      JOIN events e ON s.event_id = e.external_id
      WHERE e.department_id = $1
    `,
          [deptId]
        )
      ).rows[0];

      // Add hackathon data if this is ECE department (department_id = 4)
      let hackathonData = null;
      if (deptId === 4) {
        const hackathonAnalytics = (
          await db.query(`
            SELECT
              track,
              COUNT(*)::int AS team_count,
              COUNT(CASE WHEN attended THEN 1 END)::int AS attended_teams,
              COUNT(DISTINCT leader_email)::int AS unique_leaders
            FROM hack_passes
            GROUP BY track
            ORDER BY team_count DESC
          `)
        ).rows;

        const hackathonDetails = (
          await db.query(`
            WITH team_members AS (
              SELECT 
                hd.team_id,
                jsonb_agg(jsonb_build_object(
                  'email', hd.email,
                  'name', hd.full_name,
                  'institution', hd.institution,
                  'phone', hd.phone_number,
                  'gender', hd.gender,
                  'department', hd.department,
                  'year', hd.year_of_study
                )) AS members
              FROM hack_reg_details hd
              GROUP BY hd.team_id
            ),
            team_track_info AS (
              SELECT
                t.team_id,
                t.domain_name,
                t.problem_statement
              FROM track t
            ),
            team_sizes AS (
              SELECT 
                team_id,
                COUNT(email)::int as member_count
              FROM hack_reg_details
              GROUP BY team_id
            )
            SELECT
              h.team_id,
              h.team_name,
              h.track,
              h.attended,
              h.created_at,
              h.payment_id,
              h.ticket_issued,
              COALESCE(ts.member_count, 0) as team_size,
              tti.domain_name,
              tti.problem_statement,
              tm.members
            FROM hack_passes h
            LEFT JOIN team_sizes ts ON h.team_id = ts.team_id
            LEFT JOIN team_track_info tti ON h.team_id = tti.team_id
            LEFT JOIN team_members tm ON h.team_id = tm.team_id
            ORDER BY h.created_at DESC
          `)
        ).rows;

        const totalHackathonTeams = (await db.query('SELECT COUNT(*)::int AS total_teams FROM hack_passes')).rows[0].total_teams;

        hackathonData = {
          track_breakdown: hackathonAnalytics,
          recent_teams: hackathonDetails,
          summary: {
            total_teams: totalHackathonTeams,
            total_attended: hackathonAnalytics.reduce((sum, h) => sum + h.attended_teams, 0),
            total_participants: hackathonDetails.reduce((sum, h) => sum + h.team_size, 0),
          },
        };
      }

      // Enhanced breakdown with online vs attended stats
      const enhancedBreakdown = {
        technical: {
          registrations: tech_registrations,
          attendance: tech_attendance,
        },
        non_technical: {
          teams: nontech_teams,
          participants: nontech_participants,
          registrations: nontech_teams, // Keep for backward compatibility
          attendance: nontech_attendance,
        },
      };

      // Add online vs attended data to breakdown
      onlineAttendedRes.forEach(row => {
        if (enhancedBreakdown[row.event_type.replace('-', '_')]) {
          enhancedBreakdown[row.event_type.replace('-', '_')] = {
            ...enhancedBreakdown[row.event_type.replace('-', '_')],
            online_registered: parseInt(row.online_registered),
            attended_count: parseInt(row.attended_count),
            online_percentage: row.total_registered > 0 ? 
              ((row.online_registered / row.total_registered) * 100).toFixed(1) : "0.0"
          };
        }
      });

      // Department staff and revenue analytics (volunteers + dept_admin + workshop staff for this department)
      const departmentStaff = (
        await db.query(`
          SELECT
            ap.name,
            ap.personal_email,
            ap.phone,
            a.role,
            d.name as department_name,
            COUNT(p.pass_id)::int AS passes_assigned,
            COALESCE(SUM(CASE WHEN r.method = 'upi' THEN r.amount ELSE 0 END), 0)::decimal AS upi_collected,
            COALESCE(SUM(CASE WHEN r.method = 'cash' THEN r.amount ELSE 0 END), 0)::decimal AS cash_collected,
            COALESCE(SUM(CASE WHEN r.method IN ('upi', 'cash') THEN r.amount ELSE 0 END), 0)::decimal AS total_collected
          FROM admin_profiles ap
          LEFT JOIN admins a ON ap.admin_email = a.email
          LEFT JOIN departments d ON a.department_id = d.id
          LEFT JOIN passes p ON ap.personal_email = p.assigned_by
          LEFT JOIN receipts r ON p.payment_id = r.payment_id
          WHERE a.role IN ('volunteer', 'dept_admin', 'workshop_admin', 'workshop_volunteer') 
            AND a.department_id = $1
          GROUP BY ap.personal_email, ap.name, ap.phone, a.role, d.name
          ORDER BY total_collected DESC
        `, [deptId])
      ).rows;

      const responseData = {
        department: deptRow,
        totals: {
          total_events,
          total_registrations,
          total_attendance,
          total_revenue: revenueRes.total_revenue,
          avg_transaction: revenueRes.avg_transaction,
          online_registered: parseInt(overallOnlineRes.online_registered),
          attended_count: parseInt(overallOnlineRes.attended_count),
          online_percentage: overallOnlineRes.total_registered > 0 ? 
            ((overallOnlineRes.online_registered / overallOnlineRes.total_registered) * 100).toFixed(1) : "0.0"
        },
        breakdown: enhancedBreakdown,
        event_type_breakdown: eventTypeBreakdown,
        per_event: perEvent,
        top_event_by_registrations,
        top_event_by_attendance,
        registrations_over_time: timeRes,
        passes_by_payment: passesByPayment,
        online_vs_attended_by_type: onlineAttendedRes.map(row => ({
          event_type: row.event_type,
          total_registered: parseInt(row.total_registered),
          online_registered: parseInt(row.online_registered),
          attended_count: parseInt(row.attended_count),
          online_percentage: row.total_registered > 0 ? 
            ((row.online_registered / row.total_registered) * 100).toFixed(1) : "0.0"
        })),
        department_staff: departmentStaff
      };

      // Add hackathon data to response if ECE department
      if (hackathonData) {
        responseData.hackathons = hackathonData;
      }

      return res.json(responseData);
    } catch (err) {
      console.error("analytics/department error", err);
      return res.status(500).json({ error: "server error" });
    }
  }
);

// Department-level participants list with filtering
router.get(
  "/department/:id/participants",
  authMiddleware,
  requireRole(["dept_admin", "super_admin", "master_admin"]),
  async (req, res) => {
    try {
      const departmentId = Number(req.params.id);
      const { payment_method, attended, event_type } = req.query;

      // Access control
      if (req.user.role === "dept_admin" && req.user.department_id !== departmentId) {
        return res.status(403).json({ error: "unauthorized" });
      }

      // Verify department exists
      const deptRes = await db.query(
        "SELECT id, name FROM departments WHERE id=$1",
        [departmentId]
      );
      const department = deptRes.rows[0];
      if (!department) {
        return res.status(404).json({ error: "department not found" });
      }

      // Build aggregated query with user details and event lists
      let query = `
        SELECT 
          p.user_email,
          u.name,
          u.phone,
          u.institution,
          COUNT(DISTINCT p.pass_id) as total_passes,
          STRING_AGG(DISTINCT e.name, ', ' ORDER BY e.name) as registered_events,
          COUNT(DISTINCT s.slot_no) as total_registrations,
          COUNT(DISTINCT CASE WHEN s.attended = true THEN s.slot_no END) as attended_count,
          MIN(s.created_at) as first_registration_date,
          CASE 
            WHEN COUNT(DISTINCT CASE WHEN s.attended = true THEN s.slot_no END) > 0 THEN true
            ELSE false
          END as attended_any_event
        FROM slots s
        JOIN passes p ON s.pass_id = p.pass_id
        JOIN users u ON p.user_email = u.email
        JOIN receipts r ON p.payment_id = r.payment_id
        JOIN events e ON s.event_id = e.external_id
        WHERE e.department_id = $1
      `;
      
      const params = [departmentId];
      
      if (payment_method) {
        if (payment_method === 'offline') {
          // Map 'offline' to both 'cash' and 'upi'
          query += ` AND r.method IN ('cash', 'upi')`;
        } else {
          query += ` AND r.method = $${params.length + 1}`;
          params.push(payment_method);
        }
      }
      
      if (event_type) {
        query += ` AND e.event_type = $${params.length + 1}`;
        params.push(event_type);
      }
      
      query += ` 
        GROUP BY p.user_email, u.name, u.phone, u.institution
      `;
      
      // Apply attended filter after aggregation
      if (attended === 'true') {
        query += ` HAVING COUNT(DISTINCT CASE WHEN s.attended = true THEN s.slot_no END) > 0`;
      } else if (attended === 'false') {
        query += ` HAVING COUNT(DISTINCT CASE WHEN s.attended = true THEN s.slot_no END) = 0`;
      }
      
      query += ` ORDER BY u.name`;

      const participants = await db.query(query, params);

      // Add hackathon participants if this is ECE department (department_id = 4)
      let hackathonParticipants = [];
      if (departmentId === 4) {
        let hackQuery = `
          SELECT DISTINCT
            hd.email as user_email,
            hd.full_name as name,
            hd.phone_number as phone,
            hd.institution,
            'hackathon' as event_type,
            hp.team_name,
            hp.track,
            hp.attended,
            hp.created_at as registration_date
          FROM hack_reg_details hd
          JOIN hack_passes hp ON hd.team_id = hp.team_id
          WHERE 1=1
        `;
        
        const hackParams = [];
        
        if (attended === 'true') {
          hackQuery += ` AND hp.attended = true`;
        } else if (attended === 'false') {
          hackQuery += ` AND hp.attended = false`;
        }
        
        hackQuery += ` ORDER BY hd.full_name`;
        
        const hackRes = await db.query(hackQuery, hackParams);
        hackathonParticipants = hackRes.rows;
      }

      return res.json({
        department,
        participants: participants.rows,
        hackathon_participants: hackathonParticipants,
        filters: { payment_method, attended, event_type }
      });
    } catch (err) {
      console.error("Department participants error:", err);
      return res.status(500).json({ error: "server error" });
    }
  }
);

// College-level analytics: visible to super_admin, master_admin, and dept_admin
router.get(
  "/college",
  authMiddleware,
  requireRole(["super_admin", "master_admin", "dept_admin"]),
  async (req, res) => {
    try {
      // Check if WORKSHOP department exists
      const workshopDept = await db.query("SELECT id FROM departments WHERE name = 'WORKSHOP'");
      if (workshopDept.rows.length === 0) {
        return res.status(500).json({ error: "WORKSHOP department not found" });
      }

    
        // Basic totals by event type
        const totalsRes = (
        await db.query(`
      SELECT
        (SELECT COUNT(*) FROM departments WHERE name != 'WORKSHOP')::int AS total_departments,
        (SELECT COUNT(*) FROM events WHERE department_id != (SELECT id FROM departments WHERE name = 'WORKSHOP'))::int AS total_events,
        (SELECT COUNT(*) FROM slots)::int AS total_registrations,
        (SELECT COALESCE(SUM(CASE WHEN attended THEN 1 ELSE 0 END),0)::int FROM slots) AS total_attendance,
        (SELECT COUNT(*) FROM hack_passes)::int AS total_hackathon_teams,
        (SELECT COUNT(*) FROM events WHERE department_id = (SELECT id FROM departments WHERE name = 'WORKSHOP'))::int AS total_workshops
    `)
      ).rows[0];

      // Event type specific totals
      const eventTypeTotals = (
        await db.query(`
      SELECT 
        -- Technical events
        (SELECT COUNT(s.*) FROM slots s 
         JOIN events e ON s.event_id = e.external_id 
         WHERE e.event_type = 'technical')::int AS tech_registrations,
        -- Technical online registrations
        (SELECT COUNT(DISTINCT s.pass_id) FROM slots s 
         JOIN events e ON s.event_id = e.external_id 
         JOIN passes p ON s.pass_id = p.pass_id 
         JOIN receipts r ON p.payment_id = r.payment_id 
         WHERE e.event_type = 'technical' AND r.method = 'online')::int AS tech_online_registered,
        -- Technical revenue: count distinct tech passes and multiply by 300
        (SELECT COUNT(DISTINCT p.pass_id) * 300 FROM passes p
         WHERE p.pass_id IN (
           -- Tech passes with 0 slots
           SELECT p2.pass_id FROM passes p2 
           LEFT JOIN slots s ON p2.pass_id = s.pass_id 
           WHERE s.pass_id IS NULL
           UNION
           -- Tech passes with >1 slots  
           SELECT p3.pass_id FROM passes p3
           JOIN slots s2 ON p3.pass_id = s2.pass_id
           GROUP BY p3.pass_id HAVING COUNT(*) > 1
           UNION
           -- Tech passes with exactly 1 slot for technical events
           SELECT p4.pass_id FROM passes p4
           JOIN slots s3 ON p4.pass_id = s3.pass_id
           JOIN events e ON s3.event_id = e.external_id
           WHERE e.event_type = 'technical'
           GROUP BY p4.pass_id HAVING COUNT(*) = 1
         ))::decimal AS tech_revenue,
        
        -- Non-technical events  
        (SELECT COUNT(s.*) FROM slots s 
         JOIN events e ON s.event_id = e.external_id 
         WHERE e.event_type = 'non-technical')::int AS nontech_teams,
        (SELECT COUNT(*) FROM nt_team_members ntm
         JOIN events e ON ntm.event_id = e.external_id
         WHERE e.event_type = 'non-technical')::int AS nontech_participants,
        (SELECT COALESCE(SUM(r.amount), 0) FROM slots s 
         JOIN events e ON s.event_id = e.external_id 
         JOIN passes p ON s.pass_id = p.pass_id 
         JOIN receipts r ON p.payment_id = r.payment_id 
         WHERE e.event_type = 'non-technical')::decimal AS nontech_revenue,
        
        -- Workshop events
        (SELECT COUNT(s.*) FROM slots s 
         JOIN events e ON s.event_id = e.external_id 
         WHERE e.event_type = 'workshop')::int AS workshop_registrations,
        (SELECT COALESCE(SUM(r.amount), 0) FROM slots s 
         JOIN events e ON s.event_id = e.external_id 
         JOIN passes p ON s.pass_id = p.pass_id 
         JOIN receipts r ON p.payment_id = r.payment_id 
         WHERE e.event_type = 'workshop')::decimal AS workshop_revenue,
        
        -- Hackathon (separate table)
        (SELECT COUNT(*) FROM hack_passes)::int AS hackathon_teams,
        (SELECT COALESCE(SUM(r.amount), 0) FROM hack_passes h 
         JOIN receipts r ON h.payment_id = r.payment_id)::decimal AS hackathon_revenue
    `)
      ).rows[0];

      // Overall revenue analytics
      const revenueRes = (
        await db.query(`
      SELECT 
        COALESCE(SUM(r.amount), 0)::decimal AS total_revenue,
        COALESCE(AVG(r.amount), 0)::decimal AS avg_transaction,
        COUNT(DISTINCT r.payment_id)::int AS total_transactions
      FROM receipts r
    `)
      ).rows[0];

      // Department analytics (excluding WORKSHOP) - showing only non-technical revenue
      const perDept = (
        await db.query(`
      SELECT
        d.id AS department_id,
        d.name AS department_name,
        COUNT(DISTINCT e.external_id)::int AS event_count,
        COUNT(s.*)::int AS registrations,
        COALESCE(SUM(CASE WHEN s.attended THEN 1 ELSE 0 END),0)::int AS attendance,
        COALESCE(SUM(CASE WHEN e.event_type = 'non-technical' THEN r.amount ELSE 0 END), 0)::decimal AS revenue
      FROM departments d
      LEFT JOIN events e ON e.department_id = d.id
      LEFT JOIN slots s ON s.event_id = e.external_id
      LEFT JOIN passes p ON p.pass_id = s.pass_id
      LEFT JOIN receipts r ON r.payment_id = p.payment_id
      WHERE d.name != 'WORKSHOP'
      GROUP BY d.id, d.name
      ORDER BY registrations DESC
    `)
      ).rows;

      // Event type breakdown with corrected technical revenue calculation
      const eventTypeBreakdown = [];
      
      // Get technical event breakdown
      const techBreakdown = await db.query(`
        SELECT
          'technical' as event_type,
          COUNT(DISTINCT e.external_id)::int AS event_count,
          COUNT(s.*)::int AS total_registrations,
          COALESCE(SUM(CASE WHEN s.attended THEN 1 ELSE 0 END),0)::int AS total_attendance,
          -- Count distinct tech passes × 300
          (SELECT COUNT(DISTINCT p2.pass_id) * 300 FROM passes p2
           WHERE p2.pass_id IN (
             -- Tech passes with 0 slots
             SELECT p3.pass_id FROM passes p3 
             LEFT JOIN slots s3 ON p3.pass_id = s3.pass_id 
             WHERE s3.pass_id IS NULL
             UNION
             -- Tech passes with >1 slots  
             SELECT p4.pass_id FROM passes p4
             JOIN slots s4 ON p4.pass_id = s4.pass_id
             GROUP BY p4.pass_id HAVING COUNT(*) > 1
             UNION
             -- Tech passes with exactly 1 slot for technical events
             SELECT p5.pass_id FROM passes p5
             JOIN slots s5 ON p5.pass_id = s5.pass_id
             JOIN events e5 ON s5.event_id = e5.external_id
             WHERE e5.event_type = 'technical'
             GROUP BY p5.pass_id HAVING COUNT(*) = 1
           ))::decimal AS total_revenue
        FROM events e
        LEFT JOIN slots s ON s.event_id = e.external_id
        WHERE e.event_type = 'technical' AND e.department_id != (SELECT id FROM departments WHERE name = 'WORKSHOP')
      `);
      
      // Get non-technical and workshop event breakdowns
      const otherBreakdown = await db.query(`
        SELECT
          e.event_type,
          COUNT(DISTINCT e.external_id)::int AS event_count,
          COUNT(s.*)::int AS total_registrations,
          COALESCE(SUM(CASE WHEN s.attended THEN 1 ELSE 0 END),0)::int AS total_attendance,
          COALESCE(SUM(r.amount), 0)::decimal AS total_revenue
        FROM events e
        LEFT JOIN slots s ON s.event_id = e.external_id
        LEFT JOIN passes p ON p.pass_id = s.pass_id
        LEFT JOIN receipts r ON r.payment_id = p.payment_id
        WHERE e.event_type != 'technical' AND e.department_id != (SELECT id FROM departments WHERE name = 'WORKSHOP')
        GROUP BY e.event_type
        ORDER BY total_registrations DESC
      `);
      
      eventTypeBreakdown.push(...techBreakdown.rows, ...otherBreakdown.rows);

      // Top events
      const topEvents = (
        await db.query(`
      SELECT
        e.external_id AS event_id,
        e.name AS event_name,
        e.event_type,
        d.id AS department_id,
        d.name AS department_name,
        COUNT(s.*)::int AS registrations,
        COALESCE(SUM(CASE WHEN s.attended THEN 1 ELSE 0 END),0)::int AS attendance,
        COALESCE(SUM(r.amount), 0)::decimal AS revenue
      FROM events e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN slots s ON s.event_id = e.external_id
      LEFT JOIN passes p ON p.pass_id = s.pass_id
      LEFT JOIN receipts r ON r.payment_id = p.payment_id
      WHERE e.department_id != (SELECT id FROM departments WHERE name = 'WORKSHOP')
      GROUP BY e.external_id, e.name, e.event_type, d.id, d.name
      ORDER BY registrations DESC
    `)
      ).rows;

      // Time-based analytics
      const timeRes = (
        await db.query(`
      SELECT 
        date_trunc('day', s.created_at)::date AS day, 
        COUNT(*)::int AS count,
        e.event_type
      FROM slots s
      JOIN events e ON s.event_id = e.external_id
      WHERE s.created_at >= now() - interval '30 days'
      GROUP BY day, e.event_type
      ORDER BY day, e.event_type
    `)
      ).rows;

      // Payment analytics
      const passesByPayment = (
        await db.query(`
      SELECT 
        r.method,
        COUNT(DISTINCT p.pass_id)::int AS total_passes,
        COALESCE(SUM(r.amount), 0)::decimal AS total_revenue
      FROM passes p
      JOIN receipts r ON p.payment_id = r.payment_id
      GROUP BY r.method
    `)
      ).rows;

      // Payment analytics by event type
      const paymentByEventType = (
        await db.query(`
      SELECT 
        e.event_type,
        r.method,
        COUNT(DISTINCT p.pass_id)::int AS passes,
        COALESCE(SUM(r.amount), 0)::decimal AS revenue
      FROM passes p
      JOIN receipts r ON p.payment_id = r.payment_id
      JOIN slots s ON p.pass_id = s.pass_id
      JOIN events e ON s.event_id = e.external_id
      GROUP BY e.event_type, r.method
      UNION ALL
      SELECT 
        'hackathon' as event_type,
        r.method,
        COUNT(DISTINCT h.team_id)::int AS passes,
        COALESCE(SUM(r.amount), 0)::decimal AS revenue
      FROM hack_passes h
      JOIN receipts r ON h.payment_id = r.payment_id
      GROUP BY r.method
      ORDER BY event_type, method
    `)
      ).rows;

      // Attendance analytics by payment method and event type
      const attendanceByPaymentType = (
        await db.query(`
      SELECT 
        e.event_type,
        r.method,
        COUNT(DISTINCT p.pass_id)::int AS total_registrations,
        COUNT(DISTINCT CASE WHEN s.attended = true THEN p.pass_id END)::int AS attended_count
      FROM passes p
      JOIN receipts r ON p.payment_id = r.payment_id
      JOIN slots s ON p.pass_id = s.pass_id
      JOIN events e ON s.event_id = e.external_id
      GROUP BY e.event_type, r.method
      UNION ALL
      SELECT 
        'hackathon' as event_type,
        r.method,
        COUNT(DISTINCT h.team_id)::int AS total_registrations,
        COUNT(DISTINCT CASE WHEN h.attended = true THEN h.team_id END)::int AS attended_count
      FROM hack_passes h
      JOIN receipts r ON h.payment_id = r.payment_id
      GROUP BY r.method
      ORDER BY event_type, method
    `)
      ).rows;

      // Workshop analytics
      const workshopAnalytics = (
        await db.query(`
      SELECT
        e.external_id AS event_id,
        e.name AS event_name,
        e.cost,
        COUNT(s.*)::int AS registrations,
        COALESCE(SUM(CASE WHEN s.attended THEN 1 ELSE 0 END),0)::int AS attendance,
        COALESCE(SUM(r.amount), 0)::decimal AS revenue
      FROM events e
      LEFT JOIN slots s ON s.event_id = e.external_id
      LEFT JOIN passes p ON p.pass_id = s.pass_id
      LEFT JOIN receipts r ON r.payment_id = p.payment_id
      WHERE e.department_id = (SELECT id FROM departments WHERE name = 'WORKSHOP')
      GROUP BY e.external_id, e.name, e.cost
      ORDER BY registrations DESC
    `)
      ).rows;

      // Hackathon analytics
      const hackathonAnalytics = (
        await db.query(`
      SELECT
        track,
        COUNT(*)::int AS team_count,
        COUNT(CASE WHEN attended THEN 1 END)::int AS attended_teams,
        COUNT(DISTINCT leader_email)::int AS unique_leaders
      FROM hack_passes
      GROUP BY track
      ORDER BY team_count DESC
    `)
      ).rows;

      const hackathonDetails = (
        await db.query(`
      WITH team_members AS (
        SELECT 
          hd.team_id,
          jsonb_agg(jsonb_build_object(
            'email', hd.email,
            'name', hd.full_name,
            'institution', hd.institution,
            'phone', hd.phone_number,
            'gender', hd.gender,
            'department', hd.department,
            'year', hd.year_of_study
          )) AS members
        FROM hack_reg_details hd
        GROUP BY hd.team_id
      ),
      team_track_info AS (
        SELECT
          t.team_id,
          t.domain_name,
          t.problem_statement
        FROM track t
      ),
      team_sizes AS (
        SELECT 
          team_id,
          COUNT(email)::int as member_count
        FROM hack_reg_details
        GROUP BY team_id
      )
      SELECT
        h.team_id,
        h.team_name,
        h.track,
        h.attended,
        h.created_at,
        h.payment_id,
        h.ticket_issued,
        COALESCE(ts.member_count, 0) as team_size,
        tti.domain_name,
        tti.problem_statement,
        tm.members
      FROM hack_passes h
      LEFT JOIN team_sizes ts ON h.team_id = ts.team_id
      LEFT JOIN team_track_info tti ON h.team_id = tti.team_id
      LEFT JOIN team_members tm ON h.team_id = tm.team_id
      ORDER BY h.created_at DESC
    `)
      ).rows;

      const onlinePayerStats = (await db.query(`
        WITH online_passes AS (
          SELECT p.pass_id
          FROM passes p
          JOIN receipts r ON p.payment_id = r.payment_id
          WHERE r.method = 'online'
        )
        SELECT
            COUNT(DISTINCT op.pass_id)::int AS total_online_payers,
            COUNT(DISTINCT s.pass_id)::int AS online_payers_attended
        FROM online_passes op
        LEFT JOIN slots s ON op.pass_id = s.pass_id AND s.attended = true;
      `)).rows[0];

      const centralVolunteers = (
        await db.query(`
              SELECT
              ap.name,
              ap.personal_email,
              ap.phone,
              a.role,
              d.name as department_name,
              COUNT(p.pass_id)::int AS passes_assigned,
              
              -- Pass type breakdowns
              COUNT(CASE WHEN p.pass_id LIKE '%$t' THEN 1 END)::int AS tech_passes,
              COUNT(CASE WHEN p.pass_id LIKE '%$n' THEN 1 END)::int AS nontech_passes,
              COUNT(CASE WHEN p.pass_id LIKE '%$w' THEN 1 END)::int AS workshop_passes,
              
              -- Payment method breakdowns
              COALESCE(SUM(CASE WHEN r.method = 'upi' THEN r.amount ELSE 0 END), 0)::decimal AS upi_collected,
              COALESCE(SUM(CASE WHEN r.method = 'cash' THEN r.amount ELSE 0 END), 0)::decimal AS cash_collected,
              COALESCE(SUM(CASE WHEN r.method = 'online' THEN r.amount ELSE 0 END), 0)::decimal AS online_collected,
              COALESCE(SUM(CASE WHEN r.method IN ('upi', 'cash') THEN r.amount ELSE 0 END), 0)::decimal AS onspot_collected,
              COALESCE(SUM(r.amount), 0)::decimal AS total_collected
              
              FROM admin_profiles ap
              LEFT JOIN admins a ON ap.admin_email = a.email
              LEFT JOIN departments d ON a.department_id = d.id
              LEFT JOIN passes p ON ap.personal_email = p.assigned_by
              LEFT JOIN receipts r ON p.payment_id = r.payment_id
              WHERE a.role IN ('volunteer', 'dept_admin', 'master_admin', 'workshop_admin', 'workshop_volunteer')
              GROUP BY ap.personal_email, ap.name, ap.phone, a.role, d.name
             ORDER BY total_collected DESC
           `)
      ).rows;

      return res.json({
        totals: {
          ...totalsRes,
          total_revenue: revenueRes.total_revenue,
          avg_transaction: revenueRes.avg_transaction,
          total_transactions: revenueRes.total_transactions,
          online_payer_stats: onlinePayerStats,
          // New event type specific totals
          tech_registrations: eventTypeTotals.tech_registrations,
          tech_revenue: eventTypeTotals.tech_revenue,
          tech_passes_count: Math.floor(eventTypeTotals.tech_revenue / 300),
          tech_online_registered: eventTypeTotals.tech_online_registered,
          tech_online_percentage: eventTypeTotals.tech_registrations > 0 ? 
            ((eventTypeTotals.tech_online_registered / eventTypeTotals.tech_registrations) * 100).toFixed(1) : "0.0",
          nontech_registrations: eventTypeTotals.nontech_teams,
          nontech_revenue: eventTypeTotals.nontech_revenue,
          workshop_registrations: eventTypeTotals.workshop_registrations,
          workshop_revenue: eventTypeTotals.workshop_revenue,
          hackathon_teams: eventTypeTotals.hackathon_teams,
          hackathon_revenue: eventTypeTotals.hackathon_revenue,
        },
        per_department: perDept,
        event_type_breakdown: eventTypeBreakdown,
        top_events: topEvents,
        registrations_over_time: timeRes,
        passes_by_payment: passesByPayment,
        payment_by_event_type: paymentByEventType,
        attendance_by_payment_type: attendanceByPaymentType,
        workshops: {
          analytics: workshopAnalytics,
          summary: {
            total_workshops: workshopAnalytics.length,
            total_registrations: workshopAnalytics.reduce(
              (sum, w) => sum + w.registrations,
              0
            ),
            total_revenue: workshopAnalytics.reduce(
              (sum, w) => sum + Number(w.revenue),
              0
            ),
          },
        },
        hackathons: {
          track_breakdown: hackathonAnalytics,
          recent_teams: hackathonDetails,
          summary: {
            total_teams: totalsRes.total_hackathon_teams,
            total_attended: hackathonAnalytics.reduce(
              (sum, h) => sum + h.attended_teams,
              0
            ),
            total_participants: hackathonDetails.reduce(
              (sum, h) => sum + h.team_size,
              0
            ),
          },
        },
        central_volunteers: centralVolunteers,
      });
    } catch (err) {
      console.error("analytics/college error", err);
      return res.status(500).json({ error: "server error" });
    }
  }
);

// College-level participants list with filtering
router.get(
  "/college/participants",
  authMiddleware,
  requireRole(["super_admin", "master_admin"]),
  async (req, res) => {
    try {
      const { payment_method, attended, event_type, department_id } = req.query;

      // Build aggregated query with user details and event lists for all departments
      let query = `
        SELECT 
          p.user_email,
          u.name,
          u.phone,
          u.institution,
          COUNT(DISTINCT p.pass_id) as total_passes,
          STRING_AGG(DISTINCT e.name, ', ' ORDER BY e.name) as registered_events,
          COUNT(DISTINCT s.slot_no) as total_registrations,
          COUNT(DISTINCT CASE WHEN s.attended = true THEN s.slot_no END) as attended_count,
          MIN(s.created_at) as first_registration_date,
          CASE 
            WHEN COUNT(DISTINCT CASE WHEN s.attended = true THEN s.slot_no END) > 0 THEN true
            ELSE false
          END as attended_any_event
        FROM slots s
        JOIN passes p ON s.pass_id = p.pass_id
        JOIN users u ON p.user_email = u.email
        JOIN receipts r ON p.payment_id = r.payment_id
        JOIN events e ON s.event_id = e.external_id
        JOIN departments d ON e.department_id = d.id
        WHERE d.name != 'WORKSHOP'
      `;
      
      const params = [];
      
      if (payment_method) {
        if (payment_method === 'offline') {
          // Map 'offline' to both 'cash' and 'upi'
          query += ` AND r.method IN ('cash', 'upi')`;
        } else {
          query += ` AND r.method = $${params.length + 1}`;
          params.push(payment_method);
        }
      }
      
      if (event_type) {
        query += ` AND e.event_type = $${params.length + 1}`;
        params.push(event_type);
      }
      
      if (department_id) {
        query += ` AND d.id = $${params.length + 1}`;
        params.push(parseInt(department_id));
      }
      
      query += ` 
        GROUP BY p.user_email, u.name, u.phone, u.institution
      `;
      
      // Apply attended filter after aggregation
      if (attended === 'true') {
        query += ` HAVING COUNT(DISTINCT CASE WHEN s.attended = true THEN s.slot_no END) > 0`;
      } else if (attended === 'false') {
        query += ` HAVING COUNT(DISTINCT CASE WHEN s.attended = true THEN s.slot_no END) = 0`;
      }
      
      query += ` ORDER BY u.name`;

      const participants = await db.query(query, params);

      // Add workshop participants
      let workshopParticipants = [];
      if (!event_type || event_type === 'workshop') {
        let workshopQuery = `
          SELECT 
            p.user_email,
            u.name,
            u.phone,
            u.institution,
            COUNT(DISTINCT p.pass_id) as total_passes,
            STRING_AGG(DISTINCT e.name, ', ' ORDER BY e.name) as registered_events,
            COUNT(DISTINCT s.slot_no) as total_registrations,
            COUNT(DISTINCT CASE WHEN s.attended = true THEN s.slot_no END) as attended_count,
            MIN(s.created_at) as first_registration_date,
            CASE 
              WHEN COUNT(DISTINCT CASE WHEN s.attended = true THEN s.slot_no END) > 0 THEN true
              ELSE false
            END as attended_any_event
          FROM slots s
          JOIN passes p ON s.pass_id = p.pass_id
          JOIN users u ON p.user_email = u.email
          JOIN receipts r ON p.payment_id = r.payment_id
          JOIN events e ON s.event_id = e.external_id
          JOIN departments d ON e.department_id = d.id
          WHERE d.name = 'WORKSHOP'
        `;
        
        const workshopParams = [];
        
        if (payment_method) {
          if (payment_method === 'offline') {
            // Map 'offline' to both 'cash' and 'upi'
            workshopQuery += ` AND r.method IN ('cash', 'upi')`;
          } else {
            workshopQuery += ` AND r.method = $${workshopParams.length + 1}`;
            workshopParams.push(payment_method);
          }
        }
        
        if (attended === 'true') {
          workshopQuery += ` AND s.attended = true`;
        } else if (attended === 'false') {
          workshopQuery += ` AND s.attended = false`;
        }
        
        if (department_id) {
          const workshopDeptId = await db.query("SELECT id FROM departments WHERE name = 'WORKSHOP'");
          if (workshopDeptId.rows.length > 0 && parseInt(department_id) === workshopDeptId.rows[0].id) {
            // Include workshops if filtering by WORKSHOP department
            workshopQuery += ` GROUP BY p.user_email, u.name, u.phone, u.institution ORDER BY first_registration_date ASC`;
            const workshopRes = await db.query(workshopQuery, workshopParams);
            workshopParticipants = workshopRes.rows;
          } else {
            // Exclude workshops if filtering by a different department
            workshopParticipants = [];
          }
        } else {
          // No department filter, include all workshops
          workshopQuery += ` GROUP BY p.user_email, u.name, u.phone, u.institution ORDER BY first_registration_date ASC`;
          const workshopRes = await db.query(workshopQuery, workshopParams);
          workshopParticipants = workshopRes.rows;
        }
      }

      // Add hackathon participants
      let hackathonParticipants = [];
      let hackQuery = `
        SELECT DISTINCT
          hd.email as user_email,
          hd.full_name as name,
          hd.phone_number as phone,
          hd.institution,
          'hackathon' as event_type,
          'ECE' as department_name,
          4 as department_id,
          hp.team_name,
          hp.track,
          hp.attended,
          hp.created_at as registration_date
        FROM hack_reg_details hd
        JOIN hack_passes hp ON hd.team_id = hp.team_id
        WHERE 1=1
      `;
      
      const hackParams = [];
      
      if (attended === 'true') {
        hackQuery += ` AND hp.attended = true`;
      } else if (attended === 'false') {
        hackQuery += ` AND hp.attended = false`;
      }
      
      if (event_type && event_type !== 'hackathon') {
        // If filtering by specific event type other than hackathon, exclude hackathon data
        hackathonParticipants = [];
      } else {
        hackQuery += ` ORDER BY hd.full_name`;
        const hackRes = await db.query(hackQuery, hackParams);
        hackathonParticipants = hackRes.rows;
      }

      return res.json({
        participants: participants.rows,
        workshop_participants: workshopParticipants,
        hackathon_participants: hackathonParticipants,
        filters: { payment_method, attended, event_type, department_id }
      });
    } catch (err) {
      console.error("College participants error:", err);
      return res.status(500).json({ error: "server error" });
    }
  }
);

// Excel export endpoint
router.get(
  "/export/college",
  authMiddleware,
  requireRole(["super_admin", "master_admin"]),
  async (req, res) => {
    try {
      // Get all the data for export by calling the same queries as college analytics
      const collegeData = await getCollegeAnalyticsDataForExport();

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ["Metric", "Value"],
        ["Total Departments", collegeData.totals.total_departments],
        ["Total Events", collegeData.totals.total_events],
        ["Total Registrations", collegeData.totals.total_registrations],
        ["Total Attendance", collegeData.totals.total_attendance],
        ["Total Revenue", collegeData.totals.total_revenue],
        ["Average Transaction", collegeData.totals.avg_transaction],
        ["Total Hackathon Teams", collegeData.totals.total_hackathon_teams],
        ["Total Workshops", collegeData.totals.total_workshops],
      ];
      const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWS, "Summary");

      // Department breakdown
      const deptData = [
        ["Department", "Events", "Registrations", "Attendance", "Revenue"],
        ...collegeData.per_department.map((d) => [
          d.department_name,
          d.event_count,
          d.registrations,
          d.attendance,
          d.revenue,
        ]),
      ];
      const deptWS = XLSX.utils.aoa_to_sheet(deptData);
      XLSX.utils.book_append_sheet(wb, deptWS, "Departments");

      // Event type breakdown
      const eventTypeData = [
        ["Event Type", "Event Count", "Registrations", "Attendance", "Revenue"],
        ...collegeData.event_type_breakdown.map((e) => [
          e.event_type,
          e.event_count,
          e.total_registrations,
          e.total_attendance,
          e.total_revenue,
        ]),
      ];
      const eventTypeWS = XLSX.utils.aoa_to_sheet(eventTypeData);
      XLSX.utils.book_append_sheet(wb, eventTypeWS, "Event Types");

      // Top events
      const topEventsData = [
        [
          "Event Name",
          "Department",
          "Type",
          "Registrations",
          "Attendance",
          "Revenue",
        ],
        ...collegeData.top_events.map((e) => [
          e.event_name,
          e.department_name,
          e.event_type,
          e.registrations,
          e.attendance,
          e.revenue,
        ]),
      ];
      const topEventsWS = XLSX.utils.aoa_to_sheet(topEventsData);
      XLSX.utils.book_append_sheet(wb, topEventsWS, "Top Events");

      // Workshops
      const workshopData = [
        ["Workshop Name", "Cost", "Registrations", "Attendance", "Revenue"],
        ...collegeData.workshops.analytics.map((w) => [
          w.event_name,
          w.cost,
          w.registrations,
          w.attendance,
          w.revenue,
        ]),
      ];
      const workshopWS = XLSX.utils.aoa_to_sheet(workshopData);
      XLSX.utils.book_append_sheet(wb, workshopWS, "Workshops");

      // Hackathons
      const hackathonData = [
        ["Track", "Team Count", "Attended Teams", "Unique Leaders"],
        ...collegeData.hackathons.track_breakdown.map((h) => [
          h.track,
          h.team_count,
          h.attended_teams,
          h.unique_leaders,
        ]),
      ];
      const hackathonWS = XLSX.utils.aoa_to_sheet(hackathonData);
      XLSX.utils.book_append_sheet(wb, hackathonWS, "Hackathons");

      // Generate buffer
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      // Set headers for download
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="invente25-analytics-${
          new Date().toISOString().split("T")[0]
        }.xlsx"`
      );
      res.send(buffer);
    } catch (err) {
      console.error("Export error:", err);
      res.status(500).json({ error: "Export failed" });
    }
  }
);

// Helper function to get college analytics data for export
async function getCollegeAnalyticsDataForExport() {
  // Basic totals
  const totalsRes = (
    await db.query(`
    SELECT
      (SELECT COUNT(*) FROM departments WHERE name != 'WORKSHOP')::int AS total_departments,
      (SELECT COUNT(*) FROM events WHERE department_id != (SELECT id FROM departments WHERE name = 'WORKSHOP'))::int AS total_events,
      (SELECT COUNT(*) FROM slots)::int AS total_registrations,
      (SELECT COALESCE(SUM(CASE WHEN attended THEN 1 ELSE 0 END),0)::int FROM slots) AS total_attendance,
      (SELECT COUNT(*) FROM hack_passes)::int AS total_hackathon_teams,
      (SELECT COUNT(*) FROM events WHERE department_id = (SELECT id FROM departments WHERE name = 'WORKSHOP'))::int AS total_workshops
  `)
  ).rows[0];

  // Revenue analytics
  const revenueRes = (
    await db.query(`
    SELECT 
      COALESCE(SUM(r.amount), 0)::decimal AS total_revenue,
      COALESCE(AVG(r.amount), 0)::decimal AS avg_transaction,
      COUNT(DISTINCT r.payment_id)::int AS total_transactions
    FROM receipts r
  `)
  ).rows[0];

  // Department analytics (excluding WORKSHOP)
  const perDept = (
    await db.query(`
    SELECT
      d.id AS department_id,
      d.name AS department_name,
      COUNT(DISTINCT e.external_id)::int AS event_count,
      COUNT(s.*)::int AS registrations,
      COALESCE(SUM(CASE WHEN s.attended THEN 1 ELSE 0 END),0)::int AS attendance,
      COALESCE(SUM(r.amount), 0)::decimal AS revenue
    FROM departments d
    LEFT JOIN events e ON e.department_id = d.id
    LEFT JOIN slots s ON s.event_id = e.external_id
    LEFT JOIN passes p ON p.pass_id = s.pass_id
    LEFT JOIN receipts r ON r.payment_id = p.payment_id
    WHERE d.name != 'WORKSHOP'
    GROUP BY d.id, d.name
    ORDER BY registrations DESC
  `)
  ).rows;

  // Event type breakdown with corrected technical revenue calculation
  const eventTypeBreakdown = [];
  
  // Get technical event breakdown
  const techBreakdown = await db.query(`
    SELECT
      'technical' as event_type,
      COUNT(DISTINCT e.external_id)::int AS event_count,
      COUNT(s.*)::int AS total_registrations,
      COALESCE(SUM(CASE WHEN s.attended THEN 1 ELSE 0 END),0)::int AS total_attendance,
      -- Count distinct tech passes × 300
      (SELECT COUNT(DISTINCT p2.pass_id) * 300 FROM passes p2
       WHERE p2.pass_id IN (
         -- Tech passes with 0 slots
         SELECT p3.pass_id FROM passes p3 
         LEFT JOIN slots s3 ON p3.pass_id = s3.pass_id 
         WHERE s3.pass_id IS NULL
         UNION
         -- Tech passes with >1 slots  
         SELECT p4.pass_id FROM passes p4
         JOIN slots s4 ON p4.pass_id = s4.pass_id
         GROUP BY p4.pass_id HAVING COUNT(*) > 1
         UNION
         -- Tech passes with exactly 1 slot for technical events
         SELECT p5.pass_id FROM passes p5
         JOIN slots s5 ON p5.pass_id = s5.pass_id
         JOIN events e5 ON s5.event_id = e5.external_id
         WHERE e5.event_type = 'technical'
         GROUP BY p5.pass_id HAVING COUNT(*) = 1
       ))::decimal AS total_revenue
    FROM events e
    LEFT JOIN slots s ON s.event_id = e.external_id
    WHERE e.event_type = 'technical' AND e.department_id != (SELECT id FROM departments WHERE name = 'WORKSHOP')
  `);
  
  // Get non-technical and workshop event breakdowns  
  const otherBreakdown = await db.query(`
    SELECT
      e.event_type,
      COUNT(DISTINCT e.external_id)::int AS event_count,
      COUNT(s.*)::int AS total_registrations,
      COALESCE(SUM(CASE WHEN s.attended THEN 1 ELSE 0 END),0)::int AS total_attendance,
      COALESCE(SUM(r.amount), 0)::decimal AS total_revenue
    FROM events e
    LEFT JOIN slots s ON s.event_id = e.external_id
    LEFT JOIN passes p ON p.pass_id = s.pass_id
    LEFT JOIN receipts r ON r.payment_id = p.payment_id
    WHERE e.event_type != 'technical' AND e.department_id != (SELECT id FROM departments WHERE name = 'WORKSHOP')
    GROUP BY e.event_type
    ORDER BY total_registrations DESC
  `);
  
  eventTypeBreakdown.push(...techBreakdown.rows, ...otherBreakdown.rows);

  // Top events
  const topEvents = (
    await db.query(`
    SELECT
      e.external_id AS event_id,
      e.name AS event_name,
      e.event_type,
      d.id AS department_id,
      d.name AS department_name,
      COUNT(s.*)::int AS registrations,
      COALESCE(SUM(CASE WHEN s.attended THEN 1 ELSE 0 END),0)::int AS attendance,
      COALESCE(SUM(r.amount), 0)::decimal AS revenue
    FROM events e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN slots s ON s.event_id = e.external_id
    LEFT JOIN passes p ON p.pass_id = s.pass_id
    LEFT JOIN receipts r ON r.payment_id = p.payment_id
    WHERE e.department_id != (SELECT id FROM departments WHERE name = 'WORKSHOP')
    GROUP BY e.external_id, e.name, e.event_type, d.id, d.name
    ORDER BY registrations DESC
  `)
  ).rows;

  // Workshop analytics
  const workshopAnalytics = (
    await db.query(`
    SELECT
      e.external_id AS event_id,
      e.name AS event_name,
      e.cost,
      COUNT(s.*)::int AS registrations,
      COALESCE(SUM(CASE WHEN s.attended THEN 1 ELSE 0 END),0)::int AS attendance,
      COALESCE(SUM(r.amount), 0)::decimal AS revenue
    FROM events e
    LEFT JOIN slots s ON s.event_id = e.external_id
    LEFT JOIN passes p ON p.pass_id = s.pass_id
    LEFT JOIN receipts r ON r.payment_id = p.payment_id
    WHERE e.department_id = (SELECT id FROM departments WHERE name = 'WORKSHOP')
    GROUP BY e.external_id, e.name, e.cost
    ORDER BY registrations DESC
  `)
  ).rows;

  // Hackathon analytics
  const hackathonAnalytics = (
    await db.query(`
    SELECT
      track,
      COUNT(*)::int AS team_count,
      COUNT(CASE WHEN attended THEN 1 END)::int AS attended_teams,
      COUNT(DISTINCT leader_email)::int AS unique_leaders
    FROM hack_passes
    GROUP BY track
    ORDER BY team_count DESC
  `)
  ).rows;

  return {
    totals: {
      ...totalsRes,
      total_revenue: revenueRes.total_revenue,
      avg_transaction: revenueRes.avg_transaction,
      total_transactions: revenueRes.total_transactions,
    },
    per_department: perDept,
    event_type_breakdown: eventTypeBreakdown,
    top_events: topEvents,
    workshops: {
      analytics: workshopAnalytics,
    },
    hackathons: {
      track_breakdown: hackathonAnalytics,
    },
  };
}

// +++ START: NEW ENDPOINT for All Events Table +++
router.get(
  "/all-events",
  authMiddleware,
  requireRole(['super_admin', 'master_admin']),
  async (req, res) => {
    try {
      const allEvents = (await db.query(`
        SELECT
          e.external_id AS event_id,
          e.name AS event_name,
          e.event_type,
          d.name AS department_name,
          COUNT(s.*)::int AS registrations,
          COALESCE(SUM(CASE WHEN s.attended THEN 1 ELSE 0 END), 0)::int AS attendance,
          CASE 
            WHEN e.event_type = 'technical' THEN 0::decimal
            ELSE COALESCE(SUM(r.amount), 0)::decimal
          END AS revenue
        FROM events e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN slots s ON s.event_id = e.external_id
        LEFT JOIN passes p ON p.pass_id = s.pass_id
        LEFT JOIN receipts r ON r.payment_id = p.payment_id
        GROUP BY e.external_id, e.name, e.event_type, d.name
        ORDER BY registrations DESC;
      `)).rows;
      res.json(allEvents);
    } catch (err) {
      console.error('Error fetching all events analytics:', err);
      res.status(500).json({ error: 'Failed to fetch all events' });
    }
  }
);

// Workshop analytics endpoint (separate from departments)
router.get(
  "/workshops",
  authMiddleware,
  requireRole(["super_admin", "master_admin", "workshop_admin"]),
  async (req, res) => {
    try {
      const workshopAnalytics = (
        await db.query(`
      SELECT
        e.external_id AS event_id,
        e.name AS event_name,
        e.cost,
        COUNT(s.*)::int AS registrations,
        COALESCE(SUM(CASE WHEN s.attended THEN 1 ELSE 0 END),0)::int AS attendance,
        COALESCE(SUM(r.amount), 0)::decimal AS revenue
      FROM events e
      LEFT JOIN slots s ON s.event_id = e.external_id
      LEFT JOIN passes p ON p.pass_id = s.pass_id
      LEFT JOIN receipts r ON r.payment_id = p.payment_id
      WHERE e.department_id = (SELECT id FROM departments WHERE name = 'WORKSHOP')
      GROUP BY e.external_id, e.name, e.cost
      ORDER BY registrations DESC
    `)
      ).rows;

      const summary = {
        total_workshops: workshopAnalytics.length,
        total_registrations: workshopAnalytics.reduce(
          (sum, w) => sum + w.registrations,
          0
        ),
        total_attendance: workshopAnalytics.reduce(
          (sum, w) => sum + w.attendance,
          0
        ),
        total_revenue: workshopAnalytics.reduce(
          (sum, w) => sum + Number(w.revenue),
          0
        ),
      };

      // Workshop staff and revenue analytics (workshop staff only)
      const workshopStaff = (
        await db.query(`
          SELECT
            ap.name,
            ap.personal_email,
            ap.phone,
            a.role,
            d.name as department_name,
            COUNT(p.pass_id)::int AS passes_assigned,
            COALESCE(SUM(CASE WHEN r.method = 'upi' THEN r.amount ELSE 0 END), 0)::decimal AS upi_collected,
            COALESCE(SUM(CASE WHEN r.method = 'cash' THEN r.amount ELSE 0 END), 0)::decimal AS cash_collected,
            COALESCE(SUM(CASE WHEN r.method IN ('upi', 'cash') THEN r.amount ELSE 0 END), 0)::decimal AS total_collected
          FROM admin_profiles ap
          LEFT JOIN admins a ON ap.admin_email = a.email
          LEFT JOIN departments d ON a.department_id = d.id
          LEFT JOIN passes p ON ap.personal_email = p.assigned_by
          LEFT JOIN receipts r ON p.payment_id = r.payment_id
          WHERE a.role IN ('workshop_admin', 'workshop_volunteer')
            AND a.department_id = (SELECT id FROM departments WHERE name = 'WORKSHOP')
          GROUP BY ap.personal_email, ap.name, ap.phone, a.role, d.name
          ORDER BY total_collected DESC
        `)
      ).rows;

      res.json({
        summary,
        workshops: workshopAnalytics,
        workshop_staff: workshopStaff,
      });
    } catch (err) {
      console.error("Workshop analytics error:", err);
      res.status(500).json({ error: "server error" });
    }
  }
);

// Hackathon analytics endpoint
router.get(
  "/hackathons",
  authMiddleware,
  requireRole(["super_admin", "master_admin", "dept_admin"]),
  async (req, res) => {
    try {
      const trackBreakdown = (
        await db.query(`
      SELECT
        track,
        COUNT(*)::int AS team_count,
        COUNT(CASE WHEN attended THEN 1 END)::int AS attended_teams,
        COUNT(DISTINCT leader_email)::int AS unique_leaders
      FROM hack_passes
      GROUP BY track
      ORDER BY team_count DESC
    `)
      ).rows;

      const teamDetails = (
        await db.query(`
      SELECT
        h.team_id,
        h.team_name,
        h.track,
        h.attended,
        h.created_at,
        COUNT(hd.email)::int AS team_size
      FROM hack_passes h
      LEFT JOIN hack_reg_details hd ON h.team_id = hd.team_id
      GROUP BY h.team_id, h.team_name, h.track, h.attended, h.created_at
      ORDER BY h.created_at DESC
    `)
      ).rows;

      const demographicData = (
        await db.query(`
      SELECT
        hd.department,
        hd.year_of_study,
        hd.gender,
        COUNT(*)::int AS participant_count
      FROM hack_reg_details hd
      GROUP BY hd.department, hd.year_of_study, hd.gender
      ORDER BY participant_count DESC
    `)
      ).rows;

      const summary = {
        total_teams: trackBreakdown.reduce((sum, t) => sum + t.team_count, 0),
        total_attended: trackBreakdown.reduce(
          (sum, t) => sum + t.attended_teams,
          0
        ),
        total_participants: teamDetails.reduce(
          (sum, t) => sum + t.team_size,
          0
        ),
      };

      res.json({
        summary,
        track_breakdown: trackBreakdown,
        team_details: teamDetails,
        demographics: demographicData,
      });
    } catch (err) {
      console.error("Hackathon analytics error:", err);
      res.status(500).json({ error: "server error" });
    }
  }
);

// Filtered Staff & Revenue Analytics
router.get("/staff-revenue-filtered", authMiddleware, requireRole(['super_admin', 'master_admin']), async (req, res) => {
  try {
    const { passType, paymentMethod } = req.query;

    // Build WHERE conditions for filters
    let passTypeFilter = "";
    if (passType === "tech") {
      passTypeFilter = "AND p.pass_id LIKE '%$t'";
    } else if (passType === "nontech") {
      passTypeFilter = "AND p.pass_id LIKE '%$n'";
    } else if (passType === "workshop") {
      passTypeFilter = "AND p.pass_id LIKE '%$w'";
    }

    let paymentMethodFilter = "";
    if (paymentMethod === "online") {
      paymentMethodFilter = "AND r.method = 'online'";
    } else if (paymentMethod === "onspot") {
      paymentMethodFilter = "AND r.method IN ('upi', 'cash')";
    }

    const filteredVolunteers = (
      await db.query(`
            SELECT
            ap.name,
            ap.personal_email,
            ap.phone,
            a.role,
            d.name as department_name,
            COUNT(p.pass_id)::int AS passes_assigned,
            
            -- Pass type breakdowns
            COUNT(CASE WHEN p.pass_id LIKE '%$t' THEN 1 END)::int AS tech_passes,
            COUNT(CASE WHEN p.pass_id LIKE '%$n' THEN 1 END)::int AS nontech_passes,
            COUNT(CASE WHEN p.pass_id LIKE '%$w' THEN 1 END)::int AS workshop_passes,
            
            -- Payment method breakdowns
            COALESCE(SUM(CASE WHEN r.method = 'upi' THEN r.amount ELSE 0 END), 0)::decimal AS upi_collected,
            COALESCE(SUM(CASE WHEN r.method = 'cash' THEN r.amount ELSE 0 END), 0)::decimal AS cash_collected,
            COALESCE(SUM(CASE WHEN r.method = 'online' THEN r.amount ELSE 0 END), 0)::decimal AS online_collected,
            COALESCE(SUM(CASE WHEN r.method IN ('upi', 'cash') THEN r.amount ELSE 0 END), 0)::decimal AS onspot_collected,
            COALESCE(SUM(r.amount), 0)::decimal AS total_collected
            
            FROM admin_profiles ap
            LEFT JOIN admins a ON ap.admin_email = a.email
            LEFT JOIN departments d ON a.department_id = d.id
            LEFT JOIN passes p ON ap.personal_email = p.assigned_by
            LEFT JOIN receipts r ON p.payment_id = r.payment_id
            WHERE a.role IN ('volunteer', 'dept_admin', 'master_admin', 'workshop_admin', 'workshop_volunteer')
            ${passTypeFilter}
            ${paymentMethodFilter}
            GROUP BY ap.personal_email, ap.name, ap.phone, a.role, d.name
           ORDER BY total_collected DESC
         `)
    ).rows;

    res.status(200).json({ filteredVolunteers });
  } catch (error) {
    console.error("Error in filtered staff & revenue analytics:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get detailed pass registration data for a single volunteer
router.get('/volunteer/:email', authMiddleware, requireRole(['super_admin', 'master_admin', 'dept_admin', 'workshop_admin']), async (req, res) => {
  try {
    const volunteerEmail = req.params.email;
    if (!volunteerEmail) {
      return res.status(400).json({ error: 'Volunteer email is required' });
    }

    // For department admins, check if the volunteer belongs to their department
    if (req.user.role === 'dept_admin') {
      const adminDeptId = req.user.department_id;
      if (!adminDeptId) {
        return res.status(403).json({ error: 'Department admin profile incomplete' });
      }
      
      // Check if the volunteer belongs to the same department using the same logic as department staff query
      const volunteerCheck = await db.query(`
        SELECT 1 FROM admin_profiles ap
        LEFT JOIN admins a ON ap.admin_email = a.email
        WHERE ap.personal_email = $1 
        AND a.role IN ('volunteer', 'dept_admin', 'workshop_admin', 'workshop_volunteer')
        AND a.department_id = $2
      `, [volunteerEmail, adminDeptId]);
      
      if (!volunteerCheck.rows.length) {
        return res.status(403).json({ error: 'You can only view staff members from your department' });
      }
    }

    const query = `
      SELECT
        p.pass_id,
        p.user_email,
        u.name AS user_name,
        r.amount,
        r.paid_on,
        STRING_AGG(e.name, ', ') AS event_names
      FROM passes p
      JOIN receipts r ON p.payment_id = r.payment_id
      LEFT JOIN users u ON p.user_email = u.email
      LEFT JOIN slots s ON p.pass_id = s.pass_id
      LEFT JOIN events e ON s.event_id = e.external_id
      WHERE p.assigned_by = $1
      GROUP BY p.pass_id, u.name, r.amount, r.paid_on
      ORDER BY r.paid_on DESC;
    `;
    
    const { rows } = await db.query(query, [volunteerEmail]);
    
    res.json(rows);

  } catch (err) {
    console.error('Error fetching volunteer details:', err);
    res.status(500).json({ error: 'Failed to fetch volunteer details' });
  }
});

module.exports = router;
