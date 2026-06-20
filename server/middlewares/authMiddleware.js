import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'chronex_jwt_super_secret_key_123';

// 1. JWT verification middleware
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication token required. Please login.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) {
      console.error('[JWT Verify Error]:', err.message);
      return res.status(403).json({ success: false, error: 'Session expired or invalid token. Please log in again.' });
    }
    req.user = decodedUser;
    next();
  });
}

// 2. Role Authorization gate
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, error: 'User session not verified.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: `Access Denied: Role "${req.user.role}" does not have permissions to execute this operation.` 
      });
    }

    next();
  };
}

// 3. Zero-Trust Case Ownership/Assigned Access Control
export async function restrictCaseAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'User session not verified.' });
  }

  const caseId = req.params.caseId || req.params.id || req.query.caseId || req.body.caseId || req.body.case_id;
  if (!caseId) {
    return next(); // No case resource referenced, proceed
  }

  // SP, SUPER ADMIN and CYBER CELL INCHARGE can access all cases in the cell.
  if (['SP', 'SUPER ADMIN', 'CYBER CELL INCHARGE'].includes(req.user.role)) {
    return next();
  }

  try {
    const caseRes = await query('SELECT assigned_officer FROM cases WHERE id = $1', [caseId]);
    if (caseRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Case dossier not found' });
    }

    const assignedOfficer = caseRes.rows[0].assigned_officer;

    // Investigation Officers (IO) and Read Only Viewers are restricted to cases assigned to them
    if (req.user.role === 'INVESTIGATION OFFICER' || req.user.role === 'READ ONLY VIEWER') {
      if (assignedOfficer !== req.user.name && assignedOfficer !== req.user.username) {
        return res.status(403).json({ 
          success: false, 
          error: 'Access Denied: You are not explicitly assigned to this case file.' 
        });
      }
    }

    next();
  } catch (err) {
    console.error('[restrictCaseAccess Error]:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error verifying case ownership permissions' });
  }
}

// 4. Case Investigation Status lifecycle gate
export async function requireApprovedCase(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'User session not verified.' });
  }

  const caseId = req.params.caseId || req.params.id || req.query.caseId || req.body.caseId || req.body.case_id;
  if (!caseId) {
    return next();
  }

  // SP and SUPER ADMIN can perform case updates regardless of approval state
  if (['SP', 'SUPER ADMIN'].includes(req.user.role)) {
    return next();
  }

  try {
    const caseRes = await query('SELECT status FROM cases WHERE id = $1', [caseId]);
    if (caseRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Case dossier not found' });
    }

    const status = caseRes.rows[0].status;
    
    // Investigation block if case is not approved ('Under Investigation' or 'Closed')
    if (status !== 'Under Investigation' && status !== 'Closed') {
      return res.status(403).json({ 
        success: false, 
        error: `Investigation Blocked: Case status is "${status}". Investigation actions (evidence ingestion, OCR scanning, timeline building, reports) are locked until approved by the SP.` 
      });
    }

    next();
  } catch (err) {
    console.error('[requireApprovedCase Error]:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error verifying case approval status' });
  }
}
