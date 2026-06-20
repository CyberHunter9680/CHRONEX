import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// GET /api/imports/historical - Retrieve all imported historical cases
router.get('/historical', async (req, res) => {
  try {
    const result = await query('SELECT * FROM historical_cases', []);
    res.json({ success: true, cases: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/imports/historical-entities - Retrieve all legacy entities
router.get('/historical-entities', async (req, res) => {
  try {
    const result = await query('SELECT * FROM historical_entities', []);
    res.json({ success: true, entities: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/imports - Bulk insert cases & legacy entities
router.post('/', async (req, res) => {
  const { cases, entities } = req.body;
  if (!cases || !Array.isArray(cases)) {
    return res.status(400).json({ success: false, error: 'cases array is required' });
  }

  try {
    const importedCases = [];
    const importedEntities = [];

    for (const c of cases) {
      const caseId = c.id || `CX-${new Date().getFullYear()}-OLD${Math.floor(1000 + Math.random() * 9000)}`;
      const result = await query(`
        INSERT INTO historical_cases (id, title, description, category, loss_amount, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE 
        SET title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category, loss_amount = EXCLUDED.loss_amount, status = EXCLUDED.status
        RETURNING *
      `, [
        caseId,
        c.title || 'Untitled Historical Case',
        c.description || '',
        c.category || 'General Fraud',
        c.loss_amount ? parseFloat(c.loss_amount) : 0.00,
        c.status || 'Closed'
      ]);
      importedCases.push(result.rows[0]);
    }

    if (entities && Array.isArray(entities)) {
      for (const ent of entities) {
        const result = await query(`
          INSERT INTO historical_entities (case_id, entity_type, entity_value, risk_score, details)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (case_id, entity_type, entity_value) DO UPDATE
          SET risk_score = EXCLUDED.risk_score, details = EXCLUDED.details
          RETURNING *
        `, [
          ent.case_id,
          ent.entity_type,
          ent.entity_value,
          ent.risk_score || 'Medium',
          ent.details || ''
        ]);
        importedEntities.push(result.rows[0]);
      }
    }

    res.json({
      success: true,
      message: `Successfully imported ${importedCases.length} cases and ${importedEntities.length} entities.`,
      cases: importedCases,
      entities: importedEntities
    });
  } catch (err) {
    console.error('[Bulk Import Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
