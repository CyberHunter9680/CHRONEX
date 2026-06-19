import express from 'express';
import { query } from '../db.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Utility function to manually log actions
export const logAction = async (username, action, ipAddress) => {
  try {
    await query(
      'INSERT INTO audit_logs (username, action, ip_address) VALUES ($1, $2, $3)',
      [username || 'System/Guest', action, ipAddress || '127.0.0.1']
    );
  } catch (err) {
    console.error('[AUDIT LOG ERROR] Failed to write action:', err.message);
  }
};

// Middleware to audit log all requests modifying state
export const auditMiddleware = (req, res, next) => {
  const username = req.headers['x-officer-name'] || 'System/Guest';
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  
  res.on('finish', () => {
    // Audit log only successful modifications
    if (res.statusCode >= 200 && res.statusCode < 300) {
      let action = '';
      if (req.method === 'POST') {
        if (req.originalUrl.includes('/api/cases')) action = 'Registered new cyber crime case file';
        else if (req.originalUrl.includes('/api/evidence/upload')) action = 'Secured new evidence file in locker';
        else if (req.originalUrl.includes('/api/timeline')) action = 'Added manual intelligence event to timeline';
        else if (req.originalUrl.includes('/api/imports')) action = 'Bulk imported legacy forensic records';
        else action = `Created resource at ${req.originalUrl}`;
      } else if (req.method === 'PUT') {
        if (req.originalUrl.includes('/ocr')) action = 'Corrected raw OCR text on evidence file';
        else if (req.originalUrl.includes('/api/cases')) action = 'Updated case details / remarks / status';
        else action = `Modified resource at ${req.originalUrl}`;
      } else if (req.method === 'DELETE') {
        action = `Deleted resource at ${req.originalUrl}`;
      }
      
      if (action) {
        logAction(username, action, ip);
      }
    }
  });
  next();
};

// GET /api/audit - Get all audit logs
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 200');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// POST /api/audit/verify-file - Verify physical file SHA-256 integrity hash against DB
router.post('/verify-file', async (req, res) => {
  const { evidenceId } = req.body;
  const username = req.headers['x-officer-name'] || 'System/Guest';
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  if (!evidenceId) {
    return res.status(400).json({ error: 'Evidence ID is required' });
  }

  try {
    // 1. Fetch file path and original hash from DB
    const evRes = await query('SELECT file_path, sha256_hash, file_name FROM evidence WHERE id = $1', [evidenceId]);
    if (evRes.rowCount === 0) {
      return res.status(404).json({ error: 'Evidence record not found' });
    }

    const { file_path, sha256_hash, file_name } = evRes.rows[0];
    
    // Resolve relative path to absolute
    // Assume file_path is relative to server root e.g. '/uploads/CX-2026-0401/file.png'
    const absolutePath = path.join(process.cwd(), file_path);

    if (!fs.existsSync(absolutePath)) {
      await logAction(username, `SHA-256 integrity verification failed: Physical file missing for ${evidenceId}`, ip);
      return res.json({ 
        verified: false, 
        error: 'Physical file is missing from storage server',
        originalHash: sha256_hash
      });
    }

    // 2. Read file and compute SHA-256
    const fileBuffer = fs.readFileSync(absolutePath);
    const calculatedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 3. Compare hashes
    const matches = calculatedHash === sha256_hash;
    
    if (matches) {
      await logAction(username, `Verified SHA-256 integrity check successful for ${file_name} (${evidenceId})`, ip);
      res.json({
        verified: true,
        message: 'File integrity verified. Fingerprint matches original signature.',
        calculatedHash,
        originalHash: sha256_hash
      });
    } else {
      await logAction(username, `⚠️ SECURITY ALERT: File tampering detected for evidence ${evidenceId} (${file_name})!`, ip);
      res.json({
        verified: false,
        message: '⚠️ TAMPERING DETECTED! Physical file hash does not match original database footprint.',
        calculatedHash,
        originalHash: sha256_hash
      });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Integrity verification failed' });
  }
});

export default router;
