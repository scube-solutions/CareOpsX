const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const db       = require('../utils/db');
const { sendPasswordResetEmail, sendOtpEmail, sendActivationLinkEmail } = require('../utils/notify');
const { auditLog } = require('../middlewares/audit');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 30 * 1000; // 30 seconds

// Only fully-active accounts may sign in.
const ensureLoginAllowed = (user) => {
  const status = user.account_status;
  if (status === 'suspended')           return { ok: false, message: 'Your account has been suspended. Contact your administrator.' };
  if (status === 'inactive' || user.is_active === false) return { ok: false, message: 'Your account is inactive. Contact your administrator.' };
  if (status === 'pending_invitation' || status === 'pending_activation' || user.invite_status === 'invited' || user.invite_status === 'pending') {
    return { ok: false, message: 'Your account is not activated yet. Please use the activation link from your invitation email.' };
  }
  return { ok: true };
};

// Generate a 6-digit numeric OTP
const genOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const { SUPER_ADMIN_ROLE, getOrganizationById, ensureOrganizationOperational, ensurePortalEnabled } = require('../utils/organizationAccess');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/* ─────────────────────────────────────────
   REGISTER
 ───────────────────────────────────────── */
const register = async (req, res) => {
  try {
    const { first_name, last_name, email, phone, password, role_id, organization_id } = req.body;

    // Basic validation
    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ error: 'first_name, last_name, email and password are required' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const existingResult = await db.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
    const existing = existingResult.rows[0];

    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Mobile must be unique among login accounts (patients excluded — role 3).
    if (phone) {
      const dupPhoneResult = await db.query('SELECT id FROM users WHERE phone = $1 AND role_id != 3 LIMIT 1', [phone]);
      const dupPhone = dupPhoneResult.rows[0];
      if (dupPhone) return res.status(409).json({ error: 'Mobile number already registered' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    const primaryRole   = role_id || 3;

    // Activation link token (replaces OTP). Valid 24h.
    const activationToken  = crypto.randomBytes(32).toString('hex');
    const activationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Insert user — role_id 3 = patient by default. Account stays pending until
    // the user clicks the activation link sent to their email.
    const userInsertResult = await db.query(
      `INSERT INTO users (first_name, last_name, email, phone, password_hash, role_id, roles, organization_id, email_verified, account_status, invite_status, invite_token, invite_token_expiry)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, first_name, last_name, email, role_id, organization_id, created_at`,
      [
        first_name,
        last_name,
        email,
        phone || null,
        password_hash,
        primaryRole,
        [primaryRole],
        primaryRole === SUPER_ADMIN_ROLE ? null : (organization_id || null),
        false,
        'pending_activation',
        'pending',
        activationToken,
        activationExpiry,
      ]
    );
    const user = userInsertResult.rows[0];

    // Email the activation link (non-fatal).
    const activateUrl = `${FRONTEND_URL}/activate-account?token=${activationToken}`;
    const sent = await sendActivationLinkEmail(user.email, user.first_name, activateUrl);

    return res.status(201).json({
      message: sent
        ? 'Account created. Check your email for the activation link to verify your account.'
        : 'Account created. Email delivery is unavailable — use the activation link below.',
      requires_activation: true,
      email: user.email,
      ...(!sent && process.env.NODE_ENV !== 'production' ? { activate_url: activateUrl } : {}),
    });

  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/* ─────────────────────────────────────────
   LOGIN
 ───────────────────────────────────────── */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const userResult = await db.query(
      `SELECT id, first_name, last_name, email, password_hash, role_id, roles, organization_id, email_verified, is_active, account_status, invite_status, failed_login_attempts, locked_until, two_factor_enabled 
       FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );
    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Account lockout check
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const secs = Math.ceil((new Date(user.locked_until) - new Date()) / 1000);
      return res.status(423).json({ error: `Account locked due to failed login attempts. Try again in ${secs} second(s).` });
    }

    // Compare password
    const valid = await bcrypt.compare(password, user.password_hash || '');
    if (!valid) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const lock = attempts >= MAX_FAILED_ATTEMPTS;
      await db.query(
        'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
        [lock ? 0 : attempts, lock ? new Date(Date.now() + LOCK_MS).toISOString() : null, user.id]
      );
      await auditLog({ user_id: user.id, role_id: user.role_id, organization_id: user.organization_id || null,
        action: lock ? 'ACCOUNT_LOCKED' : 'FAILED_LOGIN', module: 'Auth', entity_type: 'user', entity_id: user.id,
        description: `Failed login (${attempts}/${MAX_FAILED_ATTEMPTS})${lock ? ' — account locked 30s' : ''}` });
      return res.status(401).json({ error: lock ? 'Too many failed attempts. Account locked for 30 seconds.' : 'Invalid email or password' });
    }

    // Block unverified accounts — they must use the activation link (no OTP).
    if (user.email_verified === false) {
      return res.status(403).json({ error: 'Your account is not activated yet. Please use the activation link sent to your email.', requires_activation: true, email: user.email });
    }

    // Status gate — only active accounts may sign in.
    const allowed = ensureLoginAllowed(user);
    if (!allowed.ok) return res.status(403).json({ error: allowed.message });

    // Reset failed-attempt counter on a valid password.
    if (user.failed_login_attempts) {
      await db.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);
    }

    // Optional two-factor: issue an email OTP and require verify-otp before token.
    if (user.two_factor_enabled) {
      const otp = genOtp();
      const expiry = new Date(Date.now() + OTP_TTL_MS).toISOString();
      await db.query('UPDATE users SET otp_code = $1, otp_expiry = $2, otp_purpose = \'login\' WHERE id = $3', [otp, expiry, user.id]);
      await sendOtpEmail(user.email, user.first_name, otp, 'login');
      return res.status(200).json({ requires_2fa: true, email: user.email, message: 'A verification code has been sent to your email.' });
    }

    const userRoles = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role_id];
    let organization = null;

    if (user.role_id !== SUPER_ADMIN_ROLE) {
      organization = await getOrganizationById(user.organization_id);
      const orgCheck = ensureOrganizationOperational(organization);
      if (!orgCheck.ok) return res.status(403).json({ error: orgCheck.message });
      const portalCheck = ensurePortalEnabled(organization?.portal_access, user.role_id);
      if (!portalCheck.ok) return res.status(403).json({ error: portalCheck.message });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role_id: user.role_id,
        roles: userRoles,
        organization_id: user.organization_id || null,
        organization_name: organization?.organization_name || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    await db.query('UPDATE users SET last_login_at = $1 WHERE id = $2', [new Date().toISOString(), user.id]);
    await auditLog({ user_id: user.id, role_id: user.role_id, organization_id: user.organization_id || null,
      action: 'LOGIN', module: 'Auth', entity_type: 'user', entity_id: user.id, description: 'Successful login' });

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id         : user.id,
        first_name : user.first_name,
        last_name  : user.last_name,
        email      : user.email,
        role_id    : user.role_id,
        roles      : userRoles,
        organization_id: user.organization_id || null,
        organization_name: organization?.organization_name || null,
      }
    });

  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/* ─────────────────────────────────────────
   FORGOT PASSWORD
 ───────────────────────────────────────── */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const userResult = await db.query('SELECT id, first_name, email FROM users WHERE email = $1 LIMIT 1', [email]);
    const user = userResult.rows[0];

    // Always return 200 — don't leak whether email exists
    if (!user) return res.json({ message: 'If that email is registered, a reset link has been sent.' });

    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await db.query('UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3', [token, expiry, user.id]);

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail(user.email, user.first_name, resetUrl);

    return res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/* ─────────────────────────────────────────
   RESET PASSWORD
 ───────────────────────────────────────── */
const resetPassword = async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'token and new_password are required' });
    if (new_password.length < 6)  return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const userResult = await db.query(
      'SELECT id, role_id, organization_id, reset_token, reset_token_expiry FROM users WHERE reset_token = $1 LIMIT 1',
      [token]
    );
    const user = userResult.rows[0];

    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link' });
    if (!user.reset_token_expiry || new Date(user.reset_token_expiry) < new Date()) {
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await db.query(
      `UPDATE users 
       SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL, failed_login_attempts = 0, locked_until = NULL 
       WHERE id = $2`,
      [password_hash, user.id]
    );
    await auditLog({ user_id: user.id, role_id: user.role_id || null, organization_id: user.organization_id || null,
      action: 'PASSWORD_RESET', module: 'Auth', entity_type: 'user', entity_id: user.id, description: 'Password reset via email' });

    return res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/* ─────────────────────────────────────────
   RESET PASSWORD via EMAIL OTP
 ───────────────────────────────────────── */
const resetPasswordWithOtp = async (req, res) => {
  try {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password) return res.status(400).json({ error: 'email, otp and new_password are required' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const userResult = await db.query(
      'SELECT id, role_id, organization_id, otp_code, otp_expiry, otp_purpose FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    const user = userResult.rows[0];

    if (!user) return res.status(404).json({ error: 'No account found with this email' });
    if (!user.otp_code || user.otp_code !== String(otp)) return res.status(400).json({ error: 'Invalid OTP' });
    if (!user.otp_expiry || new Date(user.otp_expiry) < new Date()) return res.status(400).json({ error: 'OTP has expired. Request a new one.' });
    if (user.otp_purpose && user.otp_purpose !== 'reset') return res.status(400).json({ error: 'OTP purpose mismatch' });

    const password_hash = await bcrypt.hash(new_password, 10);
    await db.query(
      `UPDATE users 
       SET password_hash = $1, otp_code = NULL, otp_expiry = NULL, otp_purpose = NULL, failed_login_attempts = 0, locked_until = NULL 
       WHERE id = $2`,
      [password_hash, user.id]
    );
    await auditLog({ user_id: user.id, role_id: user.role_id || null, organization_id: user.organization_id || null,
      action: 'PASSWORD_RESET', module: 'Auth', entity_type: 'user', entity_id: user.id, description: 'Password reset via email OTP' });

    return res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error('Reset password OTP error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── Change own password (authenticated) ───────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'current_password and new_password are required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const userResult = await req.db.query('SELECT id, password_hash FROM users WHERE id = $1 LIMIT 1', [req.user.id]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const password_hash = await bcrypt.hash(new_password, 10);
    await req.db.query('UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3', [password_hash, new Date().toISOString(), user.id]);
    await auditLog({ user_id: user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null,
      action: 'PASSWORD_CHANGED', module: 'Auth', entity_type: 'user', entity_id: user.id, description: 'User changed own password' });

    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/* ─────────────────────────────────────────
   ADMIN / CLINIC SELF-REGISTRATION
 ───────────────────────────────────────── */
const adminRegister = async (req, res) => {
  try {
    const { email, display_name, org_name, phone, password, plan } = req.body;

    if (!email || !display_name || !org_name || !phone || !password)
      return res.status(400).json({ error: 'All fields are required' });
    if (!EMAIL_RE.test(email))
      return res.status(400).json({ error: 'Please enter a valid email address' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password))
      return res.status(400).json({ error: 'Password must have uppercase, lowercase, and number' });
    if (!/^\d{10}$/.test(phone))
      return res.status(400).json({ error: 'Phone must be 10 digits' });

    const existingResult = await db.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
    const existing = existingResult.rows[0];
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const dupPhoneResult = await db.query('SELECT id FROM users WHERE phone = $1 AND role_id != 3 LIMIT 1', [phone]);
    const dupPhone = dupPhoneResult.rows[0];
    if (dupPhone) return res.status(409).json({ error: 'Mobile number already registered' });

    // Build slug from org name
    const slug = org_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      + '-' + Math.floor(1000 + Math.random() * 9000);
    const organization_code = slug.toUpperCase().slice(0, 12);

    // Create the organization (public.organizations is the table referenced by
    // users.organization_id and read back at login via getOrganizationById).
    const orgInsertResult = await db.query(
      `INSERT INTO organizations (organization_name, slug, organization_code, billing_status, payment_status, portal_access)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, organization_name`,
      [
        org_name.trim(),
        slug,
        organization_code,
        'trial',
        'pending',
        JSON.stringify({ admin: true, doctor: true, patient: true, reception: true, lab: true, pharmacy: true, analytics: true })
      ]
    );
    const org = orgInsertResult.rows[0];

    const password_hash = await bcrypt.hash(password, 10);
    const [first_name, ...rest] = display_name.trim().split(' ');
    const last_name = rest.join(' ') || '-';

    // Activation link token (replaces OTP). Valid 24h.
    const activationToken  = crypto.randomBytes(32).toString('hex');
    const activationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const userInsertResult = await db.query(
      `INSERT INTO users (first_name, last_name, email, phone, password_hash, role_id, roles, organization_id, is_active, email_verified, account_status, invite_status, invite_token, invite_token_expiry)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, first_name, last_name, email, role_id, organization_id, created_at`,
      [
        first_name,
        last_name,
        email,
        phone,
        password_hash,
        1,
        [1],
        org.id,
        true,
        false,
        'pending_activation',
        'pending',
        activationToken,
        activationExpiry,
      ]
    );
    const user = userInsertResult.rows[0];

    // Email the activation link (non-fatal).
    const activateUrl = `${FRONTEND_URL}/activate-account?token=${activationToken}`;
    const sent = await sendActivationLinkEmail(user.email, user.first_name, activateUrl);

    return res.status(201).json({
      message: sent
        ? 'Clinic created. Check your email for the activation link to verify your account.'
        : 'Clinic created. Email delivery is unavailable — use the activation link below.',
      requires_activation: true,
      email: user.email,
      ...(!sent && process.env.NODE_ENV !== 'production' ? { activate_url: activateUrl } : {}),
    });
  } catch (err) {
    console.error('AdminRegister error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/* ─────────────────────────────────────────
   SEND OTP (verification / login)
 ───────────────────────────────────────── */
const sendOtp = async (req, res) => {
  try {
    const { email, purpose = 'verification' } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const userResult = await db.query('SELECT id, first_name, email, email_verified FROM users WHERE email = $1 LIMIT 1', [email]);
    const user = userResult.rows[0];

    if (!user) return res.status(404).json({ error: 'No account found with this email' });
    if (purpose === 'verification' && user.email_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    const otp    = genOtp();
    const expiry = new Date(Date.now() + OTP_TTL_MS).toISOString();

    await db.query(
      'UPDATE users SET otp_code = $1, otp_expiry = $2, otp_purpose = $3 WHERE id = $4',
      [otp, expiry, purpose, user.id]
    );

    const sent = await sendOtpEmail(user.email, user.first_name, otp, purpose);
    return res.json({
      message: sent ? 'OTP sent to your email' : 'Email delivery unavailable — use the code below.',
      ...(!sent && process.env.NODE_ENV !== 'production' ? { dev_otp: otp } : {}),
    });
  } catch (err) {
    console.error('Send OTP error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/* ─────────────────────────────────────────
   VERIFY OTP
 ───────────────────────────────────────── */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp, purpose = 'verification' } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

    const userResult = await db.query(
      `SELECT id, first_name, last_name, email, role_id, roles, organization_id, otp_code, otp_expiry, otp_purpose, is_active, account_status, invite_status 
       FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );
    const user = userResult.rows[0];

    if (!user) return res.status(404).json({ error: 'No account found with this email' });
    if (!user.otp_code || user.otp_code !== String(otp)) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    if (!user.otp_expiry || new Date(user.otp_expiry) < new Date()) {
      return res.status(400).json({ error: 'OTP has expired. Request a new one.' });
    }
    if (user.otp_purpose && user.otp_purpose !== purpose) {
      return res.status(400).json({ error: 'OTP purpose mismatch' });
    }

    // For a 2FA login challenge the account must still be active.
    if (purpose === 'login') {
      const allowed = ensureLoginAllowed(user);
      if (!allowed.ok) return res.status(403).json({ error: allowed.message });
    }

    // Mark verified + clear OTP
    await db.query(
      `UPDATE users 
       SET email_verified = true, otp_code = NULL, otp_expiry = NULL, otp_purpose = NULL, last_login_at = $1, failed_login_attempts = 0, locked_until = NULL 
       WHERE id = $2`,
      [new Date().toISOString(), user.id]
    );
    await auditLog({ user_id: user.id, role_id: user.role_id, organization_id: user.organization_id || null,
      action: purpose === 'login' ? 'LOGIN_2FA' : 'EMAIL_VERIFIED', module: 'Auth', entity_type: 'user', entity_id: user.id,
      description: purpose === 'login' ? 'Successful 2FA login' : 'Email verified' });

    // For verification/login → issue token so user is logged in
    const userRoles = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role_id];
    const token = jwt.sign(
      { id: user.id, email: user.email, role_id: user.role_id, roles: userRoles, organization_id: user.organization_id || null },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'OTP verified successfully',
      token,
      user: {
        id: user.id, first_name: user.first_name, last_name: user.last_name,
        email: user.email, role_id: user.role_id, roles: userRoles,
        organization_id: user.organization_id || null,
      },
    });
  } catch (err) {
    console.error('Verify OTP error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/* ─────────────────────────────────────────
   LOGOUT (authenticated)
 ───────────────────────────────────────── */
const logout = async (req, res) => {
  try {
    await auditLog({ user_id: req.user.id, role_id: req.user.role_id, organization_id: req.user.organization_id || null,
      action: 'LOGOUT', module: 'Auth', entity_type: 'user', entity_id: req.user.id, description: 'User logged out' });
    return res.json({ message: 'Logged out' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/* ─────────────────────────────────────────
   INVITE: validate activation token
 ───────────────────────────────────────── */
const getInvite = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ error: 'No invitation token provided' });

    const userResult = await db.query(
      'SELECT id, first_name, last_name, email, invite_status, invite_token_expiry FROM users WHERE invite_token = $1 LIMIT 1',
      [token]
    );
    const user = userResult.rows[0];

    if (!user) return res.status(400).json({ error: 'Invalid or expired invitation link' });
    if (user.invite_status === 'active') return res.status(409).json({ error: 'This account is already activated. Please sign in.' });
    if (!user.invite_token_expiry || new Date(user.invite_token_expiry) < new Date()) {
      return res.status(400).json({ error: 'This invitation link has expired. Ask your administrator to re-invite you.' });
    }

    return res.json({ email: user.email, first_name: user.first_name, last_name: user.last_name });
  } catch (err) {
    console.error('Get invite error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/* ─────────────────────────────────────────
   INVITE: activate account + set password
 ───────────────────────────────────────── */
const activateInvite = async (req, res) => {
  try {
    const { token, otp, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'token and new_password are required' });
    if (new_password.length < 6)  return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const userResult = await db.query(
      `SELECT id, first_name, last_name, email, role_id, roles, organization_id, invite_status, invite_token_expiry, otp_code, otp_expiry 
       FROM users WHERE invite_token = $1 LIMIT 1`,
      [token]
    );
    const user = userResult.rows[0];

    if (!user) return res.status(400).json({ error: 'Invalid or expired invitation link' });

    // Email OTP verification at activation (OTP is emailed via /auth/send-otp).
    if (otp !== undefined) {
      if (!user.otp_code || user.otp_code !== String(otp)) return res.status(400).json({ error: 'Invalid verification code' });
      if (!user.otp_expiry || new Date(user.otp_expiry) < new Date()) return res.status(400).json({ error: 'Verification code expired. Request a new one.' });
    }
    if (user.invite_status === 'active') return res.status(409).json({ error: 'This account is already activated. Please sign in.' });
    if (!user.invite_token_expiry || new Date(user.invite_token_expiry) < new Date()) {
      return res.status(400).json({ error: 'This invitation link has expired. Ask your administrator to re-invite you.' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await db.query(
      `UPDATE users 
       SET password_hash = $1, email_verified = true, is_active = true, account_status = 'active', invite_status = 'active', 
           invite_token = NULL, invite_token_expiry = NULL, otp_code = NULL, otp_expiry = NULL, otp_purpose = NULL 
       WHERE id = $2`,
      [password_hash, user.id]
    );
    // Keep the linked employee record in sync.
    await db.query(
      "UPDATE staff_profiles SET is_active = true, employment_status = 'Active' WHERE user_id = $1",
      [user.id]
    );
    await auditLog({ user_id: user.id, role_id: user.role_id, organization_id: user.organization_id || null,
      action: 'ACCOUNT_ACTIVATED', module: 'Auth', entity_type: 'user', entity_id: user.id, description: 'Account activated via invitation' });

    // Auto-login on activation so the user lands straight in their portal.
    const userRoles = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role_id];
    const token2 = jwt.sign(
      { id: user.id, email: user.email, role_id: user.role_id, roles: userRoles, organization_id: user.organization_id || null },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Account activated successfully',
      token: token2,
      user: {
        id: user.id, first_name: user.first_name, last_name: user.last_name,
        email: user.email, role_id: user.role_id, roles: userRoles,
        organization_id: user.organization_id || null,
      },
    });
  } catch (err) {
    console.error('Activate invite error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/* ─────────────────────────────────────────
   ACTIVATE SELF-REGISTERED ACCOUNT (link)
   Password is already set at registration — the link only verifies the email.
───────────────────────────────────────── */
const activateAccount = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Activation token is required' });

    const r = await db.query(
      `SELECT id, first_name, last_name, email, role_id, roles, organization_id, invite_status, invite_token_expiry
       FROM users WHERE invite_token = $1 LIMIT 1`,
      [token]
    );
    const user = r.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid or expired activation link' });
    if (user.invite_status === 'active') return res.status(409).json({ error: 'This account is already activated. Please sign in.' });
    if (!user.invite_token_expiry || new Date(user.invite_token_expiry) < new Date()) {
      return res.status(400).json({ error: 'This activation link has expired. Please register again or request a new link.' });
    }

    await db.query(
      `UPDATE users
       SET email_verified = true, is_active = true, account_status = 'active', invite_status = 'active',
           invite_token = NULL, invite_token_expiry = NULL
       WHERE id = $1`,
      [user.id]
    );
    await auditLog({ user_id: user.id, role_id: user.role_id, organization_id: user.organization_id || null,
      action: 'ACCOUNT_ACTIVATED', module: 'Auth', entity_type: 'user', entity_id: user.id, description: 'Account activated via email link' });

    // Auto-login on activation.
    const userRoles = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role_id];
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, role_id: user.role_id, roles: userRoles, organization_id: user.organization_id || null },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({
      message: 'Account activated successfully',
      token: jwtToken,
      user: { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, role_id: user.role_id, roles: userRoles, organization_id: user.organization_id || null },
    });
  } catch (err) {
    console.error('Activate account error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { register, login, logout, forgotPassword, resetPassword, resetPasswordWithOtp, changePassword, adminRegister, sendOtp, verifyOtp, getInvite, activateInvite, activateAccount };
