import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

const dbUser = process.env.PGUSER || 'postgres';
const dbPassword = process.env.PGPASSWORD || 'postgres';
const dbHost = process.env.PGHOST || 'localhost';
const dbPort = parseInt(process.env.PGPORT || '5432');
const dbName = process.env.PGDATABASE || 'chronex';

const STORE_DIR = path.join(process.cwd(), 'db_store');

// Seeding Data Definition
const seedCases = [
  {
    id: 'CX-2026-0401',
    title: 'VIP Crypto Investment Fraud Campaign',
    description: 'Victim was approached via a WhatsApp Group named "VIP Stock & Crypto Signals". Conned into transferring ₹1,20,000 to a fraudulent UPI ID under the pretense of high stock returns. Funds were immediately layered to separate mule accounts.',
    status: 'Under Investigation',
    priority: 'Critical',
    classification: 'Investment Scam',
    victim_name: 'Abhishek Vyas',
    victim_age: 34,
    victim_phone: '+91 91234 56789',
    victim_email: 'abhishek.v@gmail.com',
    victim_occupation: 'Software Engineer',
    victim_location: 'Noida Sector 62',
    remarks: 'Initial complaint filed on national cyber portal. Linked with suspicious WhatsApp number and mule UPI. Multi-case correlation analysis pending.',
    assigned_officer: 'Inspector S. Sharma',
    assigned_cell: 'Noida Cyber Cell (Zone 1)',
    fir_number: 'FIR-23/2026',
    complaint_number: 'CC-9028420-2026',
    loss_amount: 120000.00,
    notes: [
      {
        id: `note-seed-1`,
        timestamp: new Date().toISOString(),
        officer: 'Inspector S. Sharma',
        text: 'Case registered and secured in SQL store. Initial complaint linked to National Cyber Crime Portal logs.'
      }
    ],
    integrity_hash: 'd6b9f2910ab38cda8f2efcde04847e0984da0f2efcb910f2efcd6b910ab38cda'
  },
  {
    id: 'CX-2026-0402',
    title: 'Telegram Part-Time Task Job Fraud',
    description: 'Victim was added to a Telegram group and asked to review hotels for payment. Paid small earnings initially, then forced to pay deposit/security charges. Lost ₹45,000 through multiple IMPS and UPI transfers.',
    status: 'Open',
    priority: 'High',
    classification: 'Job Fraud',
    victim_name: 'Rohan Mehta',
    victim_age: 27,
    victim_phone: '+91 98989 89898',
    victim_email: 'rohan.mehta@yahoo.com',
    victim_occupation: 'Sales Representative',
    victim_location: 'Greater Noida',
    remarks: 'Telegram handle @taskmaster_vip identified as recruiter. Request sent to bank for suspect KYC details.',
    assigned_officer: 'Inspector S. Sharma',
    assigned_cell: 'Noida Cyber Cell (Zone 1)',
    fir_number: 'FIR-44/2026',
    complaint_number: 'CC-8820490-2026',
    loss_amount: 45000.00,
    notes: [
      {
        id: `note-seed-2`,
        timestamp: new Date().toISOString(),
        officer: 'Inspector S. Sharma',
        text: 'Telegram chats secured. IP tower location traced to VoIP server routing.'
      }
    ],
    integrity_hash: 'af20de884da0f2efcb910f2efcd6b910ab38cda8f2efcde04847e0984da0f2e'
  },
  {
    id: 'CX-2026-0403',
    title: 'Instant Micro-Loan Blackmail Scam',
    description: 'Victim downloaded a mobile application called "QuickCash". The app harvested contact lists and gallery. Victim paid ₹25,000 following extortion calls showing morphed photographs.',
    status: 'Open',
    priority: 'Critical',
    classification: 'Loan App Fraud',
    victim_name: 'Priya Sharma',
    victim_age: 22,
    victim_phone: '+91 88888 77777',
    victim_email: 'priya22@gmail.com',
    victim_occupation: 'College Student',
    victim_location: 'Noida Sector 15',
    remarks: 'App package matches malicious APK signatures. Extortion call received from VoIP number. Bank statement obtained.',
    assigned_officer: 'Inspector S. Sharma',
    assigned_cell: 'Noida Cyber Cell (Zone 1)',
    fir_number: 'FIR-102/2026',
    complaint_number: 'CC-1120409-2026',
    loss_amount: 25000.00,
    notes: [
      {
        id: `note-seed-3`,
        timestamp: new Date().toISOString(),
        officer: 'Inspector S. Sharma',
        text: 'Micro-loan APK retrieved. Extortion contacts registered.'
      }
    ],
    integrity_hash: '910ab38cda8f2efcde04847e0984da0f2efcb910f2efcd6b910ab38cda8f2ef'
  }
];

