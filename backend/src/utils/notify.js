const https = require('https');

const fast2smsKey = process.env.FAST2SMS_API_KEY;
const sendgridKey = process.env.SENDGRID_API_KEY;
const sendgridFrom = process.env.SENDGRID_FROM_EMAIL || 'noreply@careopsx.co.in';

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

  if (!sendgridKey) {
    console.log('[notify][dry-run][email]', { to: email, subject, text });
    return;
  }

  await postJson(
    'api.sendgrid.com',
    '/v3/mail/send',
    {
      Authorization: `Bearer ${sendgridKey}`,
    },
    {
      personalizations: [{ to: [{ email }] }],
      from: { email: sendgridFrom },
      subject,
      content: [{ type: 'text/plain', value: text }],
    }
  );
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

module.exports = {
  notifyBookingConfirmed,
  notifyBookingCancelled,
  notifyAppointmentReminder,
};
