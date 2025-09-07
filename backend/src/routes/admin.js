// routes/admin.js
const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');

const router = express.Router();
const { Parser } = require('json2csv');

// Superadmin-only: dump contents of key tables
router.get('/dump', authMiddleware, requireRole(['super_admin']), async (req, res) => {
  try {
    const tables = [
      'users',
      'departments',
      'events',
      'receipts',
      'passes',
      'slots',
      'hack_passes',
      'hack_reg_details',
      'admins'
    ];

    const payload = {};
    for (const t of tables) {
      try {
        const { rows } = await db.query(`SELECT * FROM ${t} ORDER BY 1 LIMIT 500`);
        payload[t] = rows;
      } catch (e) {
        payload[t] = { error: e.message };
      }
    }

    return res.json({ ok: true, tables: payload });
  } catch (err) {
    console.error('admin dump error', err);
    return res.status(500).json({ ok: false, error: 'server error' });
  }
});

module.exports = router;

// Volunteer summary with role-based scoping and optional CSV
router.get('/volunteer-summary', authMiddleware, requireRole(['super_admin','dept_admin']), async (req, res) => {
  try {
    const { format } = req.query; // 'csv' to download csv

    // Determine scope: super_admin -> all; dept_admin -> only their department
    let whereClause = '';
    let params = [];
    if (req.user.role === 'dept_admin') {
      whereClause = 'WHERE a.department_id = $1';
      params.push(req.user.department_id);
    }

    // Aggregate per volunteer using assigned_by = personal_email
    // For tech passes ($t): 300 each
    // For non-tech/workshop ($n, $w): sum event cost via slots->events
    const rows = (await db.query(`
      WITH base AS (
        SELECT ap.personal_email, ap.name, ap.phone, ap.admin_email, a.department_id,
               p.pass_id, p.created_at
        FROM admin_profiles ap
        JOIN admins a ON a.email = ap.admin_email
        LEFT JOIN passes p ON p.assigned_by = ap.personal_email
        ${whereClause}
      ),
      tech AS (
        SELECT personal_email,
               COUNT(*) FILTER (WHERE pass_id LIKE '%$t') AS tech_count,
               300 * COUNT(*) FILTER (WHERE pass_id LIKE '%$t') AS tech_amount
        FROM base
        GROUP BY personal_email
      ),
      nw AS (
        SELECT b.personal_email,
               COUNT(*) FILTER (WHERE b.pass_id LIKE '%$n') AS n_count,
               COALESCE(SUM(e.cost) FILTER (WHERE b.pass_id LIKE '%$n'), 0) AS n_amount,
               COUNT(*) FILTER (WHERE b.pass_id LIKE '%$w') AS w_count,
               COALESCE(SUM(e.cost) FILTER (WHERE b.pass_id LIKE '%$w'), 0) AS w_amount
        FROM base b
        LEFT JOIN slots s ON s.pass_id = b.pass_id
        LEFT JOIN events e ON e.external_id = s.event_id
        GROUP BY b.personal_email
      )
      SELECT 
        ap.personal_email,
        ap.name,
        ap.phone,
        ap.admin_email,
        a.department_id,
        COALESCE(t.tech_count,0) AS tech_count,
        COALESCE(t.tech_amount,0) AS tech_amount,
        COALESCE(nw.n_count,0) AS nontech_count,
        COALESCE(nw.n_amount,0) AS nontech_amount,
        COALESCE(nw.w_count,0) AS workshop_count,
        COALESCE(nw.w_amount,0) AS workshop_amount,
        COALESCE(t.tech_amount,0) + COALESCE(nw.n_amount,0) + COALESCE(nw.w_amount,0) AS total_amount
      FROM admin_profiles ap
      JOIN admins a ON a.email = ap.admin_email
      LEFT JOIN tech t ON t.personal_email = ap.personal_email
      LEFT JOIN nw ON nw.personal_email = ap.personal_email
      ${whereClause}
      ORDER BY total_amount DESC NULLS LAST, ap.name
    `, params)).rows;

    if (format === 'csv') {
      const parser = new Parser({
        fields: [
          'name','personal_email','phone','admin_email','department_id',
          'tech_count','tech_amount','nontech_count','nontech_amount','workshop_count','workshop_amount','total_amount'
        ]
      });
      const csv = parser.parse(rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="volunteer_summary.csv"');
      return res.send(csv);
    }

    return res.json({ ok: true, rows });
  } catch (err) {
    console.error('GET /admin/volunteer-summary error', err);
    return res.status(500).json({ ok: false, error: 'server error' });
  }
});


