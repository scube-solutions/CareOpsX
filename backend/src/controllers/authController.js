const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const supabase = require('../utils/supabase');
const { sendPasswordResetEmail, sendOtpEmail } = require('../utils/notify');

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
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    const primaryRole   = role_id || 3;

    // Generate OTP for email verification
    const otp    = genOtp();
    const expiry = new Date(Date.now() + OTP_TTL_MS).toISOString();

    // Insert user — role_id 3 = patient by default, admin passes role_id manually
    const { data: user, error } = await supabase
      .from('users')
      .insert([{
        first_name,
        last_name,
        email,
        phone        : phone || null,
        password_hash,
        role_id      : primaryRole,
        roles        : [primaryRole],
        organization_id: primaryRole === SUPER_ADMIN_ROLE ? null : (organization_id || null),
        email_verified: false,
        otp_code      : otp,
        otp_expiry    : expiry,
        otp_purpose   : 'verification',
      }])
      .select('id, first_name, last_name, email, role_id, organization_id, created_at')
      .single();

    if (error) throw error;

    // Send verification OTP (non-fatal)
    const sent = await sendOtpEmail(user.email, user.first_name, otp, 'verification');

    return res.status(201).json({
      message: sent
        ? 'Account created. Please verify your email with the OTP sent.'
        : 'Account created. Email delivery is unavailable — use the code below to verify.',
      requires_verification: true,
      email: user.email,
      ...(!sent && process.env.NODE_ENV !== 'production' ? { dev_otp: otp } : {}),
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
    const { data: user, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, password_hash, role_id, roles, organization_id, email_verified')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Compare password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Block unverified accounts (legacy users have email_verified = null → allowed)
    if (user.email_verified === false) {
      return res.status(403).json({ error: 'Email not verified', requires_verification: true, email: user.email });
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

    const { data: user } = await supabase
      .from('users')
      .select('id, first_name, email')
      .eq('email', email)
      .single();

    // Always return 200 — don't leak whether email exists
    if (!user) return res.json({ message: 'If that email is registered, a reset link has been sent.' });

    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    const { error: updateErr } = await supabase.from('users').update({
      reset_token        : token,
      reset_token_expiry : expiry,
    }).eq('id', user.id);

    if (updateErr) throw updateErr;

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

    const { data: user } = await supabase
      .from('users')
      .select('id, reset_token, reset_token_expiry')
      .eq('reset_token', token)
      .single();

    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link' });
    if (!user.reset_token_expiry || new Date(user.reset_token_expiry) < new Date()) {
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await supabase.from('users').update({
      password_hash,
      reset_token        : null,
      reset_token_expiry : null,
    }).eq('id', user.id);

    return res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── Change own password (authenticated) ───────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'current_password and new_password are required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const { data: user, error } = await supabase.from('users').select('id, password_hash').eq('id', req.user.id).single();
    if (error || !user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const password_hash = await bcrypt.hash(new_password, 10);
    await supabase.from('users').update({ password_hash, updated_at: new Date().toISOString() }).eq('id', user.id);

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

    const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    // Build slug from org name
    const slug = org_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      + '-' + Math.floor(1000 + Math.random() * 9000);
    const organization_code = slug.toUpperCase().slice(0, 12);

    // Create organization first
    const { data: org, error: orgErr } = await supabase.from('organizations').insert([{
      organization_name : org_name.trim(),
      slug,
      organization_code,
      billing_status    : 'trial',
      payment_status    : 'pending',
      portal_access     : { admin: true, doctor: true, patient: true, reception: true, lab: true, pharmacy: true, analytics: true },
    }]).select('id, organization_name').single();

    if (orgErr) throw orgErr;

    const password_hash = await bcrypt.hash(password, 10);
    const [first_name, ...rest] = display_name.trim().split(' ');
    const last_name = rest.join(' ') || '-';

    const otp    = genOtp();
    const expiry = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { data: user, error: userErr } = await supabase.from('users').insert([{
      first_name,
      last_name,
      email,
      phone,
      password_hash,
      role_id         : 1,
      roles           : [1],
      organization_id : org.id,
      is_active       : true,
      email_verified  : false,
      otp_code        : otp,
      otp_expiry      : expiry,
      otp_purpose     : 'verification',
    }]).select('id, first_name, last_name, email, role_id, organization_id, created_at').single();

    if (userErr) throw userErr;

    // Send verification OTP (non-fatal)
    const sent = await sendOtpEmail(user.email, user.first_name, otp, 'verification');

    return res.status(201).json({
      message: sent
        ? 'Clinic created. Please verify your email with the OTP sent.'
        : 'Clinic created. Email delivery is unavailable — use the code below to verify.',
      requires_verification: true,
      email: user.email,
      ...(!sent && process.env.NODE_ENV !== 'production' ? { dev_otp: otp } : {}),
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

    const { data: user } = await supabase
      .from('users')
      .select('id, first_name, email, email_verified')
      .eq('email', email)
      .single();

    if (!user) return res.status(404).json({ error: 'No account found with this email' });
    if (purpose === 'verification' && user.email_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    const otp    = genOtp();
    const expiry = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { error: updErr } = await supabase
      .from('users')
      .update({ otp_code: otp, otp_expiry: expiry, otp_purpose: purpose })
      .eq('id', user.id);
    if (updErr) throw updErr;

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

    const { data: user } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, role_id, roles, organization_id, otp_code, otp_expiry, otp_purpose')
      .eq('email', email)
      .single();

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

    // Mark verified + clear OTP
    await supabase
      .from('users')
      .update({ email_verified: true, otp_code: null, otp_expiry: null, otp_purpose: null })
      .eq('id', user.id);

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

module.exports = { register, login, forgotPassword, resetPassword, changePassword, adminRegister, sendOtp, verifyOtp };
