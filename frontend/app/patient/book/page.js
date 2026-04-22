'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';

// ─── Design tokens ────────────────────────────────────────
const T = {
  teal:    '#00b4a0',
  navy:    '#0f1f3d',
  bg:      '#f5f8fc',
  card:    '#ffffff',
  border:  '#e2e8f0',
  text:    '#1e293b',
  muted:   '#64748b',
  display: "'Bricolage Grotesque', sans-serif",
  body:    "'Instrument Sans', sans-serif",
};

const STEPS = ['Specialty', 'Doctor', 'Date', 'Slot', 'Details', 'Payment', 'Confirm'];

const SPECIALTIES = [
  { name: 'General Medicine',  icon: '🩺' },
  { name: 'Cardiology',        icon: '❤️' },
  { name: 'Orthopedics',       icon: '🦴' },
  { name: 'Gynecology',        icon: '🌸' },
  { name: 'Pediatrics',        icon: '👶' },
  { name: 'Dermatology',       icon: '🧴' },
  { name: 'ENT',               icon: '👂' },
  { name: 'Ophthalmology',     icon: '👁️' },
  { name: 'Neurology',         icon: '🧠' },
  { name: 'Psychiatry',        icon: '💬' },
  { name: 'Oncology',          icon: '🔬' },
  { name: 'Urology',           icon: '⚕️' },
];

// ─── Progress stepper ────────────────────────────────────
function Stepper({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: i < step ? T.teal : i === step ? T.teal : T.border,
              color: i <= step ? '#fff' : T.muted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, transition: 'all .2s',
              border: i === step ? `3px solid ${T.teal}` : 'none',
              boxShadow: i === step ? `0 0 0 4px ${T.teal}22` : 'none',
            }}>
              {i < step ? '✓' : i + 1}
            </div>
            <div style={{ fontSize: 10, color: i === step ? T.teal : T.muted, fontWeight: i === step ? 700 : 400, whiteSpace: 'nowrap' }}>{s}</div>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < step ? T.teal : T.border, margin: '0 4px', marginBottom: 16, transition: 'background .2s' }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Button components ───────────────────────────────────
function BtnPrimary({ onClick, disabled, loading, children }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      background: (disabled || loading) ? T.border : T.teal,
      color: (disabled || loading) ? T.muted : '#fff',
      border: 'none', borderRadius: 8, padding: '12px 28px',
      fontFamily: T.body, fontSize: 15, fontWeight: 700,
      cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
      transition: 'all .15s',
    }}>
      {loading ? 'Please wait…' : children}
    </button>
  );
}

function BtnBack({ onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: `1px solid ${T.border}`, borderRadius: 8,
      padding: '12px 24px', fontFamily: T.body, fontSize: 14,
      color: T.muted, cursor: 'pointer',
    }}>← Back</button>
  );
}

