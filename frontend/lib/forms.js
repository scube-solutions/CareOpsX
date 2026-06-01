'use client';
import { useState } from 'react';

/**
 * Shared inline form-error utilities — use across ALL forms for consistent
 * field-level (red, inline) validation messages instead of top banners/alerts.
 *
 * Usage:
 *   const fe = useFieldErrors();
 *   ...
 *   <input style={fe.inputStyle(s.input, 'email')} value={form.email}
 *          onChange={e => { setForm({...form, email:e.target.value}); fe.clear('email'); }} />
 *   {fe.msg('email')}
 *   ...
 *   const errs = fe.validate({
 *     email:    [[!form.email, 'Email is required'], [form.email && !isEmail(form.email), 'Enter a valid email']],
 *     password: [[!form.password, 'Password is required']],
 *   });
 *   if (errs) return;               // stops submit, errors shown inline
 *   try { await api(...); }
 *   catch (e) { fe.fromApi(e); }    // maps server message to a field by keyword
 */

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));
export const isPhone = (v) => /^\+?\d{10,15}$/.test(String(v || '').replace(/[\s-]/g, ''));

const ERR_TEXT = { color: '#ef4444', fontSize: 12, fontWeight: 600, marginTop: 4, display: 'block' };
const ERR_INPUT = { borderColor: '#ef4444', background: '#fef2f2' };

export function useFieldErrors(initial = {}) {
  const [errors, setErrors] = useState(initial);

  const setField = (field, message) => setErrors((e) => ({ ...e, [field]: message }));
  const clear = (field) => setErrors((e) => (e[field] ? { ...e, [field]: '' } : e));
  const reset = () => setErrors({});

  // rules: { field: [[condition, 'message'], ...] } — first truthy condition wins
  const validate = (rules) => {
    const next = {};
    for (const [field, checks] of Object.entries(rules)) {
      for (const [cond, message] of checks) {
        if (cond) { next[field] = message; break; }
      }
    }
    setErrors(next);
    return Object.keys(next).length > 0 ? next : null;
  };

  // Map a backend Error to a field by keyword, else return false (caller shows banner)
  const fromApi = (err, map = { email: 'email', password: 'password', phone: 'phone' }) => {
    const m = (err?.message || '').toLowerCase();
    for (const [keyword, field] of Object.entries(map)) {
      if (m.includes(keyword)) { setField(field, err.message); return true; }
    }
    return false;
  };

  // Inline helpers for JSX
  const inputStyle = (base, field) => (errors[field] ? { ...base, ...ERR_INPUT } : base);
  const msg = (field) => (errors[field] ? <span style={ERR_TEXT}>{errors[field]}</span> : null);

  return { errors, setField, clear, reset, validate, fromApi, inputStyle, msg };
}

// Standalone components (for forms that don't use the hook)
export function FieldError({ message }) {
  return message ? <span style={ERR_TEXT}>{message}</span> : null;
}
export const errorInputStyle = (base, hasError) => (hasError ? { ...base, ...ERR_INPUT } : base);