const seedEvidence = [
  {
    id: 'E-40101',
    case_id: 'CX-2026-0401',
    file_name: 'whatsapp_signal_group.png',
    file_type: 'WhatsApp Chat',
    file_path: '/uploads/CX-2026-0401/whatsapp_signal_group.png',
    file_size: '284 KB',
    uploaded_by: 'Inspector S. Sharma',
    sha256_hash: '8f2efcde04847e0984da0f2efcb910f2efcd6b910ab38cda8f2efcde04847e09',
    ocr_language: 'English/Hindi',
    ocr_confidence: 94,
    ocr_text: `[10:15 AM] VIP Support: Good morning! Please transfer ₹1,20,000 to our VIP Signal Wallet to start trading.
[10:16 AM] VIP Support: Send payment directly to our merchant UPI: securepay.mule@okaxis.
[10:20 AM] Victim Abhishek: Transfer completed successfully. Transaction reference ID is UPI982374829384. Please check.
[10:22 AM] VIP Support: Thank you. Your trading account is credited. Contact +91 91234 56789 for queries.`,
    tags: ['whatsapp-chat', 'vip-group']
  },
  {
    id: 'E-40201',
    case_id: 'CX-2026-0402',
    file_name: 'telegram_task_screen.png',
    file_type: 'Telegram Chat',
    file_path: '/uploads/CX-2026-0402/telegram_task_screen.png',
    file_size: '420 KB',
    uploaded_by: 'Inspector S. Sharma',
    sha256_hash: 'cb910f2efcd6b910ab38cda8f2efcde04847e0984da0f2efcb910f2efcd6b910ab',
    ocr_language: 'English',
    ocr_confidence: 91,
    ocr_text: `[18:30] @taskmaster_vip: In order to unlock Task 5 with higher rewards, deposit ₹45,000 to our safe channel.
[18:32] @taskmaster_vip: Pay to UPI: securepay.mule@okaxis. Send receipt here.
[18:35] Rohan (Victim): Sent. Please verify fast. I need to withdraw my earnings.
[18:36] @taskmaster_vip: Transaction verified. Task 5 is unlocked. Contact Support line at +91 98989 89898.`,
    tags: ['telegram-chat', 'task-group']
  },
  {
    id: 'E-40301',
    case_id: 'CX-2026-0403',
    file_name: 'loan_app_receipt.png',
    file_type: 'UPI Receipt',
    file_path: '/uploads/CX-2026-0403/loan_app_receipt.png',
    file_size: '150 KB',
    uploaded_by: 'Inspector S. Sharma',
    sha256_hash: 'efcde04847e0984da0f2efcb910f2efcd6b910ab38cda8f2efcde04847e0984da0f',
    ocr_language: 'English',
    ocr_confidence: 98,
    ocr_text: `Google Pay Receipt
Date: 14 June 2026
Transaction ID: UPI827364829103
IFSC: ICIC0000888
Account Linked: 918273645029
Paid to: MULE ACCOUNT ASSOCIATES
UPI ID: securepay.mule@okaxis
Amount: ₹25,000
Remarks: Loan closure fees`,
    tags: ['upi-receipt', 'extortion-payment']
  }
];

