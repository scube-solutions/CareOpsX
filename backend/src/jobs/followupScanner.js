const cron = require('node-cron');
const supabase = require('../utils/supabase');
const { triggerEventNotification } = require('../controllers/notificationController');

const dateOffset = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

// Runs every day at 8:00 AM
cron.schedule('0 8 * * *', async () => {
  console.log('[FollowUpScanner] Running daily scan...');
  try {
    const today = new Date().toISOString().split('T')[0];

    // ── Mark overdue follow-ups as missed ─────────────────────────────────────
    const { data: overdue } = await supabase.from('follow_up_plans')
      .select('id, patient_id, patients(first_name, last_name, phone)')
      .eq('status', 'scheduled')
      .lt('follow_up_date', today);

    if (overdue?.length) {
      await supabase.from('follow_up_plans')
        .update({ status: 'missed', updated_at: new Date().toISOString() })
        .in('id', overdue.map(f => f.id));
      console.log(`[FollowUpScanner] Marked ${overdue.length} follow-ups as missed`);

      for (const f of overdue) {
        if (f.patients?.phone) {
          await triggerEventNotification({
            event_type: 'missed_follow_up',
            patient_id: f.patient_id,
            channel: 'sms',
            recipient_phone: f.patients.phone,
            variables: { patient_name: `${f.patients.first_name} ${f.patients.last_name}` }
          }).catch(() => {});
        }
      }
    }

    // ── Send reminders 3 days, 2 days, and 1 day before ──────────────────────
    for (const daysAhead of [3, 2, 1]) {
      const targetDate = dateOffset(daysAhead);

      const { data: upcoming } = await supabase.from('follow_up_plans')
        .select(`
          id, patient_id, follow_up_date, doctor_id, notes,
          patients(first_name, last_name, phone)
        `)
        .eq('status', 'scheduled')
        .eq('follow_up_date', targetDate)
        .eq(`reminder_${daysAhead}d_sent`, false);

      if (!upcoming?.length) continue;

      for (const f of upcoming) {
        // Notify patient
        if (f.patients?.phone) {
          await triggerEventNotification({
            event_type: 'follow_up_due',
            patient_id: f.patient_id,
            channel: 'sms',
            recipient_phone: f.patients.phone,
            variables: {
              patient_name: `${f.patients.first_name} ${f.patients.last_name}`,
              follow_up_date: f.follow_up_date,
              days_ahead: daysAhead,
            }
          }).catch(() => {});
        }

        // Notify lab staff: fetch any pending lab orders for this patient
        const { data: pendingLab } = await supabase.from('lab_orders')
          .select('id, test_name')
          .eq('patient_id', f.patient_id)
          .in('status', ['ordered', 'sample_collected', 'processing']);

        if (pendingLab?.length) {
          const testNames = pendingLab.map(l => l.test_name).join(', ');
          console.log(`[FollowUpScanner] Patient ${f.patient_id} has ${pendingLab.length} pending lab order(s) (${testNames}) — follow-up in ${daysAhead} day(s)`);

          // Insert in-app notification for lab staff (role 6)
          await supabase.from('notifications').insert([{
            type: 'lab_followup_reminder',
            title: 'Follow-up Alert — Pending Lab Orders',
            body: `${f.patients?.first_name} ${f.patients?.last_name} has a follow-up in ${daysAhead} day(s) with ${pendingLab.length} pending test(s): ${testNames}`,
            target_role_id: 6,
            patient_id: f.patient_id,
            is_read: false,
            created_at: new Date().toISOString(),
          }]).catch(() => {});
        }

        // Mark this reminder as sent
        await supabase.from('follow_up_plans')
          .update({ [`reminder_${daysAhead}d_sent`]: true })
          .eq('id', f.id);
      }

      console.log(`[FollowUpScanner] Sent ${upcoming.length} reminder(s) for ${daysAhead} day(s) ahead (${targetDate})`);
    }
  } catch (err) {
    console.error('[FollowUpScanner] Error:', err.message);
  }
});
