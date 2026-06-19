import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// ─────────────────────────────────────────
// GET /api/entities
// List all entities with optional search
// ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, type, risk } = req.query;
    
    let sql = 'SELECT * FROM entities WHERE 1=1';
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (entity_value ILIKE $${params.length} OR entity_type ILIKE $${params.length})`;
    }
    if (type) {
      params.push(type);
      sql += ` AND entity_type = $${params.length}`;
    }
    if (risk) {
      params.push(risk);
      sql += ` AND risk_score = $${params.length}`;
    }

    sql += ' ORDER BY entity_type, entity_value';

    const result = await query(sql, params);

    // For each entity, get the cases it appears in
    const enriched = await Promise.all(result.rows.map(async (entity) => {
      const linksResult = await query(
        'SELECT DISTINCT case_id FROM evidence_entities WHERE entity_id = $1',
        [entity.id]
      );
      return {
        ...entity,
        case_ids: linksResult.rows.map(r => r.case_id),
        occurrence_count: linksResult.rowCount
      };
    }));

    res.json({ success: true, entities: enriched, total: enriched.length });
  } catch (err) {
    console.error('[Entities GET /] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/entities/:id
// Get entity with all related evidence and cases
// ─────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const entityResult = await query(
      'SELECT * FROM entities WHERE id = $1',
      [req.params.id]
    );

    if (entityResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Entity not found' });
    }

    const entity = entityResult.rows[0];

    // Get linked cases and evidence
    const linksResult = await query(
      'SELECT * FROM evidence_entities WHERE entity_id = $1',
      [entity.id]
    );

    const caseIds = [...new Set(linksResult.rows.map(l => l.case_id))];
    const evidenceIds = linksResult.rows.map(l => l.evidence_id);

    res.json({
      success: true,
      entity: {
        ...entity,
        linked_case_ids: caseIds,
        linked_evidence_ids: evidenceIds,
        occurrence_count: linksResult.rowCount
      }
    });
  } catch (err) {
    console.error(`[Entities GET /${req.params.id}] Error:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/entities
// Manually add or update an entity
// ─────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { entity_type, entity_value, risk_score, details } = req.body;

    if (!entity_type || !entity_value) {
      return res.status(400).json({ success: false, error: 'entity_type and entity_value are required' });
    }

    // Upsert: insert or update if exists
    const existResult = await query(
      'SELECT * FROM entities WHERE entity_type = $1 AND entity_value = $2',
      [entity_type, entity_value]
    );

    let entity;
    if (existResult.rowCount > 0) {
      // Update
      const updateResult = await query(
        'UPDATE entities SET risk_score = $1, details = $2 WHERE entity_type = $3 AND entity_value = $4 RETURNING *',
        [risk_score || existResult.rows[0].risk_score, details || existResult.rows[0].details, entity_type, entity_value]
      );
      entity = updateResult.rows[0];
    } else {
      // Insert
      const insertResult = await query(
        'INSERT INTO entities (entity_type, entity_value, risk_score, details) VALUES ($1, $2, $3, $4) RETURNING *',
        [entity_type, entity_value, risk_score || 'Medium', details || '']
      );
      entity = insertResult.rows[0];
    }

    res.json({ success: true, entity });
  } catch (err) {
    console.error('[Entities POST /] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// PUT /api/entities/:id
// Update entity risk score or details
// ─────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { risk_score, details } = req.body;

    const result = await query(
      'UPDATE entities SET risk_score = $1, details = $2 WHERE id = $3 RETURNING *',
      [risk_score, details, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Entity not found' });
    }

    res.json({ success: true, entity: result.rows[0] });
  } catch (err) {
    console.error(`[Entities PUT /${req.params.id}] Error:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/entities/stats/summary
// Entity statistics for the intelligence dashboard
// ─────────────────────────────────────────
router.get('/stats/summary', async (req, res) => {
  try {
    const entitiesResult = await query('SELECT * FROM entities', []);
    const entities = entitiesResult.rows;

    const stats = {
      total: entities.length,
      by_type: {},
      by_risk: { High: 0, Medium: 0, Low: 0 },
      high_risk_entities: entities.filter(e => e.risk_score === 'High').slice(0, 10)
    };

    for (const entity of entities) {
      stats.by_type[entity.entity_type] = (stats.by_type[entity.entity_type] || 0) + 1;
      if (stats.by_risk[entity.risk_score] !== undefined) {
        stats.by_risk[entity.risk_score]++;
      }
    }

    res.json({ success: true, stats });
  } catch (err) {
    console.error('[Entities GET /stats/summary] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