const seedUsers = [
  { username: 'admin', email: 'admin@chronex.gov.in', password_plain: 'SuperAdmin123!', role: 'SUPER ADMIN', name: 'Superintendent K. Raghavan', badge: 'IPS-00109', district: 'State Cyber Cell' },
  { username: 'sp', email: 'sp.noida@chronex.gov.in', password_plain: 'Superintendent123!', role: 'SP', name: 'SP Superintendent K. Raghavan', badge: 'IPS-00201', district: 'Noida Cyber Cell' },
  { username: 'incharge', email: 'incharge.noida@chronex.gov.in', password_plain: 'Incharge123!', role: 'CYBER CELL INCHARGE', name: 'Incharge S. Sharma', badge: 'IPS-00305', district: 'Noida Cyber Cell' },
  { username: 'inspector', email: 'officer.sharma@chronex.gov.in', password_plain: 'Inspector123!', role: 'INVESTIGATION OFFICER', name: 'Inspector S. Sharma', badge: 'IPS-89240', district: 'Noida Cyber Cell' },
  { username: 'analyst', email: 'analyst.verma@chronex.gov.in', password_plain: 'Analyst123!', role: 'ANALYST', name: 'Dr. Neha Verma (Forensics)', badge: 'EXP-42890', district: 'District Forensic Lab' },
  { username: 'viewer', email: 'viewer.kumar@chronex.gov.in', password_plain: 'Viewer123!', role: 'READ ONLY VIEWER', name: 'Sub-Inspector A. Kumar', badge: 'SI-77301', district: 'Noida Sector-62 PS' }
];

const hashedSeedUsers = seedUsers.map((user, index) => {
  const { password_plain, ...rest } = user;
  return {
    id: index + 1,
    ...rest,
    password_hash: bcrypt.hashSync(password_plain, 10),
    failed_logins: 0,
    locked_until: null,
    mfa_secret: 'CHRONEX_MFA_SECRET_' + user.username.toUpperCase(),
    password_changed_at: new Date().toISOString()
  };
});


const seedTimelineEvents = [
  { case_id: 'CX-2026-0401', timestamp: '2026-06-12T10:15:00Z', title: 'Scam Inception', description: 'Suspect group contact via WhatsApp offering fake crypto signals.', created_by: 'Inspector S. Sharma' },
  { case_id: 'CX-2026-0401', timestamp: '2026-06-12T10:20:00Z', title: 'UPI Fraud Transaction', description: 'Victim transfers ₹1,20,000 to UPI ID securepay.mule@okaxis.', created_by: 'Inspector S. Sharma' },
  { case_id: 'CX-2026-0402', timestamp: '2026-06-13T18:30:00Z', title: 'Job Task Assignment', description: 'Telegram handle @taskmaster_vip directs victim to deposit money to unlock hotel review tasks.', created_by: 'Inspector S. Sharma' },
  { case_id: 'CX-2026-0402', timestamp: '2026-06-13T18:35:00Z', title: 'Second Layer Payment', description: 'Victim transfers deposit of ₹45,000 to UPI ID securepay.mule@okaxis.', created_by: 'Inspector S. Sharma' }
];

const seedEntities = [
  { entity_type: 'UPI ID', entity_value: 'securepay.mule@okaxis', risk_score: 'Critical', details: 'Extracted from WhatsApp Signal logs, Telegram task sheets, and GPay loan app receipts. Multi-case correlation bridge.' },
  { entity_type: 'Mobile Number', entity_value: '+91 91234 56789', risk_score: 'High', details: 'Forensic contact linked with Case CX-2026-0401. VIP Crypto Signal recruiter.' },
  { entity_type: 'Mobile Number', entity_value: '+91 98989 89898', risk_score: 'High', details: 'Linked with Case CX-2026-0402. Telegram recruitment contact.' },
  { entity_type: 'Transaction ID', entity_value: '982374829384', risk_score: 'Medium', details: 'VIP Signal payment transfer reference.' },
  { entity_type: 'Transaction ID', entity_value: '827364829103', risk_score: 'Medium', details: 'QuickCash extortion payment reference.' },
  { entity_type: 'Bank Account Number', entity_value: '918273645029', risk_score: 'High', details: 'Mule bank account linked to QuickCash app transfers.' },
  { entity_type: 'IFSC Code', entity_value: 'ICIC0000888', risk_score: 'Low', details: 'ICICI Bank branch code associated with mule accounts.' }
];