// ─── Step 0: Specialty ───────────────────────────────────
function StepSpecialty({ selected, onSelect }) {
  return (
    <div>
      <h2 style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.navy, marginBottom: 8 }}>Choose a specialty</h2>
      <p style={{ color: T.muted, fontSize: 14, marginBottom: 24 }}>Select the type of care you need</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {SPECIALTIES.map(sp => (
          <button key={sp.name} onClick={() => onSelect(sp.name)} style={{
            padding: '16px 12px', borderRadius: 12, textAlign: 'center', cursor: 'pointer',
            border: `2px solid ${selected === sp.name ? T.teal : T.border}`,
            background: selected === sp.name ? '#f0fdfb' : T.card,
            transition: 'all .15s',
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{sp.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: selected === sp.name ? T.teal : T.text, fontFamily: T.body }}>{sp.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 1: Doctor ──────────────────────────────────────
function StepDoctor({ specialty, selected, onSelect, onBack }) {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/doctors?specialty=${encodeURIComponent(specialty)}`)
      .then(res => setDoctors(res.doctors || []))
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false));
  }, [specialty]);

  return (
    <div>
      <h2 style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.navy, marginBottom: 4 }}>Choose a doctor</h2>
      <p style={{ color: T.muted, fontSize: 14, marginBottom: 24 }}>Specialty: <strong style={{ color: T.teal }}>{specialty}</strong></p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: T.muted }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          Loading doctors…
        </div>
      ) : doctors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🩺</div>
          <p style={{ color: T.muted, marginBottom: 16 }}>No doctors available for this specialty yet.</p>
          <button onClick={onBack} style={{ color: T.teal, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>← Try another specialty</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {doctors.map(doc => {
            const name = doc.users?.name || 'Doctor';
            const isSelected = selected?.id === doc.id;
            return (
              <button key={doc.id} onClick={() => onSelect(doc)} style={{
                padding: '16px 20px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                border: `2px solid ${isSelected ? T.teal : T.border}`,
                background: isSelected ? '#f0fdfb' : T.card,
                display: 'flex', alignItems: 'center', gap: 16, transition: 'all .15s',
              }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e0f7f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>👨‍⚕️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: T.display, fontWeight: 700, color: T.navy, fontSize: 15 }}>Dr. {name}</div>
                  <div style={{ color: T.muted, fontSize: 13, marginTop: 2 }}>{doc.specialization}</div>
                  {doc.experience && <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>{doc.experience} years experience</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: T.teal, fontWeight: 700, fontSize: 15 }}>₹{doc.consultation_fee}</div>
                  <div style={{ color: T.muted, fontSize: 11 }}>per visit</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Date ────────────────────────────────────────
function StepDate({ doctor, selected, onChange }) {
  const today = new Date().toISOString().split('T')[0];
  // Max date: 30 days ahead
  const maxDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return (
    <div>
      <h2 style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.navy, marginBottom: 4 }}>Select a date</h2>
      <p style={{ color: T.muted, fontSize: 14, marginBottom: 24 }}>
        Dr. <strong style={{ color: T.navy }}>{doctor?.users?.name || 'Doctor'}</strong>
      </p>
      <div style={{ background: T.card, borderRadius: 14, border: `1px solid ${T.border}`, padding: 24 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 8 }}>Appointment date</label>
        <input
          type="date"
          min={today}
          max={maxDate}
          value={selected}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 8,
            border: `1px solid ${T.border}`, fontSize: 15,
            fontFamily: T.body, color: T.text, outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {selected && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdfb', borderRadius: 8, fontSize: 13, color: T.teal, fontWeight: 600 }}>
            📅 {new Date(selected + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Slot ─────────────────────────────────────────
function StepSlot({ doctor, date, selected, onSelect }) {
  const [slots, setSlots]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!doctor?.id || !date) return;
    setLoading(true);
    setSlots([]);
    api(`/appointments/slots?doctor_id=${doctor.id}&date=${date}`)
      .then(res => {
        const availableSlots = (res.slots || [])
          .filter((item) => item.available)
          .map((item) => item.time);
        setSlots(availableSlots);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [doctor?.id, date]);

  return (
    <div>
      <h2 style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.navy, marginBottom: 4 }}>Select a time slot</h2>
      <p style={{ color: T.muted, fontSize: 14, marginBottom: 24 }}>
        Dr. <strong style={{ color: T.navy }}>{doctor?.users?.name || 'Doctor'}</strong> &nbsp;•&nbsp; {date}
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: T.muted }}>Loading slots…</div>
      ) : slots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>😔</div>
          <p style={{ color: T.muted, marginBottom: 4 }}>No slots available on this date.</p>
          <p style={{ color: T.muted, fontSize: 13 }}>Please go back and choose another date.</p>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 12 }}>{slots.length} slots available</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {slots.map(slot => (
              <button key={slot} onClick={() => onSelect(slot)} style={{
                padding: '10px 6px', borderRadius: 8, border: `2px solid ${selected === slot ? T.teal : T.border}`,
                background: selected === slot ? '#f0fdfb' : T.card,
                color: selected === slot ? T.teal : T.text,
                fontFamily: T.body, fontWeight: selected === slot ? 700 : 400,
                fontSize: 13, cursor: 'pointer', transition: 'all .12s',
              }}>{slot}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Step 4: Details ─────────────────────────────────────
function StepDetails({ user, details, onChange }) {
  const fields = [
    { key: 'name',   label: 'Full name',          type: 'text',     placeholder: 'Patient full name',              required: true },
    { key: 'phone',  label: 'Phone number',       type: 'tel',      placeholder: '+91 XXXXX XXXXX',                required: true },
    { key: 'reason', label: 'Reason for visit',   type: 'text',     placeholder: 'Brief description of symptoms',  required: true },
    { key: 'notes',  label: 'Additional notes',   type: 'textarea', placeholder: 'Any details for the doctor (optional)', required: false },
  ];

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: `1px solid ${T.border}`, fontFamily: T.body, fontSize: 14,
    color: T.text, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div>
      <h2 style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.navy, marginBottom: 4 }}>Patient details</h2>
      <p style={{ color: T.muted, fontSize: 14, marginBottom: 24 }}>Tell us who this appointment is for</p>

      {/* Pre-fill hint if logged in as patient */}
      {user?.name && (
        <button onClick={() => onChange({ ...details, name: user.name, phone: user.phone || details.phone })}
          style={{ marginBottom: 16, background: '#f0fdfb', border: `1px solid ${T.teal}40`, borderRadius: 8, padding: '8px 14px', color: T.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: T.body }}>
          ✓ Use my details (auto-fill)
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, background: T.card, borderRadius: 14, border: `1px solid ${T.border}`, padding: 24 }}>
        {fields.map(f => (
          <div key={f.key}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>
              {f.label} {f.required && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
            {f.type === 'textarea' ? (
              <textarea
                rows={3}
                value={details[f.key]}
                placeholder={f.placeholder}
                onChange={e => onChange({ ...details, [f.key]: e.target.value })}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
              />
            ) : (
              <input
                type={f.type}
                value={details[f.key]}
                placeholder={f.placeholder}
                onChange={e => onChange({ ...details, [f.key]: e.target.value })}
                style={inputStyle}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 5: Payment ─────────────────────────────────────
function StepPayment({ doctor, choice, onChoose }) {
  const fee = doctor?.consultation_fee;

  const options = [
    { key: 'upi',         icon: '📱', label: 'UPI Payment',        desc: 'Google Pay, PhonePe, Paytm', available: false, tag: 'Coming soon'    },
    { key: 'card',        icon: '💳', label: 'Credit / Debit Card', desc: 'Visa, Mastercard, Rupay',    available: false, tag: 'Coming soon'    },
    { key: 'receptionist',icon: '🏥', label: 'Pay at Reception',   desc: 'Cash or card at front desk', available: true,  tag: 'Available now' },
  ];

  return (
    <div>
      <h2 style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.navy, marginBottom: 4 }}>Choose payment method</h2>
      <p style={{ color: T.muted, fontSize: 14, marginBottom: 24 }}>
        Consultation fee: <strong style={{ color: T.teal, fontSize: 16 }}>₹{fee || '—'}</strong>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {options.map(opt => (
          <button key={opt.key} onClick={() => opt.available && onChoose(opt.key)}
            style={{
              padding: '16px 20px', borderRadius: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16,
              border: `2px solid ${choice === opt.key ? T.teal : opt.available ? T.border : '#f1f5f9'}`,
              background: choice === opt.key ? '#f0fdfb' : opt.available ? T.card : '#f8fafc',
              cursor: opt.available ? 'pointer' : 'not-allowed', transition: 'all .15s',
              opacity: opt.available ? 1 : 0.7,
            }}>
            <span style={{ fontSize: 26, flexShrink: 0 }}>{opt.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: opt.available ? T.navy : T.muted, fontSize: 14 }}>{opt.label}</div>
              <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>{opt.desc}</div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
              background: opt.available ? '#dcfce7' : '#f1f5f9',
              color: opt.available ? '#15803d' : '#94a3b8',
            }}>{opt.tag}</span>
          </button>
        ))}
      </div>

      {choice === 'receptionist' && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '16px 20px', fontSize: 14, color: '#92400e', lineHeight: 1.6 }}>
          <strong>How it works:</strong> Your appointment request will be created. Visit the reception desk and pay <strong>₹{fee || '—'}</strong> in cash or card. The receptionist will confirm your booking after payment.
        </div>
      )}
    </div>
  );
}

// ─── Step 6: Confirm ─────────────────────────────────────
function StepConfirm({ specialty, doctor, date, slot, details, onConfirm, loading, error }) {
  const rows = [
    { label: 'Specialty',       value: specialty },
    { label: 'Doctor',          value: `Dr. ${doctor?.users?.name || 'Doctor'}` },
    { label: 'Date',            value: new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) },
    { label: 'Time',            value: slot },
    { label: 'Patient name',    value: details.name },
    { label: 'Phone',           value: details.phone },
    { label: 'Reason',          value: details.reason },
    { label: 'Consultation fee',value: `₹${doctor?.consultation_fee}` },
  ];

  return (
    <div>
      <h2 style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.navy, marginBottom: 4 }}>Confirm your booking</h2>
      <p style={{ color: T.muted, fontSize: 14, marginBottom: 24 }}>Please review the details below</p>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ fontFamily: T.display, fontWeight: 700, color: T.navy, fontSize: 15, paddingBottom: 12, borderBottom: `1px solid ${T.border}`, marginBottom: 12 }}>
          Appointment summary
        </div>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: `1px solid #f8fafc`, fontSize: 14 }}>
            <span style={{ color: T.muted, flexShrink: 0, marginRight: 16 }}>{r.label}</span>
            <span style={{ color: T.text, fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{r.value}</span>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#b91c1c', fontSize: 14, marginBottom: 16 }}>{error}</div>
      )}

      <button onClick={onConfirm} disabled={loading} style={{
        width: '100%', padding: '14px', background: loading ? T.border : T.teal,
        color: loading ? T.muted : '#fff', border: 'none', borderRadius: 10,
        fontFamily: T.body, fontWeight: 700, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all .15s',
      }}>
        {loading ? 'Booking appointment…' : 'Confirm Appointment →'}
      </button>
    </div>
  );
}

// ─── Step 6: Success ─────────────────────────────────────
function StepSuccess({ booking, doctor, date, slot, onBookAnother }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ background: T.card, borderRadius: 20, border: `1px solid ${T.border}`, padding: '48px 32px' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#f0fdfb', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>✅</div>
        <h2 style={{ fontFamily: T.display, fontSize: 28, fontWeight: 700, color: T.navy, marginBottom: 8 }}>Appointment booked!</h2>
        <p style={{ color: T.muted, marginBottom: 28 }}>Your appointment has been successfully scheduled.</p>

        {/* Booking ID pill */}
        <div style={{ display: 'inline-block', background: '#f0fdfb', border: `1px solid ${T.teal}40`, borderRadius: 12, padding: '14px 28px', marginBottom: 28 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 700, color: T.teal, letterSpacing: 3 }}>
            {booking?.booking_id || '—'}
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Booking ID — save this reference</div>
        </div>

        {/* Summary rows */}
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: '16px 20px', marginBottom: 28, textAlign: 'left' }}>
          {[
            { label: 'Doctor', value: `Dr. ${doctor?.users?.name || 'Doctor'}` },
            { label: 'Date',   value: date },
            { label: 'Time',   value: slot },
            { label: 'Status', value: 'Booked', highlight: true },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border}`, fontSize: 14 }}>
              <span style={{ color: T.muted }}>{r.label}</span>
              <span style={{ fontWeight: 600, color: r.highlight ? T.teal : T.text }}>{r.value}</span>
            </div>
          ))}
        </div>

        <a href="/patient/dashboard" style={{
          display: 'block', background: T.teal, color: '#fff', borderRadius: 10,
          padding: '14px', fontFamily: T.body, fontWeight: 700, fontSize: 15,
          textDecoration: 'none', marginBottom: 10,
        }}>Go to dashboard</a>
        <button onClick={onBookAnother} style={{ width: '100%', padding: '12px', background: 'none', color: T.muted, border: 'none', cursor: 'pointer', fontFamily: T.body, fontSize: 14 }}>
          Book another appointment
        </button>
      </div>
    </div>
  );
}

// ─── Main booking page ────────────────────────────────────
export default function BookAppointment() {
  const router = useRouter();

  const [user, setUser]                 = useState(null);
  const [step, setStep]                 = useState(0);
  const [specialty, setSpecialty]       = useState('');
  const [doctor, setDoctor]             = useState(null);
  const [date, setDate]                 = useState('');
  const [slot, setSlot]                 = useState('');
  const [details, setDetails]           = useState({ name: '', phone: '', reason: '', notes: '' });
  const [paymentChoice, setPaymentChoice] = useState('');
  const [booking, setBooking]           = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [waitingPayment, setWaitingPayment] = useState(false);
  const [payReqId, setPayReqId]           = useState(null);
  const [pollCount, setPollCount]         = useState(0);

  // Auth check
  useEffect(() => {
    const u = getUser();
    if (!u) { router.push('/login'); return; }
    setUser(u);
  }, []);

  const next = () => { setError(''); setStep(s => s + 1); };
  const back = () => { setError(''); setStep(s => s - 1); };

  const handleSelectSpecialty = (sp) => { setSpecialty(sp); setDoctor(null); next(); };
  const handleSelectDoctor    = (doc) => { setDoctor(doc); next(); };
  const handleSelectSlot      = (s)   => setSlot(s);

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = {
        patient_id:       user.id,
        doctor_id:        doctor.id,
        appointment_date: date,
        appointment_time: slot,
        reason:           details.reason,
        notes:            details.notes || null,
        patient_name:     details.name,
        patient_phone:    details.phone,
      };
      const res = await api('/appointments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setBooking({
        ...(res.data || {}),
        booking_id: res.booking_id || res.data?.booking_id,
      });
      setStep(7);
    } catch (err) {
      setError(err.message || 'Booking failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // When "Review Booking →" is clicked at Payment step with "receptionist" choice
  const requestReceptionPayment = async () => {
    setLoading(true); setError('');
    try {
      const res = await api('/payment-requests', {
        method: 'POST',
        body: JSON.stringify({
          patient_name:      details.name,
          patient_phone:     details.phone,
          patient_user_id:   user?.id || null,
          doctor_id:         doctor?.id,
          doctor_name:       `Dr. ${[doctor?.users?.first_name, doctor?.users?.last_name].filter(Boolean).join(' ')}`,
          specialty,
          appointment_date:  date,
          appointment_time:  slot,
          consultation_fee:  doctor?.consultation_fee,
        }),
      });
      setPayReqId(res.request.id);
      setWaitingPayment(true);
      setPollCount(0);
    } catch (err) {
      setError(err.message || 'Failed to send request. Please try again.');
    } finally { setLoading(false); }
  };

  // Poll every 6 seconds while waiting for receptionist to approve
  useEffect(() => {
    if (!waitingPayment || !payReqId) return;
    const timer = setTimeout(async () => {
      try {
        const res = await api(`/payment-requests/${payReqId}/status`);
        if (res.status === 'approved') {
          setWaitingPayment(false);
          setStep(6); // proceed to Confirm
        } else {
          setPollCount(c => c + 1);
        }
      } catch { setPollCount(c => c + 1); }
    }, 6000);
    return () => clearTimeout(timer);
  }, [waitingPayment, payReqId, pollCount]);

  const resetBooking = () => {
    setStep(0); setSpecialty(''); setDoctor(null); setDate(''); setSlot('');
    setDetails({ name: '', phone: '', reason: '', notes: '' });
    setPaymentChoice(''); setBooking(null); setError('');
    setWaitingPayment(false); setPayReqId(null); setPollCount(0);
  };

  // Step-level "next" validation
  const canProceed = () => {
    if (step === 2) return !!date;
    if (step === 3) return !!slot;
    if (step === 4) return !!(details.name && details.phone && details.reason);
    if (step === 5) return !!paymentChoice;
    return true;
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: T.body }}>
      {/* Header */}
      <header style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.push('/patient/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 20, padding: '4px 8px' }}>←</button>
        <div>
          <div style={{ fontFamily: T.display, fontWeight: 700, color: T.navy, fontSize: 18 }}>Book appointment</div>
          {step < 7 && <div style={{ color: T.muted, fontSize: 12 }}>Step {step + 1} of {STEPS.length}</div>}
        </div>
        {/* CareOpsX logo */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
            <rect x="9" y="2" width="6" height="6" rx="1" fill={T.teal} opacity=".8"/>
            <rect x="9" y="16" width="6" height="6" rx="1" fill={T.teal} opacity=".8"/>
            <rect x="2" y="9" width="6" height="6" rx="1" fill={T.teal} opacity=".5"/>
            <rect x="16" y="9" width="6" height="6" rx="1" fill={T.teal} opacity=".5"/>
            <rect x="10" y="10" width="4" height="4" rx=".5" fill={T.teal}/>
          </svg>
          <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 15, color: T.navy }}>CareOps<span style={{ color: T.teal }}>X</span></span>
        </div>
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px' }}>
        {/* Stepper — hide on success/waiting screens */}
        {step < 7 && !waitingPayment && <Stepper step={step} />}

        {/* Waiting for receptionist to confirm payment */}
        {waitingPayment && (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#fffbeb', border: '3px solid #fbbf24', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
              animation: 'pulse 1.5s infinite' }}>
              ⏳
            </div>
            <h2 style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.navy, marginBottom: 8 }}>Waiting for payment confirmation</h2>
            <p style={{ color: T.muted, fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              Your request has been sent to the receptionist.<br />
              Please visit or call the reception desk and pay <strong style={{ color: T.teal }}>₹{doctor?.consultation_fee}</strong>.<br />
              This page will update automatically once payment is confirmed.
            </p>
            <div style={{ background: '#f0fdfb', border: `1px solid ${T.teal}40`, borderRadius: 12, padding: '16px 20px', marginBottom: 24, fontSize: 13, color: T.muted }}>
              <div style={{ marginBottom: 6 }}><strong style={{ color: T.navy }}>Doctor:</strong> Dr. {doctor?.users?.name}</div>
              <div style={{ marginBottom: 6 }}><strong style={{ color: T.navy }}>Date & Time:</strong> {date} at {slot}</div>
              <div><strong style={{ color: T.navy }}>Consultation Fee:</strong> <span style={{ color: T.teal, fontWeight: 700 }}>₹{doctor?.consultation_fee}</span></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: T.muted, fontSize: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', display: 'inline-block', animation: 'blink 1s infinite' }} />
              Checking with reception… ({pollCount > 0 ? `${pollCount} check${pollCount > 1 ? 's' : ''} done` : 'waiting'})
            </div>
            <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}} @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}`}</style>
            <button onClick={() => { setWaitingPayment(false); setPayReqId(null); }} style={{ marginTop: 24, background: 'none', border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 20px', color: T.muted, cursor: 'pointer', fontSize: 13 }}>
              Cancel request
            </button>
          </div>
        )}

        {/* Step content */}
        <div>
          {step === 0 && <StepSpecialty selected={specialty} onSelect={handleSelectSpecialty} />}
          {step === 1 && <StepDoctor specialty={specialty} selected={doctor} onSelect={handleSelectDoctor} onBack={back} />}
          {step === 2 && <StepDate doctor={doctor} selected={date} onChange={setDate} />}
          {step === 3 && <StepSlot doctor={doctor} date={date} selected={slot} onSelect={handleSelectSlot} />}
          {step === 4 && <StepDetails user={user} details={details} onChange={setDetails} />}
          {step === 5 && <StepPayment doctor={doctor} choice={paymentChoice} onChoose={setPaymentChoice} />}
          {step === 6 && (
            <StepConfirm
              specialty={specialty} doctor={doctor} date={date} slot={slot} details={details}
              onConfirm={handleConfirm} loading={loading} error={error}
            />
          )}
          {step === 7 && (
            <StepSuccess booking={booking} doctor={doctor} date={date} slot={slot} onBookAnother={resetBooking} />
          )}
        </div>

        {/* Navigation buttons */}
        {!waitingPayment && step >= 2 && step <= 5 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
            <BtnBack onClick={back} />
            <BtnPrimary
              onClick={step === 5 && paymentChoice === 'receptionist' ? requestReceptionPayment : next}
              disabled={!canProceed()}
              loading={loading}>
              {step === 4 ? 'Next →' : step === 5 ? 'Send to Reception & Wait →' : 'Next →'}
            </BtnPrimary>
          </div>
        )}
        {step === 1 && (
          <div style={{ marginTop: 20 }}>
            <BtnBack onClick={back} />
          </div>
        )}
      </div>
    </div>
  );
}
