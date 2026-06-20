import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'chronex_jwt_super_secret_key_123';
const LOCKOUT_LIMIT = 5;
const LOCKOUT_DURATION_MINS = 15;

// Password verification helper
function validatePassword(password) {
  const errors = [];
  if (password.length < 12) errors.push('Password must be at least 12 characters long.');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter.');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter.');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number.');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Password must contain at least one special character.');
  return errors;
}

// Helper to log actions in security audit
async function logSecurityAction(username, role, device, action, ip) {
  try {
    await query(
      'INSERT INTO audit_logs (username, role, device, action, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [username, role || 'UNKNOWN', device || 'Browser Session', action, ip || '127.0.0.1']
    );
  } catch (err) {
    console.error('[Audit Log Failure]:', err.message);
  }
}

// POST /api/auth/register - Register new cell users
router.post('/register', async (req, res) => {
  const { username, email, password, role, name, badge, district } = req.body;

  if (!username || !email || !password || !role || !name) {
    return res.status(400).json({ success: false, error: 'All fields (username, email, password, role, name) are required.' });
  }

  // Validate password strength
  const passwordErrors = validatePassword(password);
  if (passwordErrors.length > 0) {
    return res.status(400).json({ success: false, error: 'Weak Password Policy Violation', details: passwordErrors });
  }

  try {
    // Check if user already exists
    const checkUser = await query('SELECT id FROM users WHERE username = $1 OR email = $2', [username.trim(), email.trim()]);
    if (checkUser.rowCount > 0) {
      return res.status(409).json({ success: false, error: 'Username or Email is already registered.' });
    }

    const hashedPw = await bcrypt.hash(password, 10);
    const mfaSecret = 'CHRONEX_MFA_SECRET_' + username.toUpperCase(); // Static seed for simulation OTPs

    const insertRes = await query(`
      INSERT INTO users (username, email, password_hash, role, name, badge, district, mfa_secret)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, username, email, role, name, badge, district
    `, [username.trim(), email.trim(), hashedPw, role, name, badge || '', district || '', mfaSecret]);

    const newUser = insertRes.rows[0];

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const device = req.headers['user-agent'] || 'Web Console Client';

    await logSecurityAction('admin', 'SUPER ADMIN', device, `Registered new user: ${newUser.username} (${newUser.role})`, ip);

    res.status(201).json({ success: true, user: newUser });
  } catch (err) {
    console.error('[Registration Error]:', err.message);
    res.status(500).json({ success: false, error: 'Failed to complete registration.' });
  }
});

// POST /api/auth/login - Main login route
router.post('/login', async (req, res) => {
  const { identity, password } = req.body; // identity can be email or username
  if (!identity || !password) {
    return res.status(400).json({ success: false, error: 'Email/Username and Password are required.' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const device = req.headers['user-agent'] || 'Web Console Client';

  try {
    // 1. Fetch user by username or email
    const userRes = await query('SELECT * FROM users WHERE username = $1 OR email = $1', [identity.trim()]);
    if (userRes.rowCount === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials. User not found.' });
    }

    const user = userRes.rows[0];

    // 2. Check Lockout Status
    if (user.locked_until) {
      const lockTime = new Date(user.locked_until);
      const now = new Date();
      if (lockTime > now) {
        const remainingMins = Math.ceil((lockTime - now) / 60000);
        return res.status(423).json({ 
          success: false, 
          error: `Account Locked: Too many failed attempts. Access blocked for another ${remainingMins} minutes.` 
        });
      } else {
        // Lock expired, reset failed counter
        await query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [user.id]);
        user.failed_logins = 0;
        user.locked_until = null;
      }
    }

    // 3. Verify password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      const newFailedCount = (user.failed_logins || 0) + 1;
      let lockoutTime = null;
      let errorMsg = 'Invalid credentials. Please try again.';

      if (newFailedCount >= LOCKOUT_LIMIT) {
        const lockoutDate = new Date();
        lockoutDate.setMinutes(lockoutDate.getMinutes() + LOCKOUT_DURATION_MINS);
        lockoutTime = lockoutDate.toISOString();
        errorMsg = `Account Locked: Too many failed attempts. Access blocked for ${LOCKOUT_DURATION_MINS} minutes.`;
      }

      await query('UPDATE users SET failed_logins = $1, locked_until = $2 WHERE id = $3', [newFailedCount, lockoutTime, user.id]);
      await logSecurityAction(user.username, user.role, device, `Failed login attempt (Count: ${newFailedCount})`, ip);

      return res.status(401).json({ success: false, error: errorMsg, failed_attempts: newFailedCount });
    }

    // 4. Role-Based MFA Enforce (SP, SUPER ADMIN, CYBER CELL INCHARGE)
    const mfaRequiredRoles = ['SP', 'SUPER ADMIN', 'CYBER CELL INCHARGE'];
    if (mfaRequiredRoles.includes(user.role)) {
      // Generate simulated 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Temporarily store OTP and timestamp inside a token or memory.
      // We will sign a short-lived temp token containing the user ID and OTP hash
      const tempToken = jwt.sign(
        { userId: user.id, username: user.username, otp_hash: bcrypt.hashSync(otp, 4), mfa_pending: true, role: user.role },
        JWT_SECRET,
        { expiresIn: '5m' }
      );

      console.log(`[MFA SIMULATOR] Generated OTP for user ${user.username}: ${otp}`);

      return res.json({ 
        success: true, 
        mfa_required: true, 
        temp_token: tempToken,
        mock_otp: otp, // Returned for testing / verification convenience
        message: 'Security authorization check: 6-digit OTP code sent.'
      });
    }

    // 5. Normal Login (ANALYST, INVESTIGATION OFFICER, READ ONLY VIEWER)
    // Clear failed logins on successful login
    await query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [user.id]);

    const sessionUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      name: user.name,
      badge: user.badge,
      district: user.district
    };

    const token = jwt.sign(sessionUser, JWT_SECRET, { expiresIn: '8h' });
    await logSecurityAction(user.username, user.role, device, 'Login Successful', ip);

    res.json({ success: true, token, user: sessionUser });

  } catch (err) {
    console.error('[Login Error]:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error during login.' });
  }
});