const seedEvidenceEntities = [
  { evidence_id: 'E-40101', entity_id: 1, case_id: 'CX-2026-0401' },
  { evidence_id: 'E-40201', entity_id: 1, case_id: 'CX-2026-0402' },
  { evidence_id: 'E-40301', entity_id: 1, case_id: 'CX-2026-0403' },
  { evidence_id: 'E-40101', entity_id: 2, case_id: 'CX-2026-0401' },
  { evidence_id: 'E-40101', entity_id: 4, case_id: 'CX-2026-0401' },
  { evidence_id: 'E-40201', entity_id: 3, case_id: 'CX-2026-0402' },
  { evidence_id: 'E-40301', entity_id: 5, case_id: 'CX-2026-0403' },
  { evidence_id: 'E-40301', entity_id: 6, case_id: 'CX-2026-0403' },
  { evidence_id: 'E-40301', entity_id: 7, case_id: 'CX-2026-0403' }
];

const seedAlerts = [
  {
    id: 'A-501', 
    type: 'Duplicate Entity', 
    severity: 'Critical', 
    title: 'Multi-Case UPI ID Match', 
    description: 'UPI credential securepay.mule@okaxis was extracted across multiple evidence files. Strong indicator of organized cyber mule syndicate.',
    entity_type: 'UPI ID',
    entity_value: 'securepay.mule@okaxis',
    cases: ['CX-2026-0401', 'CX-2026-0402', 'CX-2026-0403'],
    resolved: false
  }
];

const seedChainOfCustody = [
  { evidence_id: 'E-40101', action: 'Uploaded', handled_by: 'Inspector S. Sharma', description: 'Ingested file whatsapp_signal_group.png. Generated SHA-256 fingerprint: 8f2efcde04847e09...' },
  { evidence_id: 'E-40201', action: 'Uploaded', handled_by: 'Inspector S. Sharma', description: 'Ingested file telegram_task_screen.png. Generated SHA-256 fingerprint: cb910f2efcd6b910...' },
  { evidence_id: 'E-40301', action: 'Uploaded', handled_by: 'Inspector S. Sharma', description: 'Ingested file loan_app_receipt.png. Generated SHA-256 fingerprint: efcde04847e0984d...' }
];

const seedVictims = [
  { case_id: 'CX-2026-0401', name: 'Abhishek Vyas', mobile: '+91 91234 56789', email: 'abhishek.v@gmail.com', address: 'Noida Sector 62' },
  { case_id: 'CX-2026-0402', name: 'Rohan Mehta', mobile: '+91 98989 89898', email: 'rohan.mehta@yahoo.com', address: 'Greater Noida' },
  { case_id: 'CX-2026-0403', name: 'Priya Sharma', mobile: '+91 88888 77777', email: 'priya22@gmail.com', address: 'Noida Sector 15' }
];

const seedHistoricalCases = [
  { id: 'CX-2025-OLD001', title: 'Legacy Stock Trading Syndicate', description: 'Large-scale WhatsApp investment scam targetting retired personnel.', category: 'Investment Scam', loss_amount: 550000.00, status: 'Closed' },
  { id: 'CX-2025-OLD002', title: 'Quick Loan Phishing Hub', description: 'Malicious APK loan blackmailing Ring operated from Jamtara.', category: 'Loan App Fraud', loss_amount: 180000.00, status: 'Closed' }
];

const seedHistoricalEntities = [
  { case_id: 'CX-2025-OLD001', entity_type: 'UPI ID', entity_value: 'securepay.mule@okaxis', risk_score: 'Critical', details: 'Core collection address for trading scam.' },
  { case_id: 'CX-2025-OLD001', entity_type: 'Mobile Number', entity_value: '+91 91234 56789', risk_score: 'High', details: 'Legacy recruiter phone.' },
  { case_id: 'CX-2025-OLD002', entity_type: 'UPI ID', entity_value: 'quickloan.pay@paytm', risk_score: 'High', details: 'Loan recovery account.' }
];

const seedInvestigationNotes = [
  { case_id: 'CX-2026-0401', officer: 'Inspector S. Sharma', note_text: 'Obtained official bank KYC statement for securepay.mule@okaxis. Registered to a shell trading company.' },
  { case_id: 'CX-2026-0401', officer: 'Inspector S. Sharma', note_text: 'Coordinating with cyber cell Noida for physical raid locations.' }
];

const seedOsintQueries = [
  { id: 1, entity_type: 'IP Address', entity_value: '192.168.1.100', query_type: 'IP Lookup', officer: 'Inspector S. Sharma' }
];

const seedOsintResults = [
  { query_id: 1, source: 'IP Reputation service', result_data: { ip: '192.168.1.100', country: 'India', isp: 'Reliance Jio', risk_score: 15, is_vpn: false } }
];

