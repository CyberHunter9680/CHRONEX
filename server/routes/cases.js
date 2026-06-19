import express from 'express';
import { query } from '../db.js';
import crypto from 'crypto';

const router = express.Router();

// GET /api/cases - List all cases with query parameters for filtering
router.get('/', async (req, res) => {
  const { status, classification, search } = req.query;
  
  let queryString = 'SELECT * FROM cases WHERE 1=1';
  const queryParams = [];
  let paramIndex = 1;

  if (status && status !== 'All') {
    queryString += ` AND status = $${paramIndex}`;
    queryParams.push(status);
    paramIndex++;
  }

  if (classification && classification !== 'All') {
    queryString += ` AND classification = $${paramIndex}`;
    queryParams.push(classification);
    paramIndex++;
  }

  if (search) {
    queryString += ` AND (
      id ILIKE $${paramIndex} OR 
      title ILIKE $${paramIndex} OR 
      victim_name ILIKE $${paramIndex} OR
      fir_number ILIKE $${paramIndex} OR
      complaint_number ILIKE $${paramIndex}
    )`;
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  queryString += ' ORDER BY created_at DESC';

  try {
    const result = await query(queryString, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve cases' });
  }
});

// GET /api/cases/:id - Get detailed view of single case file
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM cases WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Case file not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve case details' });
  }
});

// POST /api/cases - Create new case dossier
router.post('/', async (req, res) => {
  const {
    title,
    description,
    classification,
    priority,
    victim_name,
    victim_age,
    victim_phone,
    victim_email,
    victim_occupation,
    victim_location,
    remarks,
    assigned_officer,
    fir_number,
    complaint_number,
    loss_amount
  } = req.body;

  if (!title || !victim_name) {
    return res.status(400).json({ error: 'Case Title and Victim Name are required' });
  }

  try {
    // 1. Auto-generate Case ID: CX-YYYY-XXXX (where YYYY is current year, XXXX is random 4-digit code)
    const year = new Date().getFullYear();
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const caseId = `CX-${year}-${randomCode}`;

    // 2. Generate unique SHA-256 integrity hash for case file
    const rawDataString = `${caseId}|${title}|${victim_name}|${Date.now()}`;
    const integrityHash = crypto.createHash('sha256').update(rawDataString).digest('hex');

    // 3. Construct initial note entry
    const initialNotes = [
      {
        id: `note-${Date.now()}`,
        timestamp: new Date().toISOString(),
        officer: assigned_officer || 'Inspector S. Sharma',
        text: `Case dossier registered. Assigned to Noida Cyber Cell. File secured in database under SHA-256: ${integrityHash.substring(0, 16)}...`
      }
    ];

    const insertQuery = `
      INSERT INTO cases (
        id, title, description, status, priority, classification,
        victim_name, victim_age, victim_phone, victim_email, victim_occupation, victim_location,
        remarks, assigned_officer, assigned_cell, fir_number, complaint_number, loss_amount, notes, integrity_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `;

    const result = await query(insertQuery, [
      caseId,
      title,
      description || '',
      'Open', // Status starts as 'Open'
      priority || 'Medium',
      classification,
      victim_name,
      victim_age ? parseInt(victim_age) : null,
      victim_phone || '',
      victim_email || '',
      victim_occupation || '',
      victim_location || '',
      remarks || 'Case registered.',
      assigned_officer || 'Inspector S. Sharma',
      'Noida Cyber Cell (Zone 1)',
      fir_number || '',
      complaint_number || '',
      loss_amount ? parseFloat(loss_amount) : 0.00,
      JSON.stringify(initialNotes),
      integrityHash
    ]);

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create case dossier' });
  }
});

// PUT /api/cases/:id - Update case details (remarks, status, priority, classification, notes)
router.put('/:id', async (req, res) => {
  const { status, remarks, priority, notes } = req.body;

  try {
    // Check if case exists first
    const caseCheck = await query('SELECT * FROM cases WHERE id = $1', [req.params.id]);
    if (caseCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Case dossier not found' });
    }

    const currentCase = caseCheck.rows[0];

    // Compute new SHA-256 integrity hash due to state update
    const rawDataString = `${req.params.id}|${status || currentCase.status}|${remarks || currentCase.remarks}|${Date.now()}`;
    const newIntegrityHash = crypto.createHash('sha256').update(rawDataString).digest('hex');

    let updateQuery = 'UPDATE cases SET ';
    const updateParams = [];
    let paramIndex = 1;

    if (status) {
      updateQuery += `status = $${paramIndex}, `;
      updateParams.push(status);
      paramIndex++;
    }

    if (remarks) {
      updateQuery += `remarks = $${paramIndex}, `;
      updateParams.push(remarks);
      paramIndex++;
    }

    if (priority) {
      updateQuery += `priority = $${paramIndex}, `;
      updateParams.push(priority);
      paramIndex++;
    }

    if (notes) {
      updateQuery += `notes = $${paramIndex}, `;
      updateParams.push(JSON.stringify(notes));
      paramIndex++;
    }

    // Always update integrity hash when modifying the case
    updateQuery += `integrity_hash = $${paramIndex} WHERE id = $${paramIndex + 1} RETURNING *`;
    updateParams.push(newIntegrityHash, req.params.id);

    const result = await query(updateQuery, updateParams);
    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update case dossier' });
  }
});

export default router;