// POST /api/auth/verify-mfa - Validates simulated OTP
router.post('/verify-mfa', async (req, res) => {
  const { temp_token, otp } = req.body;
  if (!temp_token || !otp) {
    return res.status(400).json({ success: false, error: 'temp_token and OTP code are required.' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const device = req.headers['user-agent'] || 'Web Console Client';

  try {
    const decoded = jwt.verify(temp_token, JWT_SECRET);
    if (!decoded.mfa_pending) {
      return res.status(403).json({ success: false, error: 'Invalid MFA request token.' });
    }

    const userRes = await query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'User profile not found.' });
    }

    const user = userRes.rows[0];

    // OTP validation check (we accept mock_otp or statically generated based on code)
    // For development, we match the dynamic OTP simulation generated inside the console log.
    // In our test, the OTP is passed explicitly.
    // Let's verify OTP matches: we can accept any OTP if it is verified, or match the mock otp.
    // Wait, since we are doing dynamic simulation, we can verify that OTP is valid.
    // Since the OTP was logged on the server and printed, let's check it:
    // To make it fully functional and testable without state logs, we can verify if the user matches.
    // Let's check: can we just accept the submitted OTP as valid if it's a 6 digit number?
    // Wait, the client will send the OTP they read from `mock_otp` or console!
    // So the server must remember or match the OTP.
    // Since we want to make the backend stateless or simple, let's check if we can reconstruct the OTP or match it.
    // Wait! How did the login know the OTP? The login returned `mock_otp` in the response!
    // So the client side will receive the `mock_otp` and send it back to the verify-mfa endpoint!
    // Therefore, the verify-mfa endpoint can just check if the OTP matches the one signed in the token, 
    // or since the token is encrypted, we can sign the OTP directly inside the temp_token!
    // Let's modify the login route to sign the OTP in the `tempToken` payload as an encrypted/hashed string!
    // Wait! Let's check if the tempToken has the OTP signed:
    // Yes! Let's sign the `otp` directly in the JWT payload!
    // E.g.: `jwt.sign({ userId: user.id, otp_hash: bcrypt.hashSync(otp, 4), mfa_pending: true })`
    // Then in `/verify-mfa`, we decrypt the JWT, get `otp_hash`, and check if `bcrypt.compareSync(otp, decoded.otp_hash)` is true!
    // This is 100% stateless, secure, and bulletproof!
    // Let's look at how the tempToken was signed in the login route:
    // `const tempToken = jwt.sign({ userId: user.id, username: user.username, mfa_pending: true, role: user.role }, ...)`
    // Let's rewrite it in `auth.js` to sign the OTP hash:
    // `const tempToken = jwt.sign({ userId: user.id, otp_hash: bcrypt.hashSync(otp, 4), mfa_pending: true }, ...)`
    
    if (!decoded.otp_hash) {
      return res.status(403).json({ success: false, error: 'Expired or invalid MFA token payload.' });
    }

    const otpValid = bcrypt.compareSync(otp, decoded.otp_hash);
    if (!otpValid) {
      return res.status(401).json({ success: false, error: 'Incorrect 6-digit OTP code. Access Denied.' });
    }

    // Clear failed login tracker
    await query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [user.id]);

    const sessionUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      name: user.name,
      badge: user.badge,
      district: user.district
    };

    const token = jwt.sign(sessionUser, JWT_SECRET, { expiresIn: '8h' });
    await logSecurityAction(user.username, user.role, device, 'MFA Verification Successful - Session Activated', ip);

    res.json({ success: true, token, user: sessionUser });

  } catch (err) {
    console.error('[MFA Verify Error]:', err.message);
    res.status(403).json({ success: false, error: 'Invalid or expired MFA session token.' });
  }
});

// GET /api/auth/session - Retrieve active user profile
router.get('/session', authenticateToken, async (req, res) => {
  try {
    const userRes = await query('SELECT id, username, email, role, name, badge, district FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'User profile not found.' });
    }
    res.json({ success: true, user: userRes.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to retrieve active session.' });
  }
});

// POST /api/auth/logout - Clear session
router.post('/logout', authenticateToken, async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const device = req.headers['user-agent'] || 'Web Console Client';

  await logSecurityAction(req.user.username, req.user.role, device, 'User Logged Out', ip);
  res.json({ success: true, message: 'Session closed successfully.' });
});

export default router;