function seedLocalStore() {
  console.log('⚠️  [CHRONEX DB INIT] PostgreSQL connection failed. Starting persistent JSON file seeding...');
  
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }

  const writeTable = (table, data) => {
    const filePath = path.join(STORE_DIR, `${table}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[CHRONEX JSON SEED] Seeded table '${table}' in ${filePath}`);
  };

  writeTable('cases', seedCases);
  writeTable('evidence', seedEvidence);
  writeTable('users', hashedSeedUsers);
  const timelineWithIds = seedTimelineEvents.map((t, idx) => ({
    id: idx + 1,
    ...t
  }));
  writeTable('timeline_events', timelineWithIds);

  const entitiesWithIds = seedEntities.map((ent, idx) => ({
    id: idx + 1,
    ...ent
  }));
  writeTable('entities', entitiesWithIds);
  writeTable('evidence_entities', seedEvidenceEntities);
  writeTable('alerts', seedAlerts);
  writeTable('chain_of_custody', seedChainOfCustody);
  writeTable('victims', seedVictims);
  writeTable('historical_cases', seedHistoricalCases);
  writeTable('historical_entities', seedHistoricalEntities);
  writeTable('investigation_notes', seedInvestigationNotes);
  writeTable('osint_queries', seedOsintQueries);
  writeTable('osint_results', seedOsintResults);
  writeTable('audit_logs', []);
  writeTable('reports', []);
  
  console.log('\n✅ [CHRONEX JSON FILE DATABASE INITIALIZED SUCCESSFULLY]');
  console.log('You can now run "npm run dev" to boot the backend server.');
}

