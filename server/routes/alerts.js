import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// ─────────────────────────────────────────
// GET /api/alerts
// Get all correlation alerts (unresolved first)
// ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { resolved, severity } = req.query;

    let sql = 'SELECT * FROM alerts WHERE 1=1';
    const params = [];

    if (resolved !== undefined) {
      params.push(resolved === 'true');
      sql += ` AND resolved = $${params.length}`;
    }
    if (severity) {
      params.push(severity);
      sql += ` AND severity = $${params.length}`;
    }

    sql += ' ORDER BY timestamp DESC';

    const result = await query(sql, params);

    res.json({ success: true, alerts: result.rows, total: result.rowCount });
  } catch (err) {
    console.error('[Alerts GET /] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/alerts/stats
// Alert statistics summary
// ─────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const result = await query('SELECT * FROM alerts', []);
    const all = result.rows;

    const stats = {
      total: all.length,
      unresolved: all.filter(a => !a.resolved).length,
      resolved: all.filter(a => a.resolved).length,
      critical: all.filter(a => a.severity === 'Critical' && !a.resolved).length,
      high: all.filter(a => a.severity === 'High' && !a.resolved).length,
      medium: all.filter(a => a.severity === 'Medium' && !a.resolved).length,
      by_type: {}
    };

    for (const alert of all) {
      if (!alert.resolved) {
        stats.by_type[alert.type] = (stats.by_type[alert.type] || 0) + 1;
      }
    }

    res.json({ success: true, stats });
  } catch (err) {
    console.error('[Alerts GET /stats] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/alerts
// Manually create an alert
// ─────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { type, severity, title, description, entity_type, entity_value, cases } = req.body;

    if (!title || !severity) {
      return res.status(400).json({ success: false, error: 'title and severity are required' });
    }

    const alertId = `ALT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const result = await query(
      'INSERT INTO alerts (id, type, severity, title, description, entity_type, entity_value, cases) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [alertId, type || 'manual', severity, title, description || '', entity_type || '', entity_value || '', JSON.stringify(cases || [])]
    );

    res.json({ success: true, alert: result.rows[0] });
  } catch (err) {
    console.error('[Alerts POST /] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// PATCH /api/alerts/:id/resolve
// Resolve an alert
// ─────────────────────────────────────────
router.patch('/:id/resolve', async (req, res) => {
  try {
    const result = await query(
      'UPDATE alerts SET resolved = true WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    res.json({ success: true, alert: result.rows[0], message: 'Alert resolved.' });
  } catch (err) {
    console.error(`[Alerts PATCH /${req.params.id}/resolve] Error:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/alerts/run-correlation
// Run cross-case correlation to generate new alerts
// ─────────────────────────────────────────
router.post('/run-correlation', async (req, res) => {
  try {
    const newAlerts = [];

    // 1. Scan active case entities for overlap
    const activeResult = await query(`
      SELECT ee.entity_id, e.entity_type, e.entity_value, e.risk_score, array_remove(array_agg(DISTINCT ee.case_id), NULL) AS cases
      FROM evidence_entities ee
      JOIN entities e ON ee.entity_id = e.id
      GROUP BY ee.entity_id, e.entity_type, e.entity_value, e.risk_score
      HAVING COUNT(DISTINCT ee.case_id) >= 2
    `, []);

    for (const match of activeResult.rows) {
      const caseIds = match.cases || [];
      const alertId = `CORR-ACTIVE-${match.entity_type.replace(/\s+/g, '')}-${match.entity_id}`;
      const severity = match.risk_score === 'High' ? 'Critical' : match.risk_score === 'Medium' ? 'High' : 'Medium';

      await query(`
        INSERT INTO alerts (id, type, severity, title, description, entity_type, entity_value, cases)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE 
        SET severity = EXCLUDED.severity, cases = EXCLUDED.cases, description = EXCLUDED.description
        RETURNING *
      `, [
        alertId,
        'cross_case_correlation',
        severity,
        `Cross-Case Match: ${match.entity_type} "${match.entity_value}"`,
        `Entity ${match.entity_type} with value "${match.entity_value}" has been identified in ${caseIds.length} separate active cases. Risk Level: ${match.risk_score}. This may indicate a common threat actor or coordinated active fraud scheme.`,
        match.entity_type,
        match.entity_value,
        caseIds
      ]);

      newAlerts.push({
        type: 'Active Overlap',
        entity_type: match.entity_type,
        entity_value: match.entity_value,
        case_count: caseIds.length,
        severity
      });
    }

    // 2. Scan active entities against legacy historical database
    const historicalResult = await query(`
      SELECT ee.case_id AS active_case_id, he.case_id AS historical_case_id, he.entity_type, he.entity_value, he.risk_score
      FROM evidence_entities ee
      JOIN entities e ON ee.entity_id = e.id
      JOIN historical_entities he ON e.entity_value = he.entity_value AND e.entity_type = he.entity_type
    `, []);

    for (const match of historicalResult.rows) {
      const alertId = `CORR-HIST-${match.entity_type.replace(/\s+/g, '')}-${match.active_case_id}-${match.historical_case_id}`;
      const severity = match.risk_score === 'Critical' ? 'Critical' : match.risk_score === 'High' ? 'High' : 'Medium';

      await query(`
        INSERT INTO alerts (id, type, severity, title, description, entity_type, entity_value, cases)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE 
        SET severity = EXCLUDED.severity, cases = EXCLUDED.cases, description = EXCLUDED.description
        RETURNING *
      `, [
        alertId,
        'historical_correlation',
        severity,
        `Legacy Match: ${match.entity_type} "${match.entity_value}"`,
        `Active case entity ${match.entity_type} with value "${match.entity_value}" matches a legacy record in historical case "${match.historical_case_id}". Legacy Risk Level: ${match.risk_score}. This suggests recurrence of a past fraud ring.`,
        match.entity_type,
        match.entity_value,
        [match.active_case_id, match.historical_case_id]
      ]);

      newAlerts.push({
        type: 'Legacy Overlap',
        entity_type: match.entity_type,
        entity_value: match.entity_value,
        case_count: 2,
        severity
      });
    }

    res.json({
      success: true,
      message: `Correlation scan complete. ${newAlerts.length} alert(s) generated or updated.`,
      new_alerts: newAlerts
    });
  } catch (err) {
    console.error('[Alerts POST /run-correlation] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
