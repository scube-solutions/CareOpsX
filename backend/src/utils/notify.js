const https = require('https');
const nodemailer = require('nodemailer');

const fast2smsKey = process.env.FAST2SMS_API_KEY;
const sendgridKey = process.env.SENDGRID_API_KEY;
const sendgridFrom = process.env.SENDGRID_FROM_EMAIL || 'noreply@careopsx.co.in';

// ── SMTP transport (Gmail / any SMTP) ─────────────────────────────────────────
const smtpHost = process.env.SMTP_HOST;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || smtpUser;

let smtpTransport = null;
if (smtpHost && smtpUser && smtpPass) {
  smtpTransport = nodemailer.createTransport({
    host: smtpHost,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for 587
    auth: { user: smtpUser, pass: smtpPass },
  });
}

const postJson = (hostname, path, headers, body) => {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);

    const req = https.request(
      {
        hostname,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, body: raw });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
};

const sendSms = async (phone, message) => {
  if (!phone) return;

  if (!fast2smsKey) {
    console.log('[notify][dry-run][sms]', { to: phone, message });
    return;
  }

  await postJson(
    'www.fast2sms.com',
    '/dev/bulkV2',
    { authorization: fast2smsKey },
    {
      route: 'q',
      message,
      language: 'english',
      flash: 0,
      numbers: String(phone).replace(/\s+/g, ''),
    }
  );
};

const sendEmail = async (email, subject, text) => {
  if (!email) return;

  // 1. Prefer SMTP if configured
  if (smtpTransport) {
    await smtpTransport.sendMail({ from: smtpFrom, to: email, subject, text });
    return;
  }

  // 2. Fall back to SendGrid API
  if (sendgridKey) {
    await postJson(
      'api.sendgrid.com',
      '/v3/mail/send',
      { Authorization: `Bearer ${sendgridKey}` },
      {
        personalizations: [{ to: [{ email }] }],
        from: { email: sendgridFrom },
        subject,
        content: [{ type: 'text/plain', value: text }],
      }
    );
    return;
  }

  // 3. No provider configured → dry-run log
  console.log('[notify][dry-run][email]', { to: email, subject, text });
};

const fireAndForget = async (tasks, label) => {
  const results = await Promise.allSettled(tasks);
  const failed = results.filter((r) => r.status === 'rejected');

  if (failed.length > 0) {
    console.warn(`[notify] ${label} partial failures:`, failed.map((f) => f.reason?.message || String(f.reason)));
  }
};

const notifyBookingConfirmed = async ({
  patientName,
  patientPhone,
  patientEmail,
  doctorName,
  specialty,
  date,
  time,
  bookingId,
}) => {
  const sms = `CareOpsX: Hi ${patientName || 'Patient'}, your booking ${bookingId} with Dr. ${doctorName} (${specialty || 'General'}) is confirmed for ${date} at ${time}.`;
  const emailSubject = `Booking Confirmed - ${bookingId}`;
  const emailText = `Hi ${patientName || 'Patient'},\n\nYour appointment is confirmed.\nBooking ID: ${bookingId}\nDoctor: Dr. ${doctorName}\nSpecialty: ${specialty || 'General'}\nDate: ${date}\nTime: ${time}\n\nThank you,\nCareOpsX`;

  await fireAndForget([
    sendSms(patientPhone, sms),
    sendEmail(patientEmail, emailSubject, emailText),
  ], 'booking-confirmed');
};

const notifyBookingCancelled = async ({
  patientName,
  patientPhone,
  patientEmail,
  doctorName,
  date,
  time,
  bookingId,
}) => {
  const sms = `CareOpsX: Booking ${bookingId} for ${date} ${time} with Dr. ${doctorName} has been cancelled.`;
  const emailSubject = `Booking Cancelled - ${bookingId}`;
  const emailText = `Hi ${patientName || 'Patient'},\n\nYour appointment has been cancelled.\nBooking ID: ${bookingId}\nDoctor: Dr. ${doctorName}\nDate: ${date}\nTime: ${time}\n\nIf needed, please book another slot.\nCareOpsX`;

  await fireAndForget([
    sendSms(patientPhone, sms),
    sendEmail(patientEmail, emailSubject, emailText),
  ], 'booking-cancelled');
};