async function init() {
  console.log(`[CHRONEX DB INIT] Connecting to PostgreSQL at ${dbHost}:${dbPort} as ${dbUser}...`);
  
  const client = new Client({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log('[CHRONEX DB INIT] Connected to default postgres DB.');
    
    // Check if database exists
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
    if (res.rowCount === 0) {
      console.log(`[CHRONEX DB INIT] Database '${dbName}' not found. Creating database...`);
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`[CHRONEX DB INIT] Database '${dbName}' created successfully.`);
    } else {
      console.log(`[CHRONEX DB INIT] Database '${dbName}' already exists.`);
    }
    await client.end();
  } catch (err) {
    // If PostgreSQL fails to connect, fallback directly to JSON database seeding
    seedLocalStore();
    return;
  }

  // PostgreSQL client for seeding
  console.log(`[CHRONEX DB INIT] Connecting to '${dbName}' database...`);
  const dbClient = new Client({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName
  });

  try {
    await dbClient.connect();
    console.log(`[CHRONEX DB INIT] Connected to '${dbName}' database.`);

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('[CHRONEX DB INIT] Creating tables and indexes in PostgreSQL...');
    await dbClient.query(schemaSql);

    console.log('[CHRONEX DB INIT] Registering default law-enforcement users...');
    for (const user of hashedSeedUsers) {
      await dbClient.query(`
        INSERT INTO users (username, email, password_hash, role, name, badge, district, mfa_secret)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (username) DO NOTHING
      `, [user.username, user.email, user.password_hash, user.role, user.name, user.badge, user.district, user.mfa_secret]);
    }

    const caseCheck = await dbClient.query('SELECT COUNT(*) FROM cases');
    const caseCount = parseInt(caseCheck.rows[0].count);

    if (caseCount === 0) {
      console.log('[CHRONEX DB INIT] Seeding sample cases, evidence, and intelligence...');
      
      for (const c of seedCases) {
        await dbClient.query(`
          INSERT INTO cases (
            id, title, description, status, priority, classification,
            victim_name, victim_age, victim_phone, victim_email, victim_occupation, victim_location,
            remarks, assigned_officer, assigned_cell, fir_number, complaint_number, loss_amount, notes, integrity_hash
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        `, [
          c.id, c.title, c.description, c.status, c.priority, c.classification,
          c.victim_name, c.victim_age, c.victim_phone, c.victim_email, c.victim_occupation, c.victim_location,
          c.remarks, c.assigned_officer, c.assigned_cell, c.fir_number, c.complaint_number, c.loss_amount, JSON.stringify(c.notes), c.integrity_hash
        ]);
      }

      for (const e of seedEvidence) {
        await dbClient.query(`
          INSERT INTO evidence (
            id, case_id, file_name, file_type, file_path, file_size,
            uploaded_by, sha256_hash, ocr_language, ocr_confidence, ocr_text, tags
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          e.id, e.case_id, e.file_name, e.file_type, e.file_path, e.file_size,
          e.uploaded_by, e.sha256_hash, e.ocr_language, e.ocr_confidence, e.ocr_text, e.tags
        ]);
        
        await dbClient.query(`
          INSERT INTO chain_of_custody (evidence_id, action, handled_by, description)
          VALUES ($1, $2, $3, $4)
        `, [e.id, 'Uploaded', e.uploaded_by, `Ingested file ${e.file_name}. Generated fingerprint: ${e.sha256_hash.substring(0, 16)}...`]);
      }

      for (const t of seedTimelineEvents) {
        await dbClient.query(`
          INSERT INTO timeline_events (case_id, timestamp, title, description, created_by)
          VALUES ($1, $2, $3, $4, $5)
        `, [t.case_id, t.timestamp, t.title, t.description, t.created_by]);
      }

      for (const ent of seedEntities) {
        await dbClient.query(`
          INSERT INTO entities (entity_type, entity_value, risk_score, details)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (entity_type, entity_value) DO NOTHING
        `, [ent.entity_type, ent.entity_value, ent.risk_score, ent.details]);
      }

      for (const link of seedEvidenceEntities) {
        await dbClient.query(`
          INSERT INTO evidence_entities (evidence_id, entity_id, case_id)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
        `, [link.evidence_id, link.entity_id, link.case_id]);
      }

      for (const a of seedAlerts) {
        await dbClient.query(`
          INSERT INTO alerts (id, type, severity, title, description, entity_type, entity_value, cases)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING
        `, [a.id, a.type, a.severity, a.title, a.description, a.entity_type, a.entity_value, a.cases]);
      }

      // Seed victims
      for (const v of seedVictims) {
        await dbClient.query(`
          INSERT INTO victims (case_id, name, mobile, email, address)
          VALUES ($1, $2, $3, $4, $5)
        `, [v.case_id, v.name, v.mobile, v.email, v.address]);
      }

      // Seed historical cases
      for (const hc of seedHistoricalCases) {
        await dbClient.query(`
          INSERT INTO historical_cases (id, title, description, category, loss_amount, status)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [hc.id, hc.title, hc.description, hc.category, hc.loss_amount, hc.status]);
      }

      // Seed historical entities
      for (const he of seedHistoricalEntities) {
        await dbClient.query(`
          INSERT INTO historical_entities (case_id, entity_type, entity_value, risk_score, details)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (case_id, entity_type, entity_value) DO NOTHING
        `, [he.case_id, he.entity_type, he.entity_value, he.risk_score, he.details]);
      }

      // Seed investigation notes
      for (const note of seedInvestigationNotes) {
        await dbClient.query(`
          INSERT INTO investigation_notes (case_id, officer, note_text)
          VALUES ($1, $2, $3)
        `, [note.case_id, note.officer, note.note_text]);
      }

      // Seed osint queries and results
      for (const q of seedOsintQueries) {
        const queryRes = await dbClient.query(`
          INSERT INTO osint_queries (id, entity_type, entity_value, query_type, officer)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
          RETURNING id
        `, [q.id, q.entity_type, q.entity_value, q.query_type, q.officer]);
        
        if (queryRes.rows.length > 0) {
          const qId = queryRes.rows[0].id;
          const resData = seedOsintResults.find(r => r.query_id === q.id);
          if (resData) {
            await dbClient.query(`
              INSERT INTO osint_results (query_id, source, result_data)
              VALUES ($1, $2, $3)
            `, [qId, resData.source, JSON.stringify(resData.result_data)]);
          }
        }
      }

      console.log('[CHRONEX DB INIT] Seeding completed.');
    }

    console.log('\n✅ [CHRONEX POSTGRES DB INITIALIZATION SUCCESSFUL]');
  } catch (err) {
    console.error('❌ [SCHEMA EXECUTION ERROR] Failed to execute database schema:', err.message);
  } finally {
    await dbClient.end();
  }
}

init();
