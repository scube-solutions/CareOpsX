const cron = require('node-cron');
const db = require('../utils/db');

// Risk scoring rules (configurable via drop_off_rules table)
const DEFAULT_RULES = [
  { trigger: 'lab_not_collected', days: 5,  score: 30, level: 'medium', description: 'Lab test not collected within days' },
  { trigger: 'no_return_after_report', days: 7, score: 40, level: 'high', description: 'Did not return after report was ready' },
  { trigger: 'chronic_missed_followup', days: 0, score: 60, level: 'high', description: 'Chronic patient missed follow-up' },
  { trigger: 'repeated_no_show', count: 2,  score: 50, level: 'high', description: 'Repeated no-show appointments' },
  { trigger: 'missed_followup_critical', count: 2, score: 80, level: 'critical', description: 'Multiple missed follow-ups' },
];

const addToWatchlist = async (patient_id, risk_score, risk_level, risk_reason, trigger_type) => {
  const existingRes = await db.query(
    `SELECT id, risk_score FROM drop_off_watchlist 
     WHERE patient_id = $1 AND outcome = ANY($2) LIMIT 1`,
    [patient_id, ['at_risk', 'still_at_risk']]
  );
  const existing = existingRes.rows[0];

  if (existing) {
    if (risk_score > existing.risk_score) {
      await db.query(
        `UPDATE drop_off_watchlist 
         SET risk_score = $1, risk_level = $2, risk_reason = $3, updated_at = $4 
         WHERE id = $5`,
        [risk_score, risk_level, risk_reason, new Date().toISOString(), existing.id]
      );
    }
    return;
  }

  await db.query(
    `INSERT INTO drop_off_watchlist (patient_id, risk_score, risk_level, risk_reason, trigger_type, outcome, action_history, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [patient_id, risk_score, risk_level, risk_reason, trigger_type, 'at_risk', JSON.stringify([]), new Date().toISOString()]
  );
};

// Runs every night at 11:00 PM
cron.schedule('0 23 * * *', async () => {
  console.log('[DropOffEngine] Running nightly risk scoring...');
  try {
    const today = new Date().toISOString().split('T')[0];

    // Rule 1: Lab orders ordered but not collected after 5 days
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const pendingLabsRes = await db.query(
      'SELECT patient_id FROM lab_orders WHERE status = $1 AND ordered_at < $2',
      ['ordered', fiveDaysAgo]
    );
    const pendingLabs = pendingLabsRes.rows || [];

    for (const lab of pendingLabs) {
      await addToWatchlist(lab.patient_id, 30, 'medium', 'Lab test not collected within 5 days', 'lab_not_collected');
    }

    // Rule 2: Lab report ready but patient did not return (7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const readyReportsRes = await db.query(
      'SELECT patient_id FROM lab_reports WHERE status = $1 AND uploaded_at < $2',
      ['ready', sevenDaysAgo]
    );
    const readyReports = readyReportsRes.rows || [];

    for (const r of readyReports) {
      await addToWatchlist(r.patient_id, 40, 'high', 'Patient did not return after report was ready (7 days)', 'no_return_after_report');
    }

    // Rule 3: Chronic patients with missed follow-ups
    const missedChronicFollowupsRes = await db.query(
      'SELECT patient_id, disease_tag FROM follow_up_plans WHERE status = $1 AND disease_tag IS NOT NULL',
      ['missed']
    );
    const missedChronicFollowups = missedChronicFollowupsRes.rows || [];

    for (const f of missedChronicFollowups) {
      await addToWatchlist(f.patient_id, 60, 'high', `Chronic patient missed follow-up (${f.disease_tag})`, 'chronic_missed_followup');
    }

    // Rule 4: Multiple missed follow-ups (critical)
    const allMissedRes = await db.query(
      'SELECT patient_id FROM follow_up_plans WHERE status = $1',
      ['missed']
    );
    const allMissed = allMissedRes.rows || [];

    const missedCounts = allMissed.reduce((acc, f) => {
      acc[f.patient_id] = (acc[f.patient_id] || 0) + 1;
      return acc;
    }, {});

    for (const [pid, count] of Object.entries(missedCounts)) {
      if (count >= 2) {
        await addToWatchlist(pid, 80, 'critical', `${count} missed follow-ups`, 'missed_followup_critical');
      }
    }

    // Rule 5: Repeated no-shows
    const noShowsRes = await db.query(
      'SELECT patient_id FROM appointments WHERE status = $1',
      ['no_show']
    );
    const noShows = noShowsRes.rows || [];
    
    const noShowCounts = noShows.reduce((acc, a) => {
      acc[a.patient_id] = (acc[a.patient_id] || 0) + 1;
      return acc;
    }, {});

    for (const [pid, count] of Object.entries(noShowCounts)) {
      if (count >= 2) {
        await addToWatchlist(pid, 50, 'high', `${count} no-show appointments`, 'repeated_no_show');
      }
    }

    console.log('[DropOffEngine] Risk scoring complete');
  } catch (err) {
    console.error('[DropOffEngine] Error:', err.message);
  }
});