const notifyAppointmentReminder = async ({
  patientName,
  patientPhone,
  patientEmail,
  doctorName,
  date,
  time,
  bookingId,
  windowLabel,
}) => {
  const sms = `CareOpsX Reminder (${windowLabel}): ${bookingId} with Dr. ${doctorName} on ${date} at ${time}.`;
  const emailSubject = `Appointment Reminder (${windowLabel}) - ${bookingId}`;
  const emailText = `Hi ${patientName || 'Patient'},\n\nReminder: Your appointment is due ${windowLabel}.\nBooking ID: ${bookingId}\nDoctor: Dr. ${doctorName}\nDate: ${date}\nTime: ${time}\n\nCareOpsX`;

  await fireAndForget([
    sendSms(patientPhone, sms),
    sendEmail(patientEmail, emailSubject, emailText),
  ], `reminder-${windowLabel}`);
};

const sendPasswordResetEmail = async (email, name, resetUrl) => {
  const subject = 'Reset your CareOpsX password';
  const text = `Hi ${name || 'there'},\n\nYou requested a password reset for your CareOpsX account.\n\nClick the link below to set a new password (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, ignore this email — your password will not change.\n\nCareOpsX Team`;
  await sendEmail(email, subject, text);
};

const sendOtpEmail = async (email, name, otp, purpose = 'verification') => {
  const subjects = {
    verification: 'Verify your CareOpsX account',
    reset:        'Your CareOpsX password reset code',
    login:        'Your CareOpsX login code',
  };
  const subject = subjects[purpose] || subjects.verification;
  const text = `Hi ${name || 'there'},\n\nYour CareOpsX ${purpose} code is:\n\n    ${otp}\n\nThis code is valid for 10 minutes. Do not share it with anyone.\n\nIf you did not request this, please ignore this email.\n\nCareOpsX Team`;
  // Non-fatal: email delivery failure must not break registration/verification flows
  try {
    await sendEmail(email, subject, text);
    return true;
  } catch (err) {
    console.warn('[notify] sendOtpEmail failed:', err.message);
    return false;
  }
};

const sendInvitationEmail = async (email, name, activateUrl, orgName, roleName) => {
  const subject = `You're invited to join ${orgName || 'CareOpsX'}`;
  const text = `Hi ${name || 'there'},

Welcome aboard! An administrator has created an account for you on ${orgName || 'CareOpsX'}.

${roleName ? `Assigned Role : ${roleName}\n` : ''}Organization  : ${orgName || 'CareOpsX'}
Login Email   : ${email}

To activate your account and set your password, click the link below (valid for 48 hours):
${activateUrl}

If you were not expecting this invitation, you can safely ignore this email.

CareOpsX Team`;
  // Non-fatal: invite email delivery failure must not break employee creation.
  try {
    await sendEmail(email, subject, text);
    return true;
  } catch (err) {
    console.warn('[notify] sendInvitationEmail failed:', err.message);
    return false;
  }
};

const notifyOrgOnboarded = async ({
  adminEmail, adminName, orgName, orgCode,
  loginUrl, portals, password,
}) => {
  if (!adminEmail) return;
  const portalList = portals && portals.length ? portals.join(', ') : 'As configured';
  const subject = `Welcome to CareOpsX — ${orgName} is live!`;
  const text = `Hi ${adminName || 'Admin'},

Your organization "${orgName}" has been successfully onboarded on CareOpsX.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ORGANISATION DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Organization : ${orgName}
  Org Code     : ${orgCode}
  Portals      : ${portalList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
  YOUR LOGIN DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Login URL : ${loginUrl}
  Email     : ${adminEmail}
  Password  : ${password || '(as set by super admin)'}

Please change your password after the first login.

If you have any questions, please contact your account manager.

CareOpsX Platform
Powered by Scube Solutions
`;
  await sendEmail(adminEmail, subject, text);
};

module.exports = {
  sendEmail,
  sendSms,
  notifyBookingConfirmed,
  notifyBookingCancelled,
  notifyAppointmentReminder,
  sendPasswordResetEmail,
  sendOtpEmail,
  sendInvitationEmail,
  notifyOrgOnboarded,
};
