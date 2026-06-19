import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// ─────────────────────────────────────────
// GET /api/timeline/:caseId
// Get all timeline events for a case (sorted asc)
// ─────────────────────────────────────────
router.get('/:caseId', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM timeline_events WHERE case_id = $1',
      [req.params.caseId]
    );

    res.json({ success: true, events: result.rows, total: result.rowCount });
  } catch (err) {
    console.error(`[Timeline GET /${req.params.caseId}] Error:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/timeline/:caseId
// Add a manual timeline event to a case
// ─────────────────────────────────────────
router.post('/:caseId', async (req, res) => {
  try {
    const { timestamp, title, description, created_by, event_type } = req.body;

    if (!title || !timestamp) {
      return res.status(400).json({ success: false, error: 'title and timestamp are required' });
    }

    // Validate case exists
    const caseResult = await query('SELECT * FROM cases WHERE id = $1', [req.params.caseId]);
    if (caseResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }

    const result = await query(
      'INSERT INTO timeline_events (case_id, timestamp, title, description, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.params.caseId, timestamp, title, description || '', created_by || 'System', event_type || 'manual']
    );

    res.json({ success: true, event: result.rows[0] });
  } catch (err) {
    console.error(`[Timeline POST /${req.params.caseId}] Error:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/timeline/:caseId/reconstruct
// Auto-reconstruct timeline from evidence OCR + entities
// ─────────────────────────────────────────
router.post('/:caseId/reconstruct', async (req, res) => {
  try {
    const caseId = req.params.caseId;
    
    // Validate case exists
    const caseResult = await query('SELECT * FROM cases WHERE id = $1', [caseId]);
    if (caseResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }
    const caseData = caseResult.rows[0];

    // Get all evidence for this case
    const evidenceResult = await query('SELECT * FROM evidence WHERE case_id = $1', [caseId]);
    const evidenceList = evidenceResult.rows;

    const generatedEvents = [];

    // Event 1: Case registration
    generatedEvents.push({
      case_id: caseId,
      timestamp: caseData.created_at,
      title: 'Case Registered',
      description: `Case ${caseId} was officially registered. FIR: ${caseData.fir_number || 'N/A'}, Complaint: ${caseData.complaint_number || 'N/A'}.`,
      created_by: 'System'
    });

    // For each evidence item, extract temporal events from OCR text
    for (const evidence of evidenceList) {
      // Evidence upload event
      generatedEvents.push({
        case_id: caseId,
        timestamp: evidence.uploaded_at || new Date().toISOString(),
        title: `Evidence Collected: ${evidence.file_name}`,
        description: `Digital evidence "${evidence.file_name}" (${formatBytes(evidence.file_size)}) was collected and ingested into the system. SHA-256: ${(evidence.sha256_hash || '').substring(0, 16)}...`,
        created_by: evidence.uploaded_by || 'System'
      });

      // Extract dates from OCR text if available
      if (evidence.ocr_text) {
        const datePatterns = [
          /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g,
          /\b(\d{4}-\d{2}-\d{2})\b/g,
          /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}\b/gi,
          /\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}\b/gi
        ];

        const foundDates = new Set();
        for (const pattern of datePatterns) {
          const matches = evidence.ocr_text.match(pattern) || [];
          matches.forEach(d => foundDates.add(d));
        }

        // Create an event for first meaningful date found in OCR text
        if (foundDates.size > 0) {
          const dateList = [...foundDates].slice(0, 2);
          const snip = evidence.ocr_text.substring(0, 150).replace(/\n/g, ' ').trim();
          generatedEvents.push({
            case_id: caseId,
            timestamp: new Date().toISOString(),
            title: `Temporal Reference Extracted from ${evidence.file_name}`,
            description: `Dates found in document: ${dateList.join(', ')}. Excerpt: "${snip}..."`,
            created_by: 'OCR Engine'
          });
        }
      }
    }

    // Sort events by timestamp
    generatedEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Persist all generated events to the DB
    const insertedEvents = [];
    for (const event of generatedEvents) {
      const result = await query(
        'INSERT INTO timeline_events (case_id, timestamp, title, description, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [event.case_id, event.timestamp, event.title, event.description, event.created_by]
      );
      insertedEvents.push(result.rows[0]);
    }

    res.json({
      success: true,
      message: `Timeline reconstructed: ${insertedEvents.length} events generated.`,
      events: insertedEvents
    });
  } catch (err) {
    console.error(`[Timeline POST /${req.params.caseId}/reconstruct] Error:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// DELETE /api/timeline/:caseId/:eventId
// Remove a timeline event
// ─────────────────────────────────────────
router.delete('/:caseId/:eventId', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM timeline_events WHERE id = $1 AND case_id = $2 RETURNING *',
      [req.params.eventId, req.params.caseId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    res.json({ success: true, message: 'Timeline event deleted.' });
  } catch (err) {
    console.error('[Timeline DELETE] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

export default router;
