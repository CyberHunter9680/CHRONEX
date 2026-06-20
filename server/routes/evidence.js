import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import Tesseract from 'tesseract.js';
import { query } from '../db.js';
import { authenticateToken, restrictCaseAccess, requireApprovedCase } from '../middlewares/authMiddleware.js';


const router = express.Router();

// ── MULTER MULTIPART SETUP ────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const caseId = req.body.caseId || req.query.caseId || 'unassigned';
    // Prevent directory traversal attacks
    const cleanCaseId = caseId.replace(/[^a-zA-Z0-9-]/g, '');
    const dir = path.join(process.cwd(), 'uploads', cleanCaseId);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${cleanName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.docx', '.txt', '.csv'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file extension.'));
    }
  }
});

// Helper: Format Bytes to human readable
function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

// Helper: Regular Expression Intelligence Parser
function extractEntities(text) {
  const phones = text.match(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{5}\s\d{5}\b/g) || [];
  const upis = text.match(/[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.\-_]+/g) || [];
  const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const urls = text.match(/https?:\/\/[^\s]+/g) || [];
  const transactions = text.match(/\b(?:UPI|TXN|Ref|No|Id)?\s*([0-9]{12})\b|\b[A-Z0-9]{12,18}\b/ig) || [];
  const accounts = text.match(/\b\d{9,18}\b/g) || [];
  const ifscs = text.match(/\b[A-Z]{4}0[A-Z0-9]{6}\b/ig) || [];
  const ips = text.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) || [];
  const amounts = text.match(/(?:Rs|INR|₹|amount)\s*(\d+(?:,\d+)*(?:\.\d{2})?)/ig) || [];
  const dates = text.match(/\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b|\b\d{2}:\d{2}\s*(?:AM|PM|am|pm)?\b/g) || [];
  const usernames = text.match(/@[a-zA-Z0-9_]+/g) || [];

  const unique = (arr) => [...new Set(arr)].map(x => x.trim());

  return {
    phones: unique(phones),
    upis: unique(upis),
    emails: unique(emails),
    urls: unique(urls),
    transactions: unique(transactions),
    accounts: unique(accounts),
    ifscs: unique(ifscs),
    ips: unique(ips),
    amounts: unique(amounts),
    dates: unique(dates),
    usernames: unique(usernames)
  };
}

