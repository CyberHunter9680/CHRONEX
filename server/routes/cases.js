import express from 'express';
import { query } from '../db.js';
import crypto from 'crypto';
import { authenticateToken, requireRole, restrictCaseAccess, requireApprovedCase } from '../middlewares/authMiddleware.js';

const router = express.Router();

// GET /api/cases - List all cases with query parameters for filtering
router.get('/', authenticateToken, async (req, res) => {
  const { status, classification, search } = req.query;
  
  let queryString = 'SELECT * FROM cases WHERE 1=1';
  const queryParams = [];
  let paramIndex = 1;

  // Filter based on role: IO/ReadOnly only see their assigned cases
  if (req.user.role === 'INVESTIGATION OFFICER' || req.user.role === 'READ ONLY VIEWER') {
    queryString += ` AND (assigned_officer = $${paramIndex} OR assigned_officer = $${paramIndex + 1})`;
    queryParams.push(req.user.name, req.user.username);
    paramIndex += 2;
  }

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
router.get('/:id', authenticateToken, restrictCaseAccess, async (req, res) => {
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
router.post('/', authenticateToken, async (req, res) => {
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

    const officerName = assigned_officer || req.user.name || req.user.username || 'Inspector S. Sharma';

    // 3. Construct initial note entry
    const initialNotes = [
      {
        id: `note-${Date.now()}`,
        timestamp: new Date().toISOString(),
        officer: officerName,
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
      'Pending Approval', // Status starts as 'Pending Approval'
      priority || 'Medium',
      classification,
      victim_name,
      victim_age ? parseInt(victim_age) : null,
      victim_phone || '',
      victim_email || '',
      victim_occupation || '',
      victim_location || '',
      remarks || 'Case registered.',
      officerName,
      'Noida Cyber Cell (Zone 1)',
      fir_number || '',
      complaint_number || '',
      loss_amount ? parseFloat(loss_amount) : 0.00,
      JSON.stringify(initialNotes),
      integrityHash
    ]);

    const insertedCase = result.rows[0];

    // 4. Populate the separate victims table
    await query(`
      INSERT INTO victims (case_id, name, mobile, email, address)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      caseId,
      victim_name,
      victim_phone || '',
      victim_email || '',
      victim_location || ''
    ]);

    res.status(201).json(insertedCase);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create case dossier' });
  }
});

// PUT /api/cases/:id - Update case details (remarks, status, priority, classification, notes)
router.put('/:id', authenticateToken, restrictCaseAccess, requireApprovedCase, async (req, res) => {
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

// GET /api/cases/:id/notes - Get persistent notes for a case
router.get('/:id/notes', authenticateToken, restrictCaseAccess, async (req, res) => {
  try {
    const result = await query('SELECT * FROM investigation_notes WHERE case_id = $1 ORDER BY timestamp DESC', [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve notes' });
  }
});

// POST /api/cases/:id/notes - Add a note to a case
router.post('/:id/notes', authenticateToken, restrictCaseAccess, requireApprovedCase, async (req, res) => {
  const { officer, note_text } = req.body;
  if (!note_text) {
    return res.status(400).json({ error: 'Note text is required' });
  }
  try {
    const result = await query(`
      INSERT INTO investigation_notes (case_id, officer, note_text)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [req.params.id, officer || req.user.name || req.user.username || 'Inspector S. Sharma', note_text]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

// POST /api/cases/:id/ai-summary - Generate AI summary for a case
router.post('/:id/ai-summary', authenticateToken, restrictCaseAccess, requireApprovedCase, async (req, res) => {
  try {
    const caseId = req.params.id;
    // 1. Fetch case details
    const caseRes = await query('SELECT * FROM cases WHERE id = $1', [caseId]);
    if (caseRes.rowCount === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    const caseData = caseRes.rows[0];

    // 2. Fetch evidence
    const evidenceRes = await query('SELECT * FROM evidence WHERE case_id = $1', [caseId]);
    const evidence = evidenceRes.rows;

    // 3. Fetch timeline events
    const timelineRes = await query('SELECT * FROM timeline_events WHERE case_id = $1', [caseId]);
    const timeline = timelineRes.rows;

    // 4. Fetch alerts
    const alertsRes = await query('SELECT * FROM alerts', []);
    const alerts = alertsRes.rows.filter(a => a.cases && a.cases.includes(caseId));

    // 5. Build summary strings
    const execSummary = `This dossier covers the investigation of "${caseData.title}", classified as "${caseData.classification}" with a recorded financial loss of ₹${parseFloat(caseData.loss_amount || 0).toLocaleString('en-IN')}. The case currently holds a "${caseData.priority}" priority status and is assigned to ${caseData.assigned_officer} of the Noida Cyber Cell (Zone 1). Registration details show FIR number: "${caseData.fir_number || 'N/A'}" and National Cyber Portal Complaint: "${caseData.complaint_number || 'N/A'}".`;

    const keyFindings = [];
    if (evidence.length > 0) {
      keyFindings.push(`Analyzed ${evidence.length} evidence artifacts in the Evidence Locker. Digital materials include files like ${evidence.map(e => `"${e.file_name}"`).slice(0, 3).join(', ')}.`);
      
      const upis = [];
      const phones = [];
      evidence.forEach(e => {
        if (e.ocr_text) {
          const upiMatches = e.ocr_text.match(/[a-zA-Z0-9.\-_]+@[a-zA-Z]+/g) || [];
          const phoneMatches = e.ocr_text.match(/\+91\s?\d{5}\s?\d{5}|\b\d{10}\b/g) || [];
          upis.push(...upiMatches);
          phones.push(...phoneMatches);
        }
      });
      const uniqueUpis = [...new Set(upis)];
      const uniquePhones = [...new Set(phones)];
      if (uniqueUpis.length > 0) {
        keyFindings.push(`OCR extraction identified suspicious UPI addresses: ${uniqueUpis.map(u => `"${u}"`).join(', ')}.`);
      }
      if (uniquePhones.length > 0) {
        keyFindings.push(`Extracted potential suspect telephone/VoIP connections: ${uniquePhones.join(', ')}.`);
      }
    } else {
      keyFindings.push('No forensic evidence packages have been attached to this dossier yet. Upload evidence receipt files to initiate OCR scanning.');
    }

    if (alerts.length > 0) {
      keyFindings.push(`Threat Matrix scanner triggered ${alerts.length} alert(s) for this case: ${alerts.map(a => `"${a.title}"`).join(', ')}.`);
    } else {
      keyFindings.push('No duplicate suspect profiles or overlapping credentials detected across other active cases.');
    }

    const recommendations = [
      `Issue formal Section 91 CrPC notice to nodal officers of linked banking networks to retrieve KYC registry for suspect transactions.`,
      `Execute IP tower geolocation query on suspect VoIP network routers logged in chat receipts.`,
      `Cross-reference intelligence indicator list against the legacy historical cases directory using Threat Matrix scans.`
    ];

    res.json({
      success: true,
      caseId,
      summary: {
        executiveSummary: execSummary,
        keyFindings,
        recommendations
      }
    });

  } catch (err) {
    console.error('[AI Summary Generation Error]:', err.message);
    res.status(500).json({ error: 'Failed to generate AI summary' });
  }
});

// PATCH /api/cases/:id/approve - Approve, reject, or request clarification on a case (SP only)
router.patch('/:id/approve', authenticateToken, requireRole(['SP']), async (req, res) => {
  const { action, remarks } = req.body;
  const caseId = req.params.id;

  if (!action || !['approve', 'reject', 'clarify'].includes(action.toLowerCase())) {
    return res.status(400).json({ success: false, error: 'Valid action (approve, reject, clarify) is required.' });
  }

  let status;
  let actionLog;
  if (action.toLowerCase() === 'approve') {
    status = 'Under Investigation';
    actionLog = 'Approved Case';
  } else if (action.toLowerCase() === 'reject') {
    status = 'Rejected';
    actionLog = 'Rejected Case';
  } else {
    status = 'Pending Clarification';
    actionLog = 'Requested Case Clarification';
  }

  try {
    const caseCheck = await query('SELECT * FROM cases WHERE id = $1', [caseId]);
    if (caseCheck.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Case dossier not found' });
    }

    // Compute new SHA-256 integrity hash due to state update
    const rawDataString = `${caseId}|${status}|${remarks || ''}|${Date.now()}`;
    const newIntegrityHash = crypto.createHash('sha256').update(rawDataString).digest('hex');

    const currentCase = caseCheck.rows[0];
    let notes = [];
    try {
      notes = typeof currentCase.notes === 'string' ? JSON.parse(currentCase.notes) : (currentCase.notes || []);
    } catch (e) {
      notes = [];
    }

    notes.push({
      id: `note-${Date.now()}`,
      timestamp: new Date().toISOString(),
      officer: req.user.name || req.user.username,
      text: `${actionLog} with remarks: "${remarks || 'None'}". Database SHA-256 hash updated: ${newIntegrityHash.substring(0, 16)}...`
    });

    // Update case status, approval_remarks, notes, and integrity_hash
    const updateRes = await query(`
      UPDATE cases
      SET status = $1, approval_remarks = $2, notes = $3, integrity_hash = $4
      WHERE id = $5
      RETURNING *
    `, [status, remarks || '', JSON.stringify(notes), newIntegrityHash, caseId]);

    // Log to security audit log
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const device = req.headers['user-agent'] || 'Web Console Client';
    await query(
      'INSERT INTO audit_logs (username, role, device, action, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.username, req.user.role, device, `${actionLog} - ${caseId}`, ip]
    );

    res.json({ success: true, case: updateRes.rows[0] });
  } catch (err) {
    console.error('[Case Approval Error]:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update case approval status.' });
  }
});

export default router;

