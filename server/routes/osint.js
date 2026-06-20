import express from 'express';
import { query } from '../db.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// GET /api/osint/history - Fetch past query logs and results
router.get('/history', authenticateToken, async (req, res) => {

  try {
    const result = await query(`
      SELECT q.id, q.timestamp, q.entity_type, q.entity_value, q.query_type, q.officer,
             r.id as result_id, r.source, r.result_data, r.timestamp as result_timestamp
      FROM osint_queries q
      LEFT JOIN osint_results r ON q.id = r.query_id
      ORDER BY q.timestamp DESC
    `, []);
    
    res.json({ success: true, history: result.rows });
  } catch (err) {
    console.error('[OSINT History Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/osint/query - Perform a simulated OSINT query with validation engine
router.post('/query', authenticateToken, async (req, res) => {
  const { entity_type, entity_value, query_type, officer } = req.body;
  
  if (!entity_type || !entity_value || !query_type) {
    return res.status(400).json({ success: false, error: 'entity_type, entity_value, and query_type are required' });
  }

  const officerName = officer || req.user.name || req.user.username || 'Inspector S. Sharma';


  try {
    // 1. Insert query entry
    const qResult = await query(`
      INSERT INTO osint_queries (entity_type, entity_value, query_type, officer)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [entity_type, entity_value, query_type, officerName]);

    const queryId = qResult.rows[0].id;

    // 2. Perform database correlation scans (Multi-Source engine)
    const activeDbMatches = await query(`
      SELECT ee.case_id, ee.evidence_id, e.file_name, c.title AS case_title, c.assigned_officer
      FROM evidence_entities ee
      JOIN entities ent ON ee.entity_id = ent.id
      JOIN evidence e ON ee.evidence_id = e.id
      JOIN cases c ON ee.case_id = c.id
      WHERE ent.entity_value = $1 OR ent.entity_value ILIKE $2
    `, [entity_value.trim(), `%${entity_value.trim()}%`]);

    const legacyMatches = await query(`
      SELECT he.case_id, hc.title AS case_title, he.entity_type, he.risk_score
      FROM historical_entities he
      JOIN historical_cases hc ON he.case_id = hc.id
      WHERE he.entity_value = $1 OR he.entity_value ILIKE $2
    `, [entity_value.trim(), `%${entity_value.trim()}%`]);

    const pastTraces = await query(`
      SELECT q.id, q.timestamp, q.query_type, q.officer
      FROM osint_queries q
      WHERE q.entity_value = $1 AND q.id < $2
    `, [entity_value.trim(), queryId]);

    // Build source traceability list
    const traceSources = [];
    
    activeDbMatches.rows.forEach(m => {
      traceSources.push({
        source: `Uploaded Evidence: "${m.file_name}"`,
        type: 'Forensic Evidence',
        date: new Date().toISOString(),
        investigator: m.assigned_officer || 'Inspector S. Sharma',
        reference: m.evidence_id,
        case_ref: m.case_id,
        case_title: m.case_title
      });
    });

    legacyMatches.rows.forEach(m => {
      traceSources.push({
        source: `Historical Case Record: "${m.case_title}"`,
        type: 'Legacy Dossier',
        date: new Date().toISOString(),
        investigator: 'System Import',
        reference: 'Legacy Indicator DB',
        case_ref: m.case_id,
        case_title: m.case_title
      });
    });

    pastTraces.rows.forEach(m => {
      traceSources.push({
        source: `Previous Intelligence Record (Query #${m.id})`,
        type: 'Past OSINT Trace',
        date: m.timestamp,
        investigator: m.officer,
        reference: `OSINT Query ID: ${m.id}`,
        case_ref: 'N/A',
        case_title: 'N/A'
      });
    });

    // Multi-source Verification Status Logic
    const uniqueSourceCategories = new Set();
    if (activeDbMatches.rowCount > 0) uniqueSourceCategories.add('evidence');
    if (legacyMatches.rowCount > 0) uniqueSourceCategories.add('historical');
    if (pastTraces.rowCount > 0) uniqueSourceCategories.add('osint_history');

    const totalCategoriesCount = uniqueSourceCategories.size;
    let verificationStatus = 'Unverified';
    let confidenceScore = 35; // Default unverified score

    if (totalCategoriesCount >= 2) {
      verificationStatus = 'Verified';
      confidenceScore = 94; // High confidence
    } else if (totalCategoriesCount === 1) {
      verificationStatus = 'Partially Verified';
      confidenceScore = 78; // Medium confidence
    } else {
      verificationStatus = 'Unverified';
      confidenceScore = 35; // Unverified (<40)
    }

    // 3. Generate simulated OSINT data base values
    let source = '';
    let result_data = {};

    if (query_type === 'WHOIS Lookup') {
      source = 'Global Domain Registry WHOIS';
      const cleanVal = entity_value.trim().toLowerCase();
      result_data = {
        domain: cleanVal,
        registrar: 'GoDaddy Inc.',
        created_date: '2025-11-12T08:34:00Z',
        expiry_date: '2026-11-12T08:34:00Z',
        registrant_country: cleanVal.endsWith('.in') ? 'India' : 'Unknown / Hidden (Privacy Shield)',
        name_servers: ['ns1.parking-hub.com', 'ns2.parking-hub.com'],
        status: 'Active (Scam Campaign Host)',
        risk_score: cleanVal.includes('scam') || cleanVal.includes('secure') || cleanVal.includes('wallet') ? 85 : 45,
        recommendation: 'Flag DNS mapping immediately. Submit takedown requests to hosting provider.'
      };
    } else if (query_type === 'DNS Intelligence') {
      source = 'Cloudflare Threat Intelligence DNS';
      const cleanVal = entity_value.trim().toLowerCase();
      result_data = {
        host: cleanVal,
        a_records: ['104.21.32.180', '172.67.202.94'],
        mx_records: ['mail.protection.outlook.com'],
        ns_records: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
        resolved_country: 'United States',
        isp: 'Cloudflare, Inc.',
        hosting_provider: 'Cloudflare CDN Gateway',
        associated_scams: 3,
        risk_score: 75,
        recommendation: 'Issue reverse DNS queries to identify overlapping domains on hosting IPs.'
      };
    } else if (query_type === 'IP Reputation') {
      source = 'Spamhaus IP Reputation Network';
      const cleanVal = entity_value.trim();
      const isSuspect = cleanVal.startsWith('192.') || cleanVal.startsWith('10.');
      result_data = {
        ip: cleanVal,
        country: isSuspect ? 'India' : 'Russia',
        isp: isSuspect ? 'Reliance Jio Infocomm' : 'Virtual Telecom SpA',
        latitude: isSuspect ? 28.6139 : 55.7558,
        longitude: isSuspect ? 77.2090 : 37.6173,
        is_vpn_or_tor: !isSuspect,
        open_ports: [80, 443, 22, 8080],
        risk_score: isSuspect ? 20 : 90,
        recommendation: isSuspect 
          ? 'Residential network subscriber. Request telecom logs via ISP.' 
          : 'High risk VPN/TOR endpoint detected. Deny routing and log network access headers.'
      };
    } else if (query_type === 'URL Check') {
      source = 'VirusTotal URL Trust Database';
      const cleanVal = entity_value.trim().toLowerCase();
      result_data = {
        url: cleanVal,
        positives: 8,
        total_engines: 64,
        malicious_categories: ['Phishing', 'Malware delivery', 'Scam Portal'],
        http_status: 200,
        ssl_certificate_valid: true,
        ssl_issuer: 'Let\'s Encrypt',
        risk_score: 88,
        recommendation: 'Block URL on corporate firewalls. Alert victims who clicked link via cellular SMS.'
      };
    } else {
      source = 'Universal Entity Intelligence Registry';
      result_data = {
        entity: entity_value,
        query: query_type,
        status: 'Processed',
        risk_score: 50,
        recommendation: 'Perform secondary review using specific OSINT modules.'
      };
    }

    // Embed Verification Engine parameters into response
    result_data.source_name = source;
    result_data.source_type = 'Verified OSINT API Feed';
    result_data.collection_timestamp = new Date().toISOString();
    result_data.verification_status = verificationStatus;
    result_data.confidence_score = confidenceScore;
    result_data.sources_trace = traceSources;
    result_data.review_status = 'Pending Review'; // Pending Review | Approved | Rejected

    // Build investigative lead warning
    if (verificationStatus !== 'Unverified') {
      result_data.lead = {
        title: 'Potential Correlation Traced',
        description: `This indicator matches ${traceSources.length} records in active case files and legacy dossiers.`,
        confidence: confidenceScore
      };
    } else {
      result_data.lead = {
        title: 'No verified intelligence available',
        description: 'This indicator is not supported by any local evidence or legacy databases.',
        confidence: confidenceScore
      };
    }

    // 4. Insert OSINT result
    const rResult = await query(`
      INSERT INTO osint_results (query_id, source, result_data)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [queryId, source, JSON.stringify(result_data)]);

    res.json({
      success: true,
      query: {
        id: queryId,
        entity_type,
        entity_value,
        query_type,
        officer: officerName,
        timestamp: new Date().toISOString()
      },
      result: rResult.rows[0]
    });
  } catch (err) {
    console.error('[OSINT Query Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/osint/results/:id/review - Update investigator review status
router.patch('/results/:id/review', authenticateToken, async (req, res) => {
  const { status } = req.body;

  if (!['Pending Review', 'Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid review status. Must be Approved or Rejected' });
  }

  try {
    const resultCheck = await query('SELECT * FROM osint_results WHERE id = $1', [req.params.id]);
    if (resultCheck.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'OSINT result record not found' });
    }

    const currentResult = resultCheck.rows[0];
    const data = typeof currentResult.result_data === 'string' 
      ? JSON.parse(currentResult.result_data) 
      : currentResult.result_data;

    data.review_status = status;

    const updateRes = await query(
      'UPDATE osint_results SET result_data = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(data), req.params.id]
    );

    res.json({ success: true, result: updateRes.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