// Core Entity Registry and Cross-Case Correlation Engine
async function registerEntitiesAndCorrelate(evidenceId, caseId, extracted, uploadedBy) {
  const categories = {
    phones: 'Mobile Number',
    upis: 'UPI ID',
    emails: 'Email Address',
    urls: 'URL',
    transactions: 'Transaction ID',
    accounts: 'Bank Account Number',
    ifscs: 'IFSC Code',
    ips: 'IP Address',
    usernames: 'Social Media Username'
  };

  const correlationsFound = [];

  for (const [key, list] of Object.entries(extracted)) {
    const type = categories[key];
    if (!type) continue; // skip amounts/dates for correlation alerts

    for (const val of list) {
      // 1. Insert entity if not exists
      const entRes = await query(`
        INSERT INTO entities (entity_type, entity_value, risk_score, details)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (entity_type, entity_value) DO NOTHING
        RETURNING id
      `, [type, val, 'Medium', `Auto-extracted from evidence ${evidenceId}`]);
      
      let entId = null;
      if (entRes.rowCount > 0) {
        entId = entRes.rows[0].id;
      } else {
        const fetchRes = await query('SELECT id FROM entities WHERE entity_type = $1 AND entity_value = $2', [type, val]);
        entId = fetchRes.rows[0].id;
      }

      // 2. Link entity to this evidence and case
      await query(`
        INSERT INTO evidence_entities (evidence_id, entity_id, case_id)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [evidenceId, entId, caseId]);

      // 3. CROSS-CASE CORRELATION: Find other cases linked to this entity
      const linksRes = await query(`
        SELECT DISTINCT case_id FROM evidence_entities 
        WHERE entity_id = $1 AND case_id != $2
      `, [entId, caseId]);

      if (linksRes.rowCount > 0) {
        // We found matches in historical cases!
        const linkedCases = linksRes.rows.map(r => r.case_id);
        const allCasesList = [caseId, ...linkedCases];
        
        // Calculate Severity based on link counts
        let severity = 'Medium';
        if (allCasesList.length >= 4) severity = 'Critical';
        else if (allCasesList.length === 3) severity = 'High';

        correlationsFound.push({
          type,
          value: val,
          severity,
          cases: allCasesList
        });
      }
    }
  }

  // 4. Generate correlation alerts in DB
  for (const corr of correlationsFound) {
    const alertId = `A-${Date.now()}-${Math.floor(Math.random()*100)}`;
    const casesArrText = corr.cases.join(', ');
    const desc = `Suspect credential '${corr.value}' (${corr.type}) was extracted from evidence ${evidenceId} in Case ${caseId} and matches active links in: ${casesArrText}. Indicative of coordinated fraud operation.`;

    await query(`
      INSERT INTO alerts (id, type, severity, title, description, entity_type, entity_value, cases)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING
    `, [
      alertId,
      'Duplicate Entity Match',
      corr.severity,
      `Multi-Case ${corr.type} Match`,
      desc,
      corr.type,
      corr.value,
      corr.cases
    ]);
  }
}

// GET /api/evidence - Get evidence list
router.get('/', authenticateToken, restrictCaseAccess, async (req, res) => {
  const { caseId } = req.query;
  try {
    let result;
    if (caseId) {
      result = await query('SELECT * FROM evidence WHERE case_id = $1 ORDER BY uploaded_at DESC', [caseId]);
    } else {
      const allEvidenceRes = await query('SELECT * FROM evidence ORDER BY uploaded_at DESC');
      let rows = allEvidenceRes.rows;
      if (!['SP', 'SUPER ADMIN', 'CYBER CELL INCHARGE'].includes(req.user.role)) {
        // Filter by assigned cases
        const casesRes = await query('SELECT * FROM cases WHERE 1=1');
        const assignedCaseIds = casesRes.rows
          .filter(c => c.assigned_officer === req.user.name || c.assigned_officer === req.user.username)
          .map(c => c.id);
        rows = rows.filter(e => assignedCaseIds.includes(e.case_id));
      }
      return res.json(rows);
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// POST /api/evidence/upload - Upload evidence file
router.post('/upload', authenticateToken, restrictCaseAccess, requireApprovedCase, upload.single('file'), async (req, res) => {
  const { caseId, fileType, customText } = req.body;
  const username = req.user.name || req.user.username || 'System/Guest';


  if (!caseId || !fileType) {
    return res.status(400).json({ error: 'Case ID and Evidence Category are required' });
  }

  try {
    let fileName = '';
    let filePath = '';
    let fileSize = '';
    let fileBuffer = null;

    if (req.file) {
      fileName = req.file.originalname;
      filePath = `/uploads/${caseId}/${req.file.filename}`;
      fileSize = formatBytes(req.file.size);
      
      const absPath = path.join(process.cwd(), filePath);
      fileBuffer = fs.readFileSync(absPath);
    } else {
      // If no physical file (e.g. manual text entry only)
      fileName = `manual_text_${Date.now()}.txt`;
      // Save it as a text file in case directory
      const dir = path.join(process.cwd(), 'uploads', caseId);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      filePath = `/uploads/${caseId}/${fileName}`;
      fileBuffer = Buffer.from(customText || '');
      fs.writeFileSync(path.join(process.cwd(), filePath), fileBuffer);
      fileSize = formatBytes(fileBuffer.length);
    }

    // 1. Compute SHA-256 integrity fingerprint
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const ext = path.extname(fileName).toLowerCase();
    const isImage = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);

    // 2. Setup initial OCR text (will be processed in bg if image and no custom text)
    let extractedText = customText || '';
    let ocrConfidence = 100;
    let ocrLanguage = 'English';
    let isProcessingBackground = false;

    if (isImage && !customText) {
      extractedText = '[OCR Extraction in progress...]';
      ocrConfidence = 0;
      isProcessingBackground = true;
    } else if (!customText) {
      extractedText = `[File Ingested]\nFile Name: ${fileName}\nForensic signature secured. OCR is not applicable for this file extension. Please edit to add custom transcription text.`;
    }

    // 3. Save evidence record to DB
    const evidenceId = `E-${Math.floor(10000 + Math.random() * 90000)}`;
    const tags = [fileType.toLowerCase().replace(' ', '-'), isProcessingBackground ? 'processing' : 'secured'];

    const insertRes = await query(`
      INSERT INTO evidence (
        id, case_id, file_name, file_type, file_path, file_size,
        uploaded_by, sha256_hash, ocr_language, ocr_confidence, ocr_text, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      evidenceId,
      caseId,
      fileName,
      fileType,
      filePath,
      fileSize,
      username,
      fileHash,
      ocrLanguage,
      ocrConfidence,
      extractedText,
      tags
    ]);

    // 4. Chain of custody entry
    await query(`
      INSERT INTO chain_of_custody (evidence_id, action, handled_by, description)
      VALUES ($1, $2, $3, $4)
    `, [
      evidenceId,
      'Uploaded',
      username,
      `Secured file "${fileName}" (Size: ${fileSize}) under case ${caseId}. SHA-256 Fingerprint: ${fileHash.substring(0, 16)}...`
    ]);

    // 5. Trigger background OCR processing or process inline entities
    if (isProcessingBackground) {
      // Run OCR in background
      (async () => {
        try {
          console.log(`[CHRONEX OCR BACKGROUND] Starting Tesseract on: ${fileName} (${evidenceId})...`);
          const absPath = path.join(process.cwd(), filePath);
          const ocrResult = await Tesseract.recognize(absPath, 'eng+hin');
          const bgText = ocrResult.data.text || '';
          const bgConfidence = Math.round(ocrResult.data.confidence);
          const bgLanguage = ocrResult.data.symbols.some(s => s.language === 'hin') ? 'English/Hindi' : 'English';

          // Update DB
          await query(`
            UPDATE evidence
            SET ocr_text = $1, ocr_confidence = $2, ocr_language = $3, tags = array_replace(tags, 'processing', 'secured')
            WHERE id = $4
          `, [bgText, bgConfidence, bgLanguage, evidenceId]);

          // Parse and register entities
          const bgEntities = extractEntities(bgText);
          await registerEntitiesAndCorrelate(evidenceId, caseId, bgEntities, username);

          // Log background completion
          await query(`
            INSERT INTO chain_of_custody (evidence_id, action, handled_by, description)
            VALUES ($1, $2, $3, $4)
          `, [
            evidenceId,
            'OCR Processed',
            'System OCR Engine',
            `Background OCR finished. Confidence: ${bgConfidence}%. Extracted entities registered.`
          ]);

          console.log(`[CHRONEX OCR BACKGROUND] Successfully processed: ${evidenceId}`);
        } catch (bgErr) {
          console.error(`[CHRONEX OCR BACKGROUND ERROR] Failed for ${evidenceId}:`, bgErr.message);
          await query(`
            UPDATE evidence
            SET ocr_text = $1, ocr_confidence = $2, tags = array_replace(tags, 'processing', 'ocr-failed')
            WHERE id = $3
          `, ['[OCR extraction failed. Click to edit transcription text manually.]', 0, evidenceId]);
        }
      })();
    } else {
      // Process entities immediately for text inputs/fallbacks
      const entitiesParsed = extractEntities(extractedText);
      await registerEntitiesAndCorrelate(evidenceId, caseId, entitiesParsed, username);
    }

    res.status(201).json(insertRes.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to ingest digital evidence' });
  }
});

// PUT /api/evidence/:id/ocr - Manually correct OCR text
router.put('/:id/ocr', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { ocrText } = req.body;
  const username = req.user.name || req.user.username || 'System/Guest';

  if (!ocrText) {
    return res.status(400).json({ error: 'OCR Text is required' });
  }

  try {
    const evCheck = await query('SELECT * FROM evidence WHERE id = $1', [id]);
    if (evCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Evidence record not found' });
    }

    const currentEv = evCheck.rows[0];
    const caseId = currentEv.case_id;

    // Verify restrictCaseAccess and requireApprovedCase logic programmatically
    const caseRes = await query('SELECT status, assigned_officer FROM cases WHERE id = $1', [caseId]);
    if (caseRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Case dossier not found' });
    }
    const caseData = caseRes.rows[0];
    
    // restrictCaseAccess check
    if (!['SP', 'SUPER ADMIN', 'CYBER CELL INCHARGE'].includes(req.user.role)) {
      if (caseData.assigned_officer !== req.user.name && caseData.assigned_officer !== req.user.username) {
        return res.status(403).json({ success: false, error: 'Access Denied: You are not assigned to this case file.' });
      }
    }
    
    // requireApprovedCase check
    if (!['SP', 'SUPER ADMIN'].includes(req.user.role)) {
      if (caseData.status !== 'Under Investigation' && caseData.status !== 'Closed') {
        return res.status(403).json({ 
          success: false, 
          error: `Investigation Blocked: Case status is "${caseData.status}". Action locked until approved by SP.` 
        });
      }
    }

    // Compute updated entities
    const updatedEntities = extractEntities(ocrText);

    // Save correction in DB
    const updatedRes = await query(`
      UPDATE evidence 
      SET ocr_text = $1, ocr_confidence = $2
      WHERE id = $3 
      RETURNING *
    `, [ocrText, 100, id]); // manual corrections bring confidence to 100%

    // Write Chain of custody entry
    await query(`
      INSERT INTO chain_of_custody (evidence_id, action, handled_by, description)
      VALUES ($1, $2, $3, $4)
    `, [
      id,
      'OCR Corrected',
      username,
      `Manual correction applied to extracted OCR text. Recalculating entities directory.`
    ]);

    // Re-register and correlate
    await registerEntitiesAndCorrelate(id, currentEv.case_id, updatedEntities, username);

    res.json(updatedRes.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to correct evidence OCR text' });
  }
});

// GET /api/evidence/:id/coc - Chain of custody records
router.get('/:id/coc', authenticateToken, async (req, res) => {
  try {
    const evCheck = await query('SELECT case_id FROM evidence WHERE id = $1', [req.params.id]);
    if (evCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Evidence record not found' });
    }
    const caseId = evCheck.rows[0].case_id;
    
    // restrictCaseAccess check
    const caseRes = await query('SELECT assigned_officer FROM cases WHERE id = $1', [caseId]);
    if (caseRes.rowCount > 0) {
      const caseData = caseRes.rows[0];
      if (!['SP', 'SUPER ADMIN', 'CYBER CELL INCHARGE'].includes(req.user.role)) {
        if (caseData.assigned_officer !== req.user.name && caseData.assigned_officer !== req.user.username) {
          return res.status(403).json({ success: false, error: 'Access Denied: You are not assigned to this case file.' });
        }
      }
    }

    const result = await query('SELECT * FROM chain_of_custody WHERE evidence_id = $1 ORDER BY timestamp DESC', [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch chain of custody' });
  }
});


export default router;
