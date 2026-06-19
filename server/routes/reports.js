import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// ─────────────────────────────────────────
// GET /api/reports
// List all generated reports
// ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM reports ORDER BY generated_at DESC', []);
    res.json({ success: true, reports: result.rows });
  } catch (err) {
    // If reports table doesn't exist, return empty
    res.json({ success: true, reports: [] });
  }
});

// ─────────────────────────────────────────
// POST /api/reports/generate/:caseId
// Generate a comprehensive investigation dossier for a case
// ─────────────────────────────────────────
router.post('/generate/:caseId', async (req, res) => {
  try {
    const caseId = req.params.caseId;
    const { generated_by, format } = req.body;

    // 1. Fetch case details
    const caseResult = await query('SELECT * FROM cases WHERE id = $1', [caseId]);
    if (caseResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }
    const caseData = caseResult.rows[0];

    // 2. Fetch all evidence
    const evidenceResult = await query('SELECT * FROM evidence WHERE case_id = $1', [caseId]);
    const evidence = evidenceResult.rows;

    // 3. Fetch timeline events
    const timelineResult = await query('SELECT * FROM timeline_events WHERE case_id = $1', [caseId]);
    const timeline = timelineResult.rows.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // 4. Fetch entities linked to this case's evidence
    const entityLinksResult = await query(
      'SELECT DISTINCT entity_id FROM evidence_entities WHERE case_id = $1',
      [caseId]
    );
    const entityIds = entityLinksResult.rows.map(r => r.entity_id);
    
    const entities = [];
    for (const eid of entityIds) {
      const er = await query('SELECT * FROM entities WHERE id = $1', [eid]);
      if (er.rowCount > 0) entities.push(er.rows[0]);
    }

    // 5. Fetch alerts related to entities in this case
    const alertsResult = await query('SELECT * FROM alerts WHERE resolved = false', []);
    const relevantAlerts = alertsResult.rows.filter(alert => {
      try {
        const alertCases = typeof alert.cases === 'string' ? JSON.parse(alert.cases) : (alert.cases || []);
        return alertCases.includes(caseId);
      } catch { return false; }
    });

    // 6. Fetch chain of custody for all evidence
    const cocData = [];
    for (const ev of evidence) {
      const cocResult = await query('SELECT * FROM chain_of_custody WHERE evidence_id = $1', [ev.id]);
      if (cocResult.rowCount > 0) {
        cocData.push({ evidence_id: ev.id, file_name: ev.file_name, entries: cocResult.rows });
      }
    }

    // 7. Build the structured report object
    const reportId = `RPT-${caseId}-${Date.now()}`;
    const reportGeneratedAt = new Date().toISOString();

    const report = {
      report_id: reportId,
      generated_at: reportGeneratedAt,
      generated_by: generated_by || 'System',
      format: format || 'json',

      // ── HEADER ──
      header: {
        department: 'CYBER CRIME POLICE UNIT',
        platform: 'CHRONEX - Cyber Evidence Timeline & Investigation Intelligence Platform',
        report_title: `Investigation Dossier - ${caseId}`,
        classification: caseData.classification || 'CONFIDENTIAL',
        generated_at: reportGeneratedAt,
        generated_by: generated_by || 'System'
      },

      // ── CASE SUMMARY ──
      case_summary: {
        case_id: caseData.id,
        title: caseData.title,
        description: caseData.description,
        status: caseData.status,
        priority: caseData.priority,
        classification: caseData.classification,
        fir_number: caseData.fir_number,
        complaint_number: caseData.complaint_number,
        registered_at: caseData.created_at,
        assigned_officer: caseData.assigned_officer,
        assigned_cell: caseData.assigned_cell,
        loss_amount: caseData.loss_amount,
        remarks: caseData.remarks
      },

      // ── VICTIM PROFILE ──
      victim_profile: {
        name: caseData.victim_name,
        age: caseData.victim_age,
        phone: caseData.victim_phone,
        email: caseData.victim_email,
        occupation: caseData.victim_occupation,
        location: caseData.victim_location
      },

      // ── EVIDENCE INVENTORY ──
      evidence_inventory: evidence.map(ev => ({
        evidence_id: ev.id,
        file_name: ev.file_name,
        file_type: ev.file_type,
        file_size: ev.file_size,
        uploaded_by: ev.uploaded_by,
        uploaded_at: ev.uploaded_at,
        sha256_hash: ev.sha256_hash,
        ocr_confidence: ev.ocr_confidence,
        has_ocr_text: !!(ev.ocr_text && ev.ocr_text.length > 0),
        tags: ev.tags || []
      })),

      // ── ENTITY INTELLIGENCE ──
      entity_intelligence: entities.map(ent => ({
        entity_type: ent.entity_type,
        entity_value: ent.entity_value,
        risk_score: ent.risk_score,
        details: ent.details
      })),

      // ── TIMELINE ──
      timeline: timeline.map(ev => ({
        timestamp: ev.timestamp,
        title: ev.title,
        description: ev.description,
        recorded_by: ev.created_by
      })),

      // ── INTELLIGENCE ALERTS ──
      intelligence_alerts: relevantAlerts.map(alert => ({
        alert_id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        entity_type: alert.entity_type,
        entity_value: alert.entity_value,
        timestamp: alert.timestamp
      })),

      // ── CHAIN OF CUSTODY ──
      chain_of_custody: cocData,

      // ── OCR EXTRACTS ──
      ocr_extracts: evidence
        .filter(ev => ev.ocr_text && ev.ocr_text.trim().length > 0)
        .map(ev => ({
          file_name: ev.file_name,
          evidence_id: ev.id,
          confidence: ev.ocr_confidence,
          extracted_text: ev.ocr_text
        })),

      // ── STATISTICS ──
      statistics: {
        total_evidence: evidence.length,
        total_entities: entities.length,
        total_timeline_events: timeline.length,
        total_alerts: relevantAlerts.length,
        high_risk_entities: entities.filter(e => e.risk_score === 'High').length,
        evidence_with_ocr: evidence.filter(e => e.ocr_text).length
      }
    };

    res.json({ success: true, report });
  } catch (err) {
    console.error(`[Reports POST /generate/${req.params.caseId}] Error:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/reports/dashboard-stats
// Platform-wide statistics for dashboard
// ─────────────────────────────────────────
router.get('/dashboard-stats', async (req, res) => {
  try {
    const [casesResult, evidenceResult, entitiesResult, alertsResult] = await Promise.all([
      query('SELECT * FROM cases', []),
      query('SELECT COUNT(*) FROM evidence', []),
      query('SELECT * FROM entities', []),
      query('SELECT * FROM alerts', [])
    ]);

    const cases = casesResult.rows;
    const entities = entitiesResult.rows;
    const alerts = alertsResult.rows;
    const evidenceCount = parseInt(evidenceResult.rows[0]?.count || 0);

    const stats = {
      total_cases: cases.length,
      active_cases: cases.filter(c => c.status === 'Active').length,
      closed_cases: cases.filter(c => c.status === 'Closed').length,
      critical_cases: cases.filter(c => c.priority === 'Critical').length,
      total_evidence: evidenceCount,
      total_entities: entities.length,
      high_risk_entities: entities.filter(e => e.risk_score === 'High').length,
      active_alerts: alerts.filter(a => !a.resolved).length,
      critical_alerts: alerts.filter(a => a.severity === 'Critical' && !a.resolved).length,
      cases_by_status: {
        Active: cases.filter(c => c.status === 'Active').length,
        Closed: cases.filter(c => c.status === 'Closed').length,
        'Under Review': cases.filter(c => c.status === 'Under Review').length,
        Pending: cases.filter(c => c.status === 'Pending').length
      },
      cases_by_priority: {
        Critical: cases.filter(c => c.priority === 'Critical').length,
        High: cases.filter(c => c.priority === 'High').length,
        Medium: cases.filter(c => c.priority === 'Medium').length,
        Low: cases.filter(c => c.priority === 'Low').length
      },
      recent_cases: cases.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
      total_loss_amount: cases.reduce((sum, c) => sum + (parseFloat(c.loss_amount) || 0), 0)
    };

    res.json({ success: true, stats });
  } catch (err) {
    console.error('[Reports GET /dashboard-stats] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
