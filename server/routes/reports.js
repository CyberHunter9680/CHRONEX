import express from 'express';
import { query } from '../db.js';
import { authenticateToken, restrictCaseAccess, requireApprovedCase } from '../middlewares/authMiddleware.js';

const router = express.Router();


// GET /api/reports
// List all generated reports
// ─────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM reports ORDER BY generated_at DESC', []);
    let rows = result.rows;
    if (!['SP', 'SUPER ADMIN', 'CYBER CELL INCHARGE'].includes(req.user.role)) {
      // Filter by assigned cases
      const casesRes = await query('SELECT * FROM cases WHERE 1=1');
      const assignedCaseIds = casesRes.rows
        .filter(c => c.assigned_officer === req.user.name || c.assigned_officer === req.user.username)
        .map(c => c.id);
      rows = rows.filter(r => assignedCaseIds.includes(r.case_id));
    }
    res.json({ success: true, reports: rows });
  } catch (err) {
    res.json({ success: true, reports: [] });
  }
});

// ─────────────────────────────────────────
// POST /api/reports/generate/:caseId
// Generate a comprehensive investigation dossier for a case
// ─────────────────────────────────────────
router.post('/generate/:caseId', authenticateToken, restrictCaseAccess, requireApprovedCase, async (req, res) => {
  try {
    const caseId = req.params.caseId;
    const generatedBy = req.user.name || req.user.username || 'System';
    const { format } = req.body;

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
      generated_by: generatedBy || 'System',
      format: format || 'json',

      // ── HEADER ──
      header: {
        department: 'CYBER CRIME POLICE UNIT',
        platform: 'CHRONEX - Cyber Evidence Timeline & Investigation Intelligence Platform',
        report_title: `Investigation Dossier - ${caseId}`,
        classification: caseData.classification || 'CONFIDENTIAL',
        generated_at: reportGeneratedAt,
        generated_by: generatedBy || 'System'
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

// GET /api/reports/dashboard-stats
// Platform-wide statistics for dashboard
// ─────────────────────────────────────────
router.get('/dashboard-stats', authenticateToken, async (req, res) => {
  try {
    // Fetch raw data
    const casesRes = await query('SELECT * FROM cases WHERE 1=1');
    const evidenceRes = await query('SELECT * FROM evidence ORDER BY uploaded_at DESC');
    const entitiesRes = await query('SELECT * FROM entities');
    const alertsRes = await query('SELECT * FROM alerts');

    let cases = casesRes.rows;
    let evidence = evidenceRes.rows;
    let entities = entitiesRes.rows;
    let alerts = alertsRes.rows;

    // Filter by role if not SP/Admin/Incharge
    const isSPOrAdmin = ['SP', 'SUPER ADMIN', 'CYBER CELL INCHARGE'].includes(req.user.role);
    if (!isSPOrAdmin) {
      cases = cases.filter(c => c.assigned_officer === req.user.name || c.assigned_officer === req.user.username);
      const caseIds = cases.map(c => c.id);
      evidence = evidence.filter(e => caseIds.includes(e.case_id));
      
      // Filter alerts based on active case IDs
      alerts = alerts.filter(a => {
        try {
          const alertCases = typeof a.cases === 'string' ? JSON.parse(a.cases) : (a.cases || []);
          return alertCases.some(id => caseIds.includes(id));
        } catch { return false; }
      });
      
      // Filter entities: only entities associated with the user's cases' evidence
      const eeRes = await query('SELECT * FROM evidence_entities');
      const linkedEntityIds = eeRes.rows
        .filter(link => caseIds.includes(link.case_id))
        .map(link => link.entity_id);
      
      entities = entities.filter(ent => linkedEntityIds.includes(ent.id));
    }

    // Now calculate stats on the filtered arrays
    const total_cases = cases.length;
    const active_cases = cases.filter(c => c.status === 'Active' || c.status === 'Under Investigation' || c.status === 'Open').length;
    const closed_cases = cases.filter(c => c.status === 'Closed').length;
    const critical_cases = cases.filter(c => c.priority === 'Critical').length;
    const total_loss_amount = cases.reduce((sum, c) => sum + (parseFloat(c.loss_amount) || 0), 0);

    const total_entities = entities.length;
    const high_risk_entities = entities.filter(e => e.risk_score === 'High' || e.risk_score === 'Critical').length;

    const active_alerts = alerts.filter(a => !a.resolved).length;
    const critical_alerts = alerts.filter(a => !a.resolved && a.severity === 'Critical').length;

    const cases_by_status = { Active: 0, Closed: 0, 'Under Review': 0, Pending: 0, 'Under Investigation': 0, 'Pending Approval': 0, 'Rejected': 0, 'Pending Clarification': 0 };
    cases.forEach(c => {
      cases_by_status[c.status] = (cases_by_status[c.status] || 0) + 1;
    });

    const cases_by_priority = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    cases.forEach(c => {
      cases_by_priority[c.priority] = (cases_by_priority[c.priority] || 0) + 1;
    });

    // Sort recent cases by created_at desc, limit 5
    const recent_cases = [...cases]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    const stats = {
      total_cases,
      active_cases,
      closed_cases,
      critical_cases,
      total_evidence: evidence.length,
      total_entities,
      high_risk_entities,
      active_alerts,
      critical_alerts,
      cases_by_status,
      cases_by_priority,
      recent_cases,
      total_loss_amount
    };

    res.json({ success: true, stats });
  } catch (err) {
    console.error('[Reports GET /dashboard-stats] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
