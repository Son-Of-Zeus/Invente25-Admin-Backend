// routes/admin.js
const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');

const router = express.Router();
const { Parser } = require('json2csv');

// --- Security: Whitelist of tables that can be modified via these admin routes ---
const ALLOWED_TABLES = [
  'users',
  'departments',
  'events',
  'receipts',
  'receipt_uploads',
  'passes',
  'slots',
  'hack_passes',
  'hack_reg_details',
  'track',
  'admins',
  'admin_profiles',
  'admin_otps',
];

const isTableAllowed = (tableName) => ALLOWED_TABLES.includes(tableName);


// Superadmin-only: dump contents of key tables (master_admin cannot access this)
router.get('/dump', authMiddleware, requireRole(['super_admin']), async (req, res) => {
  try {
    const payload = {};
    for (const t of ALLOWED_TABLES) {
      try {
        const { rows } = await db.query(`SELECT * FROM ${t} ORDER BY 1 DESC`);
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


// --- NEW: Generic record deletion route (master_admin cannot access this) ---
router.delete('/record', authMiddleware, requireRole(['super_admin']), async (req, res) => {
  const { tableName, primaryKey } = req.body;

  if (!tableName || !primaryKey || Object.keys(primaryKey).length === 0) {
    return res.status(400).json({ ok: false, error: 'tableName and primaryKey are required.' });
  }

  if (!isTableAllowed(tableName)) {
    return res.status(403).json({ ok: false, error: 'Operation on this table is not allowed.' });
  }

  try {
    const whereConditions = Object.keys(primaryKey).map((key, index) => `"${key}" = $${index + 1}`).join(' AND ');
    const values = Object.values(primaryKey);

    const query = `DELETE FROM ${tableName} WHERE ${whereConditions}`;
    
    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Record not found.' });
    }

    res.json({ ok: true, message: 'Record deleted successfully.' });
  } catch (err) {
    console.error(`Error deleting from ${tableName}:`, err);
    if (err.code === '23503') { // Foreign key violation
        return res.status(400).json({ ok: false, error: `Cannot delete: This record is referenced by other data. (Details: ${err.detail})` });
    }
    res.status(500).json({ ok: false, error: 'Server error while deleting record.' });
  }
});


// --- NEW: Generic record insertion route ---
router.post('/record', authMiddleware, requireRole(['super_admin']), async (req, res) => {
    const { tableName, data } = req.body;

    if (!tableName || !data || Object.keys(data).length === 0) {
        return res.status(400).json({ ok: false, error: 'tableName and data are required.' });
    }

    if (!isTableAllowed(tableName)) {
        return res.status(403).json({ ok: false, error: 'Operation on this table is not allowed.' });
    }

    try {
        const columns = Object.keys(data).map(col => `"${col}"`).join(', ');
        const placeholders = Object.keys(data).map((_, index) => `$${index + 1}`).join(', ');
        const values = Object.values(data);

        // NOTE: For the 'admins' table, 'password_hash' must be provided as a valid hash
        // generated with pgcrypto's crypt() function, as the backend does not re-hash it.
        const query = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) RETURNING *`;

        const { rows } = await db.query(query, values);
        
        res.status(201).json({ ok: true, message: 'Record created successfully.', record: rows[0] });

    } catch(err) {
        console.error(`Error inserting into ${tableName}:`, err);
        // Provide detailed database constraint errors to the admin
        if (err.code) { 
            return res.status(400).json({ ok: false, error: `Database error: ${err.detail || err.message}` });
        }
        res.status(500).json({ ok: false, error: 'Server error while creating record.' });
    }
});


// Volunteer summary with role-based scoping and optional CSV
router.get('/volunteer-summary', authMiddleware, requireRole(['super_admin', 'master_admin', 'dept_admin']), async (req, res) => {
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



module.exports = router;