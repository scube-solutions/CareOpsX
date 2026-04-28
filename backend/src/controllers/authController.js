const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const supabase = require('../utils/supabase');
const { sendPasswordResetEmail } = require('../utils/notify');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/* ─────────────────────────────────────────
   REGISTER
───────────────────────────────────────── */
const register = async (req, res) => {
  try {
    const { first_name, last_name, email, phone, password, role_id } = req.body;

    // Basic validation
    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ error: 'first_name, last_name, email and password are required' });
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
      }])
      .select('id, first_name, last_name, email, role_id, created_at')
      .single();

    if (error) throw error;

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role_id: user.role_id, roles: [user.role_id] },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user
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
      .select('id, first_name, last_name, email, password_hash, role_id, roles')
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

    const userRoles = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role_id];

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role_id: user.role_id, roles: userRoles },
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

module.exports = { register, login, forgotPassword, resetPassword };