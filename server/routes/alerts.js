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
    const entitiesResult = await query('SELECT * FROM entities', []);
    const entities = entitiesResult.rows;

    const newAlerts = [];

    for (const entity of entities) {
      // Find all cases linked to this entity
      const linksResult = await query(
        'SELECT DISTINCT case_id FROM evidence_entities WHERE entity_id = $1',
        [entity.id]
      );

      const caseIds = linksResult.rows.map(r => r.case_id);

      if (caseIds.length >= 2) {
        // This entity appears in multiple cases → Generate correlation alert
        const alertId = `CORR-${entity.entity_type}-${entity.id}`;
        const severity = entity.risk_score === 'High' ? 'Critical' : entity.risk_score === 'Medium' ? 'High' : 'Medium';

        await query(
          'INSERT INTO alerts (id, type, severity, title, description, entity_type, entity_value, cases) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
          [
            alertId,
            'cross_case_correlation',
            severity,
            `Cross-Case Match: ${entity.entity_type} "${entity.entity_value}"`,
            `Entity ${entity.entity_type} with value "${entity.entity_value}" has been identified in ${caseIds.length} separate cases. Risk Level: ${entity.risk_score}. This may indicate a common threat actor or coordinated fraud scheme.`,
            entity.entity_type,
            entity.entity_value,
            JSON.stringify(caseIds)
          ]
        );

        newAlerts.push({
          entity_type: entity.entity_type,
          entity_value: entity.entity_value,
          case_count: caseIds.length,
          severity
        });
      }
    }

    res.json({
      success: true,
      message: `Correlation scan complete. ${newAlerts.length} alert(s) generated.`,
      new_alerts: newAlerts
    });
  } catch (err) {
    console.error('[Alerts POST /run-correlation] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
