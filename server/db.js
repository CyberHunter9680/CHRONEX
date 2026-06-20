import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Define directories for JSON store fallback
const STORE_DIR = path.join(process.cwd(), 'db_store');

// Keep in-memory tables when falling back
let usePostgres = true;
let pool = null;

// Initial connection test
try {
  pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'chronex'
  });
  
  // Test connection
  await pool.query('SELECT 1');
  console.log('✅ [CHRONEX DB] Connected to PostgreSQL database successfully.');
} catch (err) {
  usePostgres = false;
  console.warn('\n⚠️  [CHRONEX DATABASE WARNING]');
  console.warn('Could not connect to PostgreSQL database.');
  console.warn('Falling back to local persistent JSON file store in: ' + STORE_DIR);
  console.warn('All data will be permanently saved and indexed in the file system.\n');
  
  // Ensure storage folder exists
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

// ────────────────────────────────────────────────────────────────
// JSON STORE DB IMPLEMENTATION (FALLBACK DRIVER)
// ────────────────────────────────────────────────────────────────

const getFileStorePath = (table) => path.join(STORE_DIR, `${table}.json`);

const readStore = (table) => {
  const filePath = getFileStorePath(table);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error(`Error reading store ${table}:`, err.message);
    return [];
  }
};

const writeStore = (table, data) => {
  const filePath = getFileStorePath(table);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing store ${table}:`, err.message);
  }
};

// Simple Mock SQL Parser for fallback store
const queryJsonStore = (text, params = []) => {
  const sql = text.trim().replace(/\s+/g, ' ');
  
  // Helper for matching params (e.g. $1, $2)
  const getParam = (idxStr) => {
    const idx = parseInt(idxStr.substring(1)) - 1;
    return params[idx];
  };

  // 1. SELECT AUDIT LOGS
  if (sql.startsWith('SELECT * FROM audit_logs')) {
    const logs = readStore('audit_logs');
    // sort by timestamp desc
    const sorted = [...logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return { rows: sorted.slice(0, 200), rowCount: sorted.length };
  }

  // 2. INSERT AUDIT LOGS
  if (sql.startsWith('INSERT INTO audit_logs')) {
    const logs = readStore('audit_logs');
    let newLog = {};
    if (params.length >= 5) {
      newLog = {
        id: logs.length + 1,
        timestamp: new Date().toISOString(),
        username: params[0],
        role: params[1],
        device: params[2],
        action: params[3],
        ip_address: params[4]
      };
    } else {
      newLog = {
        id: logs.length + 1,
        timestamp: new Date().toISOString(),
        username: params[0] || 'System',
        role: 'UNKNOWN',
        device: 'UNKNOWN',
        action: params[1] || 'Action',
        ip_address: params[2] || '127.0.0.1'
      };
    }
    logs.push(newLog);
    writeStore('audit_logs', logs);
    return { rows: [newLog], rowCount: 1 };
  }

  // 3. SELECT CASES WITH FILTERS
  if (sql.startsWith('SELECT * FROM cases WHERE 1=1')) {
    let cases = readStore('cases');
    
    // Officer matching (e.g. assigned_officer = $1 OR assigned_officer = $2)
    if (sql.includes('assigned_officer =')) {
      const officerMatches = sql.match(/assigned_officer = (\$\d+)/g);
      if (officerMatches) {
        const officerVals = officerMatches.map(m => {
          const matchResult = m.match(/assigned_officer = (\$\d+)/);
          return matchResult ? getParam(matchResult[1]) : null;
        }).filter(Boolean);
        if (officerVals.length > 0) {
          cases = cases.filter(c => officerVals.includes(c.assigned_officer));
        }
      }
    }

    // Simple filter matching
    // "status = $1"
    const statusMatch = sql.match(/status = (\$\d+)/);
    if (statusMatch) {
      const val = getParam(statusMatch[1]);
      cases = cases.filter(c => c.status === val);
    }
    
    // "classification = $2"
    const classMatch = sql.match(/classification = (\$\d+)/);
    if (classMatch) {
      const val = getParam(classMatch[1]);
      cases = cases.filter(c => c.classification === val);
    }

    // Search query match
    if (sql.includes('ILIKE')) {
      // Find the last parameter which is the search
      const searchVal = params[params.length - 1]?.toString().replace(/%/g, '').toLowerCase() || '';
      if (searchVal) {
        cases = cases.filter(c => 
          c.id.toLowerCase().includes(searchVal) ||
          c.title.toLowerCase().includes(searchVal) ||
          c.victim_name.toLowerCase().includes(searchVal) ||
          (c.fir_number && c.fir_number.toLowerCase().includes(searchVal)) ||
          (c.complaint_number && c.complaint_number.toLowerCase().includes(searchVal))
        );
      }
    }

    // Sort by created_at desc
    cases.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { rows: cases, rowCount: cases.length };
  }


  // 4. SELECT CASE BY ID
  if (sql.includes('FROM cases WHERE id = $1') || sql.includes('from cases where id = $1')) {
    const cases = readStore('cases');
    const match = cases.find(c => c.id === params[0]);
    return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
  }

  // 5. INSERT CASES
  if (sql.startsWith('INSERT INTO cases')) {
    const cases = readStore('cases');
    const newCase = {
      id: params[0],
      title: params[1],
      description: params[2],
      status: params[3],
      priority: params[4],
      classification: params[5],
      victim_name: params[6],
      victim_age: params[7],
      victim_phone: params[8],
      victim_email: params[9],
      victim_occupation: params[10],
      victim_location: params[11],
      remarks: params[12],
      assigned_officer: params[13],
      assigned_cell: params[14],
      fir_number: params[15],
      complaint_number: params[16],
      loss_amount: params[17],
      notes: typeof params[18] === 'string' ? JSON.parse(params[18]) : params[18],
      integrity_hash: params[19],
      created_at: new Date().toISOString()
    };
    cases.push(newCase);
    writeStore('cases', cases);
    return { rows: [newCase], rowCount: 1 };
  }

  // 6. UPDATE CASES
  if (sql.startsWith('UPDATE cases SET')) {
    const cases = readStore('cases');
    const caseId = params[params.length - 1]; // Case ID is the last parameter
    const idx = cases.findIndex(c => c.id === caseId);
    
    if (idx === -1) return { rows: [], rowCount: 0 };
    
    const c = cases[idx];
    
    // Parse update parameters
    // "status = $1, remarks = $2, priority = $3, notes = $4, integrity_hash = $5"
    if (sql.includes('status =')) {
      const match = sql.match(/status = (\$\d+)/);
      if (match) c.status = getParam(match[1]);
    }
    if (sql.includes('remarks =')) {
      const match = sql.match(/remarks = (\$\d+)/);
      if (match) c.remarks = getParam(match[1]);
    }
    if (sql.includes('approval_remarks =')) {
      const match = sql.match(/approval_remarks = (\$\d+)/);
      if (match) c.approval_remarks = getParam(match[1]);
    }
    if (sql.includes('priority =')) {
      const match = sql.match(/priority = (\$\d+)/);
      if (match) c.priority = getParam(match[1]);
    }
    if (sql.includes('notes =')) {
      const match = sql.match(/notes = (\$\d+)/);
      if (match) {
        const val = getParam(match[1]);
        c.notes = typeof val === 'string' ? JSON.parse(val) : val;
      }
    }
    if (sql.includes('integrity_hash =')) {
      const match = sql.match(/integrity_hash = (\$\d+)/);
      if (match) c.integrity_hash = getParam(match[1]);
    }
    
    cases[idx] = c;
    writeStore('cases', cases);
    return { rows: [c], rowCount: 1 };
  }

  // 7. SELECT EVIDENCE BY CASE ID
  if (sql.startsWith('SELECT * FROM evidence WHERE case_id = $1')) {
    const evidence = readStore('evidence');
    const match = evidence.filter(e => e.case_id === params[0]);
    return { rows: match, rowCount: match.length };
  }

  // 8. SELECT EVIDENCE BY ID
  if (sql.includes('FROM evidence WHERE id = $1') || sql.includes('from evidence where id = $1')) {
    const evidence = readStore('evidence');
    const match = evidence.find(e => e.id === params[0]);
    return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
  }

  // 9. INSERT EVIDENCE
  if (sql.startsWith('INSERT INTO evidence')) {
    const evidence = readStore('evidence');
    const newEv = {
      id: params[0],
      case_id: params[1],
      file_name: params[2],
      file_type: params[3],
      file_path: params[4],
      file_size: params[5],
      uploaded_by: params[6],
      sha256_hash: params[7],
      ocr_language: params[8],
      ocr_confidence: params[9],
      ocr_text: params[10],
      tags: params[11] || [],
      uploaded_at: new Date().toISOString()
    };
    evidence.push(newEv);
    writeStore('evidence', evidence);
    return { rows: [newEv], rowCount: 1 };
  }

  // 10. UPDATE EVIDENCE OCR
  if (sql.startsWith('UPDATE evidence SET ocr_text = $1')) {
    const evidence = readStore('evidence');
    const evId = params[2]; // id is $3
    const idx = evidence.findIndex(e => e.id === evId);
    
    if (idx === -1) return { rows: [], rowCount: 0 };
    
    evidence[idx].ocr_text = params[0];
    evidence[idx].ocr_confidence = params[1];
    
    writeStore('evidence', evidence);
    return { rows: [evidence[idx]], rowCount: 1 };
  }

  // 11. SELECT ENTITIES BY TYPE AND VALUE
  if (sql.startsWith('SELECT * FROM entities WHERE entity_type = $1 AND entity_value = $2')) {
    const entities = readStore('entities');
    const match = entities.find(e => e.entity_type === params[0] && e.entity_value === params[1]);
    return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
  }

  // 12. INSERT ENTITIES
  if (sql.startsWith('INSERT INTO entities (entity_type, entity_value')) {
    const entities = readStore('entities');
    const existingIdx = entities.findIndex(e => e.entity_type === params[0] && e.entity_value === params[1]);
    
    if (existingIdx !== -1) {
      entities[existingIdx].risk_score = params[2];
      entities[existingIdx].details = params[3];
      writeStore('entities', entities);
      return { rows: [entities[existingIdx]], rowCount: 1 };
    }
    
    const newEnt = {
      id: entities.length + 1,
      entity_type: params[0],
      entity_value: params[1],
      risk_score: params[2] || 'Medium',
      details: params[3] || ''
    };
    entities.push(newEnt);
    writeStore('entities', entities);
    return { rows: [newEnt], rowCount: 1 };
  }

  // 13. INSERT EVIDENCE ENTITIES LINK
  if (sql.startsWith('INSERT INTO evidence_entities')) {
    const links = readStore('evidence_entities');
    const exists = links.some(l => l.evidence_id === params[0] && l.entity_id === params[1]);
    
    const newLink = {
      evidence_id: params[0],
      entity_id: params[1],
      case_id: params[2]
    };
    
    if (!exists) {
      links.push(newLink);
      writeStore('evidence_entities', links);
    }
    return { rows: [newLink], rowCount: 1 };
  }

  // 14. SELECT ENTITIES WITH SEARCH
  if (sql.startsWith('SELECT * FROM entities') && params[0]) {
    const entities = readStore('entities');
    const searchVal = params[0].replace(/%/g, '').toLowerCase();
    const match = entities.filter(e => 
      e.entity_value.toLowerCase().includes(searchVal) ||
      e.entity_type.toLowerCase().includes(searchVal)
    );
    return { rows: match, rowCount: match.length };
  }

  // 15. SELECT ALL ENTITIES (unfiltered)
  if (sql.startsWith('SELECT * FROM entities') && params.length === 0) {
    const entities = readStore('entities');
    return { rows: entities, rowCount: entities.length };
  }

  // 16. SELECT EVIDENCE ENTITIES BY ENTITY ID (Lifecycle matching)
  if (sql.startsWith('SELECT * FROM evidence_entities WHERE entity_id = $1')) {
    const links = readStore('evidence_entities');
    const match = links.filter(l => l.entity_id === params[0]);
    return { rows: match, rowCount: match.length };
  }

  // 17. SELECT TIMELINE EVENTS BY CASE ID
  if (sql.startsWith('SELECT * FROM timeline_events WHERE case_id = $1')) {
    const events = readStore('timeline_events');
    const match = events.filter(t => t.case_id === params[0]);
    // sort by timestamp asc
    match.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return { rows: match, rowCount: match.length };
  }

  // 18. INSERT TIMELINE EVENTS
  if (sql.startsWith('INSERT INTO timeline_events')) {
    const events = readStore('timeline_events');
    const newEv = {
      id: events.length + 1,
      case_id: params[0],
      timestamp: params[1],
      title: params[2],
      description: params[3],
      created_by: params[4]
    };
    events.push(newEv);
    writeStore('timeline_events', events);
    return { rows: [newEv], rowCount: 1 };
  }

  // 19. SELECT ALERTS
  if (sql.startsWith('SELECT * FROM alerts')) {
    const alerts = readStore('alerts');
    alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return { rows: alerts, rowCount: alerts.length };
  }

  // 20. INSERT ALERTS
  if (sql.startsWith('INSERT INTO alerts')) {
    const alerts = readStore('alerts');
    const newAlert = {
      id: params[0],
      type: params[1],
      severity: params[2],
      title: params[3],
      description: params[4],
      entity_type: params[5],
      entity_value: params[6],
      cases: params[7] || [],
      resolved: false,
      timestamp: new Date().toISOString()
    };
    
    // Avoid double alerts
    const existsIdx = alerts.findIndex(a => a.id === params[0]);
    if (existsIdx !== -1) {
      alerts[existsIdx] = newAlert;
    } else {
      alerts.push(newAlert);
    }
    writeStore('alerts', alerts);
    return { rows: [newAlert], rowCount: 1 };
  }

  // 21. RESOLVE ALERTS
  if (sql.startsWith('UPDATE alerts SET resolved = true')) {
    const alerts = readStore('alerts');
    const alertId = params[0];
    const idx = alerts.findIndex(a => a.id === alertId);
    if (idx !== -1) {
      alerts[idx].resolved = true;
      writeStore('alerts', alerts);
      return { rows: [alerts[idx]], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // 22. SELECT CHAIN OF CUSTODY
  if (sql.startsWith('SELECT * FROM chain_of_custody WHERE evidence_id = $1')) {
    const coc = readStore('chain_of_custody');
    const match = coc.filter(c => c.evidence_id === params[0]);
    match.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return { rows: match, rowCount: match.length };
  }

  // 23. INSERT CHAIN OF CUSTODY
  if (sql.startsWith('INSERT INTO chain_of_custody')) {
    const coc = readStore('chain_of_custody');
    const newCoc = {
      id: coc.length + 1,
      evidence_id: params[0],
      action: params[1],
      handled_by: params[2],
      description: params[3],
      timestamp: new Date().toISOString()
    };
    coc.push(newCoc);
    writeStore('chain_of_custody', coc);
    return { rows: [newCoc], rowCount: 1 };
  }

  // SELECT USER BY ID
  if (sql.includes('FROM users WHERE id = $1') || sql.includes('from users where id = $1')) {
    const users = readStore('users');
    const match = users.find(u => u.id == params[0]);
    return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
  }

  // 24. SELECT USERS FOR RBAC (by username or email)
  if (sql.includes('FROM users WHERE username = $1') || sql.includes('from users where username = $1') || sql.includes('FROM users WHERE username = $1 OR email = $2') || sql.includes('FROM users WHERE username = $1 OR email = $1')) {
    const users = readStore('users');
    const val1 = params[0]?.toString().toLowerCase();
    const val2 = params[1]?.toString().toLowerCase() || val1;
    const match = users.find(u => u.username?.toLowerCase() === val1 || u.email?.toLowerCase() === val2 || u.username?.toLowerCase() === val2);
    return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
  }

  // 25. INSERT USERS
  if (sql.startsWith('INSERT INTO users')) {
    const users = readStore('users');
    const exists = users.find(u => u.username === params[0] || (params[1] && u.email === params[1]));
    if (exists) return { rows: [exists], rowCount: 1 };

    let newUser = {};
    if (params.length >= 8) {
      newUser = {
        id: users.length + 1,
        username: params[0],
        email: params[1],
        password_hash: params[2],
        role: params[3],
        name: params[4],
        badge: params[5],
        district: params[6],
        mfa_secret: params[7],
        failed_logins: 0,
        locked_until: null,
        password_changed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
    } else {
      newUser = {
        id: users.length + 1,
        username: params[0],
        email: params[0] + '@chronex.gov.in',
        password_hash: params[1],
        role: params[2],
        name: params[3],
        badge: params[4],
        district: params[5],
        mfa_secret: 'CHRONEX_MFA_SECRET_' + params[0].toUpperCase(),
        failed_logins: 0,
        locked_until: null,
        password_changed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
    }
    users.push(newUser);
    writeStore('users', users);
    return { rows: [newUser], rowCount: 1 };
  }

  // A26. UPDATE users variables
  if (sql.startsWith('UPDATE users SET')) {
    const users = readStore('users');
    const whereMatch = sql.match(/WHERE (id|username) = (\$\d+)/);
    if (!whereMatch) return { rows: [], rowCount: 0 };

    const fieldName = whereMatch[1];
    const paramIdx = parseInt(whereMatch[2].substring(1)) - 1;
    const identifier = params[paramIdx];

    const idx = users.findIndex(u => u[fieldName] == identifier);
    if (idx === -1) return { rows: [], rowCount: 0 };

    const u = users[idx];

    if (sql.includes('failed_logins =')) {
      const match = sql.match(/failed_logins = (\$\d+)/);
      if (match) u.failed_logins = getParam(match[1]);
    }
    if (sql.includes('locked_until =')) {
      const match = sql.match(/locked_until = (\$\d+)/);
      if (match) u.locked_until = getParam(match[1]);
    }
    if (sql.includes('password_hash =')) {
      const match = sql.match(/password_hash = (\$\d+)/);
      if (match) u.password_hash = getParam(match[1]);
    }
    if (sql.includes('password_changed_at =')) {
      const match = sql.match(/password_changed_at = (\$\d+)/);
      if (match) u.password_changed_at = getParam(match[1]);
    }

    users[idx] = u;
    writeStore('users', users);
    return { rows: [u], rowCount: 1 };
  }

  // 26. COUNT CHECKS
  if (sql.startsWith('SELECT COUNT(*) FROM cases')) {
    const cases = readStore('cases');
    return { rows: [{ count: cases.length }], rowCount: 1 };
  }
  if (sql.startsWith('SELECT COUNT(*) FROM evidence') || sql.includes('SELECT COUNT(*)::integer AS count FROM evidence')) {
    const evidence = readStore('evidence');
    return { rows: [{ count: evidence.length }], rowCount: 1 };
  }

  // A1. Optimized entity query (LEFT JOIN evidence_entities ee ON e.id = ee.entity_id)
  if (sql.includes('FROM entities e LEFT JOIN evidence_entities ee') || sql.includes('FROM entities e')) {
    const entities = readStore('entities');
    const ee = readStore('evidence_entities');
    
    let filtered = [...entities];
    
    // Apply filters
    // 1. search
    const searchMatch = sql.match(/e\.entity_value ILIKE (\$\d+) OR e\.entity_type ILIKE \$\d+/) || sql.match(/entity_value ILIKE (\$\d+)/);
    if (searchMatch) {
      const searchVal = getParam(searchMatch[1])?.replace(/%/g, '').toLowerCase() || '';
      if (searchVal) {
        filtered = filtered.filter(e => 
          e.entity_value.toLowerCase().includes(searchVal) ||
          e.entity_type.toLowerCase().includes(searchVal)
        );
      }
    }
    
    // 2. type
    const typeMatch = sql.match(/e\.entity_type = (\$\d+)/) || sql.match(/entity_type = (\$\d+)/);
    if (typeMatch) {
      const val = getParam(typeMatch[1]);
      filtered = filtered.filter(e => e.entity_type === val);
    }
    
    // 3. risk
    const riskMatch = sql.match(/e\.risk_score = (\$\d+)/) || sql.match(/risk_score = (\$\d+)/);
    if (riskMatch) {
      const val = getParam(riskMatch[1]);
      filtered = filtered.filter(e => e.risk_score === val);
    }
    
    // Map Left Join fields (case_ids, occurrence_count)
    const rows = filtered.map(e => {
      const links = ee.filter(link => link.entity_id === e.id);
      const caseIds = [...new Set(links.map(l => l.case_id))];
      return {
        ...e,
        case_ids: caseIds,
        occurrence_count: links.length
      };
    });
    
    // Sort
    rows.sort((a, b) => {
      const typeComp = a.entity_type.localeCompare(b.entity_type);
      if (typeComp !== 0) return typeComp;
      return a.entity_value.localeCompare(b.entity_value);
    });
    
    return { rows, rowCount: rows.length };
  }

  // A2. Optimized run-correlation query
  if (sql.includes('HAVING COUNT(DISTINCT ee.case_id) >= 2') || sql.includes('JOIN entities e ON ee.entity_id = e.id')) {
    const ee = readStore('evidence_entities');
    const entities = readStore('entities');
    
    // Group by entity_id
    const groups = {};
    ee.forEach(link => {
      if (!groups[link.entity_id]) groups[link.entity_id] = new Set();
      groups[link.entity_id].add(link.case_id);
    });
    
    const rows = [];
    for (const [entityIdStr, caseSet] of Object.entries(groups)) {
      const caseIds = Array.from(caseSet);
      if (caseIds.length >= 2) {
        const entityId = parseInt(entityIdStr);
        const entity = entities.find(e => e.id === entityId);
        if (entity) {
          rows.push({
            entity_id: entity.id,
            entity_type: entity.entity_type,
            entity_value: entity.entity_value,
            risk_score: entity.risk_score,
            cases: caseIds
          });
        }
      }
    }
    
    return { rows, rowCount: rows.length };
  }

  // A3. Dashboard general cases stats
  if (sql.includes('COUNT(CASE WHEN status = \'Active\' THEN 1 END)') || sql.includes('critical_cases')) {
    const cases = readStore('cases');
    const total_cases = cases.length;
    const active_cases = cases.filter(c => c.status === 'Active').length;
    const closed_cases = cases.filter(c => c.status === 'Closed').length;
    const critical_cases = cases.filter(c => c.priority === 'Critical').length;
    const total_loss_amount = cases.reduce((sum, c) => sum + (parseFloat(c.loss_amount) || 0), 0);
    
    return {
      rows: [{
        total_cases,
        active_cases,
        closed_cases,
        critical_cases,
        total_loss_amount
      }],
      rowCount: 1
    };
  }

  // A4. Dashboard general entities stats
  if (sql.includes('COUNT(CASE WHEN risk_score = \'High\' THEN 1 END)') || sql.includes('high_risk_entities')) {
    const entities = readStore('entities');
    const total_entities = entities.length;
    const high_risk_entities = entities.filter(e => e.risk_score === 'High').length;
    return {
      rows: [{
        total_entities,
        high_risk_entities
      }],
      rowCount: 1
    };
  }

  // A5. Dashboard general alerts stats
  if (sql.includes('COUNT(CASE WHEN NOT resolved THEN 1 END)') || sql.includes('active_alerts')) {
    const alerts = readStore('alerts');
    const active_alerts = alerts.filter(a => !a.resolved).length;
    const critical_alerts = alerts.filter(a => !a.resolved && a.severity === 'Critical').length;
    return {
      rows: [{
        active_alerts,
        critical_alerts
      }],
      rowCount: 1
    };
  }

  // A6. Cases status groups
  if (sql.includes('GROUP BY status')) {
    const cases = readStore('cases');
    const counts = { Active: 0, Closed: 0, 'Under Review': 0, Pending: 0 };
    cases.forEach(c => {
      counts[c.status] = (counts[c.status] || 0) + 1;
    });
    const rows = Object.entries(counts).map(([status, count]) => ({ status, count }));
    return { rows, rowCount: rows.length };
  }

  // A7. Cases priority groups
  if (sql.includes('GROUP BY priority')) {
    const cases = readStore('cases');
    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    cases.forEach(c => {
      counts[c.priority] = (counts[c.priority] || 0) + 1;
    });
    const rows = Object.entries(counts).map(([priority, count]) => ({ priority, count }));
    return { rows, rowCount: rows.length };
  }

  // A8. Recent cases (LIMIT 5)
  if (sql.includes('ORDER BY created_at DESC LIMIT 5')) {
    const cases = readStore('cases');
    const sorted = [...cases].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const slice = sorted.slice(0, 5);
    return { rows: slice, rowCount: slice.length };
  }

  // A9. SELECT FROM victims
  if (sql.startsWith('SELECT * FROM victims WHERE case_id = $1')) {
    const victims = readStore('victims');
    const match = victims.filter(v => v.case_id === params[0]);
    return { rows: match, rowCount: match.length };
  }

  // A10. INSERT INTO victims
  if (sql.startsWith('INSERT INTO victims')) {
    const victims = readStore('victims');
    const newVictim = {
      id: victims.length + 1,
      case_id: params[0],
      name: params[1],
      mobile: params[2],
      email: params[3],
      address: params[4]
    };
    victims.push(newVictim);
    writeStore('victims', victims);
    return { rows: [newVictim], rowCount: 1 };
  }

  // A11. SELECT FROM investigation_notes
  if (sql.startsWith('SELECT * FROM investigation_notes WHERE case_id = $1')) {
    const notes = readStore('investigation_notes');
    const match = notes.filter(n => n.case_id === params[0]);
    match.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return { rows: match, rowCount: match.length };
  }

  // A12. INSERT INTO investigation_notes
  if (sql.startsWith('INSERT INTO investigation_notes')) {
    const notes = readStore('investigation_notes');
    const newNote = {
      id: notes.length + 1,
      case_id: params[0],
      officer: params[1],
      note_text: params[2],
      timestamp: new Date().toISOString()
    };
    notes.push(newNote);
    writeStore('investigation_notes', notes);
    return { rows: [newNote], rowCount: 1 };
  }

  // A13. SELECT FROM historical_cases
  if (sql.startsWith('SELECT * FROM historical_cases') && !sql.includes('WHERE')) {
    const cases = readStore('historical_cases');
    cases.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return { rows: cases, rowCount: cases.length };
  }
  if (sql.startsWith('SELECT * FROM historical_cases WHERE id = $1')) {
    const cases = readStore('historical_cases');
    const match = cases.find(c => c.id === params[0]);
    return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
  }

  // A14. INSERT INTO historical_cases
  if (sql.startsWith('INSERT INTO historical_cases')) {
    const cases = readStore('historical_cases');
    const existsIdx = cases.findIndex(c => c.id === params[0]);
    const newCase = {
      id: params[0],
      title: params[1],
      description: params[2],
      category: params[3],
      loss_amount: params[4],
      status: params[5],
      created_at: new Date().toISOString()
    };
    if (existsIdx !== -1) {
      cases[existsIdx] = newCase;
    } else {
      cases.push(newCase);
    }
    writeStore('historical_cases', cases);
    return { rows: [newCase], rowCount: 1 };
  }

  // A15. SELECT FROM historical_entities
  if (sql.startsWith('SELECT * FROM historical_entities') && !sql.includes('WHERE')) {
    const entities = readStore('historical_entities');
    return { rows: entities, rowCount: entities.length };
  }
  if (sql.startsWith('SELECT * FROM historical_entities WHERE case_id = $1')) {
    const entities = readStore('historical_entities');
    const match = entities.filter(e => e.case_id === params[0]);
    return { rows: match, rowCount: match.length };
  }

  // A16. INSERT INTO historical_entities
  if (sql.startsWith('INSERT INTO historical_entities')) {
    const entities = readStore('historical_entities');
    const existsIdx = entities.findIndex(e => e.case_id === params[0] && e.entity_type === params[1] && e.entity_value === params[2]);
    const newEnt = {
      id: existsIdx !== -1 ? entities[existsIdx].id : entities.length + 1,
      case_id: params[0],
      entity_type: params[1],
      entity_value: params[2],
      risk_score: params[3] || 'Medium',
      details: params[4] || ''
    };
    if (existsIdx !== -1) {
      entities[existsIdx] = newEnt;
    } else {
      entities.push(newEnt);
    }
    writeStore('historical_entities', entities);
    return { rows: [newEnt], rowCount: 1 };
  }

  // A17. INSERT INTO osint_queries
  if (sql.startsWith('INSERT INTO osint_queries')) {
    const queries = readStore('osint_queries');
    const newQuery = {
      id: queries.length + 1,
      entity_type: params[0],
      entity_value: params[1],
      query_type: params[2],
      officer: params[3],
      timestamp: new Date().toISOString()
    };
    queries.push(newQuery);
    writeStore('osint_queries', queries);
    return { rows: [newQuery], rowCount: 1 };
  }

  // A18. INSERT INTO osint_results
  if (sql.startsWith('INSERT INTO osint_results')) {
    const results = readStore('osint_results');
    const newResult = {
      id: results.length + 1,
      query_id: params[0],
      source: params[1],
      result_data: typeof params[2] === 'string' ? JSON.parse(params[2]) : params[2],
      timestamp: new Date().toISOString()
    };
    results.push(newResult);
    writeStore('osint_results', results);
    return { rows: [newResult], rowCount: 1 };
  }

  // A19. SELECT OSINT query history (JOIN results)
  if ((sql.includes('FROM osint_queries') || sql.includes('osint_queries q')) && !sql.includes('WHERE')) {
    const queries = readStore('osint_queries');
    const results = readStore('osint_results');
    const rows = queries.map(q => {
      const res = results.find(r => r.query_id === q.id);
      return {
        ...q,
        source: res ? res.source : null,
        result_data: res ? res.result_data : null,
        result_timestamp: res ? res.timestamp : null
      };
    });
    rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return { rows, rowCount: rows.length };
  }

  // A20. JOIN historical_entities correlation
  if (sql.includes('JOIN historical_entities he')) {
    const ee = readStore('evidence_entities');
    const entities = readStore('entities');
    const he = readStore('historical_entities');
    
    const rows = [];
    ee.forEach(link => {
      const ent = entities.find(e => e.id === link.entity_id);
      if (ent) {
        const matches = he.filter(h => h.entity_value === ent.entity_value && h.entity_type === ent.entity_type);
        matches.forEach(match => {
          rows.push({
            active_case_id: link.case_id,
            historical_case_id: match.case_id,
            entity_type: match.entity_type,
            entity_value: match.entity_value,
            risk_score: match.risk_score
          });
        });
      }
    });
    return { rows, rowCount: rows.length };
  }

  // A21. UPDATE osint_results review status
  // A21. UPDATE osint_results review status
  if (sql.startsWith('UPDATE osint_results SET result_data = $1 WHERE id = $2')) {
    const results = readStore('osint_results');
    const resultId = parseInt(params[1]);
    const idx = results.findIndex(r => r.id === resultId);
    
    if (idx === -1) return { rows: [], rowCount: 0 };
    
    results[idx].result_data = typeof params[0] === 'string' ? JSON.parse(params[0]) : params[0];
    writeStore('osint_results', results);
    return { rows: [results[idx]], rowCount: 1 };
  }

  // A25. SELECT * FROM osint_results BY ID
  if (sql.startsWith('SELECT * FROM osint_results WHERE id = $1')) {
    const results = readStore('osint_results');
    const resultId = parseInt(params[0]);
    const match = results.find(r => r.id === resultId);
    return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
  }

  // A22. JOIN query for active evidence entities correlation
  if (sql.includes('FROM evidence_entities ee JOIN entities ent')) {
    const eeList = readStore('evidence_entities');
    const entList = readStore('entities');
    const evList = readStore('evidence');
    const casesList = readStore('cases');

    const queryVal = params[0]?.toString().trim().toLowerCase() || '';

    const rows = [];
    eeList.forEach(link => {
      const ent = entList.find(e => e.id === link.entity_id);
      if (ent && ent.entity_value && (ent.entity_value.trim().toLowerCase() === queryVal || ent.entity_value.trim().toLowerCase().includes(queryVal))) {
        const e = evList.find(ev => ev.id === link.evidence_id);
        const c = casesList.find(cs => cs.id === link.case_id);
        if (e && c) {
          rows.push({
            case_id: link.case_id,
            evidence_id: link.evidence_id,
            file_name: e.file_name,
            case_title: c.title,
            assigned_officer: c.assigned_officer
          });
        }
      }
    });
    return { rows, rowCount: rows.length };
  }

  // A23. JOIN query for historical entities correlation
  if (sql.includes('FROM historical_entities he JOIN historical_cases hc')) {
    const heList = readStore('historical_entities');
    const hcList = readStore('historical_cases');
    const queryVal = params[0]?.toString().trim().toLowerCase() || '';

    const rows = [];
    heList.forEach(he => {
      if (he.entity_value && (he.entity_value.trim().toLowerCase() === queryVal || he.entity_value.trim().toLowerCase().includes(queryVal))) {
        const hc = hcList.find(c => c.id === he.case_id);
        if (hc) {
          rows.push({
            case_id: he.case_id,
            case_title: hc.title,
            entity_type: he.entity_type,
            risk_score: he.risk_score
          });
        }
      }
    });
    return { rows, rowCount: rows.length };
  }

  // A24. Past OSINT query history correlation
  if (sql.includes('FROM osint_queries q WHERE q.entity_value = $1 AND q.id < $2')) {
    const qList = readStore('osint_queries');
    const entityVal = params[0]?.toString().trim() || '';
    const queryId = parseInt(params[1]) || 0;

    const rows = qList.filter(q => q.entity_value === entityVal && q.id < queryId)
                      .map(q => ({
                        id: q.id,
                        timestamp: q.timestamp,
                        query_type: q.query_type,
                        officer: q.officer
                      }));
    return { rows, rowCount: rows.length };
  }


  // Fallback default response
  console.log(`[CHRONEX MOCK SQL] Unmatched SQL query: "${sql}". Returning empty.`);
  return { rows: [], rowCount: 0 };
};

// Expose query method
export const query = (text, params) => {
  if (usePostgres) {
    return pool.query(text, params);
  } else {
    return queryJsonStore(text, params);
  }
};

export default pool;
