const cron = require('node-cron');
const db = require('../utils/db');
const { triggerEventNotification } = require('../controllers/notificationController');

const dateOffset = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

// Runs every day at 8:00 AM
cron.schedule('0 8 * * *', async () => {
  console.log('[FollowUpScanner] Running daily scan...');
  try {
    const today = new Date().toISOString().split('T')[0];

    // ── Mark overdue follow-ups as missed ─────────────────────────────────────
    const overdueRes = await db.query(
      `SELECT f.id, f.patient_id, p.first_name, p.last_name, p.phone
       FROM follow_up_plans f
       LEFT JOIN patients p ON f.patient_id = p.id
       WHERE f.status = $1 AND f.follow_up_date < $2`,
      ['scheduled', today]
    );
    const overdue = overdueRes.rows || [];

    if (overdue.length) {
      await db.query(
        `UPDATE follow_up_plans 
         SET status = $1, updated_at = $2 
         WHERE id = ANY($3)`,
        ['missed', new Date().toISOString(), overdue.map(f => f.id)]
      );
      console.log(`[FollowUpScanner] Marked ${overdue.length} follow-ups as missed`);

      for (const f of overdue) {
        if (f.phone) {
          await triggerEventNotification({
            event_type: 'missed_follow_up',
            patient_id: f.patient_id,
            channel: 'sms',
            recipient_phone: f.phone,
            variables: { patient_name: `${f.first_name} ${f.last_name}` }
          }).catch(() => {});
        }
      }
    }

    // ── Send reminders 3 days, 2 days, and 1 day before ──────────────────────
    for (const daysAhead of [3, 2, 1]) {
      const targetDate = dateOffset(daysAhead);
      const flagColumn = `reminder_${daysAhead}d_sent`;

      const upcomingRes = await db.query(
        `SELECT f.id, f.patient_id, f.follow_up_date, f.doctor_id, f.notes,
                p.first_name, p.last_name, p.phone
         FROM follow_up_plans f
         LEFT JOIN patients p ON f.patient_id = p.id
         WHERE f.status = $1 AND f.follow_up_date = $2 AND f.${flagColumn} = false`,
        ['scheduled', targetDate]
      );
      const upcoming = upcomingRes.rows || [];

      if (!upcoming.length) continue;

      for (const f of upcoming) {
        // Notify patient
        if (f.phone) {
          await triggerEventNotification({
            event_type: 'follow_up_due',
            patient_id: f.patient_id,
            channel: 'sms',
            recipient_phone: f.phone,
            variables: {
              patient_name: `${f.first_name} ${f.last_name}`,
              follow_up_date: f.follow_up_date,
              days_ahead: daysAhead,
            }
          }).catch(() => {});
        }

        // Notify lab staff: fetch any pending lab orders for this patient
        const pendingLabRes = await db.query(
          `SELECT id, test_name 
           FROM lab_orders 
           WHERE patient_id = $1 AND status = ANY($2)`,
          [f.patient_id, ['ordered', 'sample_collected', 'processing']]
        );
        const pendingLab = pendingLabRes.rows || [];

        if (pendingLab.length) {
          const testNames = pendingLab.map(l => l.test_name).join(', ');
          console.log(`[FollowUpScanner] Patient ${f.patient_id} has ${pendingLab.length} pending lab order(s) (${testNames}) — follow-up in ${daysAhead} day(s)`);

          // Insert in-app notification for lab staff (role 6)
          try {
            await db.query(
              `INSERT INTO notifications (type, title, body, target_role_id, patient_id, is_read, created_at) 
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                'lab_followup_reminder',
                'Follow-up Alert — Pending Lab Orders',
                `${f.first_name} ${f.last_name} has a follow-up in ${daysAhead} day(s) with ${pendingLab.length} pending test(s): ${testNames}`,
                6,
                f.patient_id,
                false,
                new Date().toISOString()
              ]
            );
          } catch (e) { /* best-effort notification */ }
        }

        // Mark this reminder as sent
        await db.query(
          `UPDATE follow_up_plans SET ${flagColumn} = true WHERE id = $1`,
          [f.id]
        );
      }

      console.log(`[FollowUpScanner] Sent ${upcoming.length} reminder(s) for ${daysAhead} day(s) ahead (${targetDate})`);
    }
  } catch (err) {
    console.error('[FollowUpScanner] Error:', err.message);
  }
});
