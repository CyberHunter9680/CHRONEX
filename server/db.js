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
    const newLog = {
      id: logs.length + 1,
      timestamp: new Date().toISOString(),
      username: params[0],
      action: params[1],
      ip_address: params[2]
    };
    logs.push(newLog);
    writeStore('audit_logs', logs);
    return { rows: [newLog], rowCount: 1 };
  }

  // 3. SELECT CASES WITH FILTERS
  if (sql.startsWith('SELECT * FROM cases WHERE 1=1')) {
    let cases = readStore('cases');
    
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
  if (sql.startsWith('SELECT * FROM cases WHERE id = $1')) {
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
  if (sql.startsWith('SELECT * FROM evidence WHERE id = $1')) {
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

  // 24. SELECT USERS FOR RBAC
  if (sql.startsWith('SELECT * FROM users WHERE username = $1')) {
    const users = readStore('users');
    const match = users.find(u => u.username === params[0]);
    return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
  }

  // 25. INSERT USERS
  if (sql.startsWith('INSERT INTO users')) {
    const users = readStore('users');
    const exists = users.find(u => u.username === params[0]);
    if (exists) return { rows: [exists], rowCount: 1 };

    const newUser = {
      id: users.length + 1,
      username: params[0],
      password_hash: params[1],
      role: params[2],
      name: params[3],
      badge: params[4],
      district: params[5],
      created_at: new Date().toISOString()
    };
    users.push(newUser);
    writeStore('users', users);
    return { rows: [newUser], rowCount: 1 };
  }

  // 26. COUNT CHECKS
  if (sql.startsWith('SELECT COUNT(*) FROM cases')) {
    const cases = readStore('cases');
    return { rows: [{ count: cases.length }], rowCount: 1 };
  }
  if (sql.startsWith('SELECT COUNT(*) FROM evidence')) {
    const evidence = readStore('evidence');
    return { rows: [{ count: evidence.length }], rowCount: 1 };
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
