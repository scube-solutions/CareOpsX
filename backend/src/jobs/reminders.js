const cron = require('node-cron');
const supabase = require('../utils/supabase');
const { notifyAppointmentReminder } = require('../utils/notify');

const buildDoctorName = (appointment) => {
  const first = appointment?.doctors?.users?.first_name || '';
  const last = appointment?.doctors?.users?.last_name || '';
  const full = `${first} ${last}`.trim();
  return full || appointment?.doctors?.users?.name || 'Doctor';
};

const buildPatientName = (appointment) => {
  const p = appointment?.patients || {};
  if (p.name) return p.name;
  const full = `${p.first_name || ''} ${p.last_name || ''}`.trim();
  return full || 'Patient';
};

const toHHMM = (value) => {
  if (!value) return '';
  const str = String(value);
  if (/^\d{2}:\d{2}$/.test(str)) return str;
  const match = str.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : str.slice(0, 5);
};

const fetchAppointmentsByDate = async (date) => {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id,
      booking_id,
      appointment_date,
      appointment_time,
      status,
      patients ( * ),
      doctors ( users ( first_name, last_name, name ) )
    `)
    .eq('appointment_date', date)
    .in('status', ['booked', 'confirmed']);

  if (error) throw error;
  return data || [];
};

const runT24Reminders = async () => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);

    const rows = await fetchAppointmentsByDate(date);

    await Promise.allSettled(
      rows.map((a) =>
        notifyAppointmentReminder({
          patientName: buildPatientName(a),
          patientPhone: a.patients?.phone,
          patientEmail: a.patients?.email,
          doctorName: buildDoctorName(a),
          date: a.appointment_date,
          time: toHHMM(a.appointment_time),
          bookingId: a.booking_id,
          windowLabel: 'T-24h',
        })
      )
    );

    console.log(`[reminders] T-24h processed: ${rows.length}`);
  } catch (err) {
    console.error('[reminders] T-24h failed:', err.message);
  }
};

const runT1Reminders = async () => {
  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const rows = await fetchAppointmentsByDate(today);

    const due = rows.filter((a) => {
      const [hh, mm] = toHHMM(a.appointment_time).split(':').map(Number);
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false;

      const slotTime = new Date(`${a.appointment_date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
      const diffMinutes = (slotTime.getTime() - now.getTime()) / (1000 * 60);
      return diffMinutes >= 50 && diffMinutes <= 60;
    });

    await Promise.allSettled(
      due.map((a) =>
        notifyAppointmentReminder({
          patientName: buildPatientName(a),
          patientPhone: a.patients?.phone,
          patientEmail: a.patients?.email,
          doctorName: buildDoctorName(a),
          date: a.appointment_date,
          time: toHHMM(a.appointment_time),
          bookingId: a.booking_id,
          windowLabel: 'T-1h',
        })
      )
    );

    console.log(`[reminders] T-1h processed: ${due.length}`);
  } catch (err) {
    console.error('[reminders] T-1h failed:', err.message);
  }
};

cron.schedule('0 8 * * *', runT24Reminders);
cron.schedule('0 * * * *', runT1Reminders);

console.log('[reminders] Cron jobs registered (08:00 daily T-24h, hourly T-1h)');
