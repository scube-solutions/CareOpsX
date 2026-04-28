const cron = require('node-cron');
const supabase = require('../utils/supabase');

// Risk scoring rules (configurable via drop_off_rules table)
const DEFAULT_RULES = [
  { trigger: 'lab_not_collected', days: 5,  score: 30, level: 'medium', description: 'Lab test not collected within days' },
  { trigger: 'no_return_after_report', days: 7, score: 40, level: 'high', description: 'Did not return after report was ready' },
  { trigger: 'chronic_missed_followup', days: 0, score: 60, level: 'high', description: 'Chronic patient missed follow-up' },
  { trigger: 'repeated_no_show', count: 2,  score: 50, level: 'high', description: 'Repeated no-show appointments' },
  { trigger: 'missed_followup_critical', count: 2, score: 80, level: 'critical', description: 'Multiple missed follow-ups' },
];

const addToWatchlist = async (patient_id, risk_score, risk_level, risk_reason, trigger_type) => {
  const { data: existing } = await supabase.from('drop_off_watchlist')
    .select('id, risk_score').eq('patient_id', patient_id).in('outcome', ['at_risk', 'still_at_risk']).maybeSingle();

  if (existing) {
    if (risk_score > existing.risk_score) {
      await supabase.from('drop_off_watchlist').update({ risk_score, risk_level, risk_reason, updated_at: new Date().toISOString() }).eq('id', existing.id);
    }
    return;
  }

  await supabase.from('drop_off_watchlist').insert([{
    patient_id, risk_score, risk_level, risk_reason, trigger_type,
    outcome: 'at_risk', action_history: [], created_at: new Date().toISOString()
  }]);
};

// Runs every night at 11:00 PM
cron.schedule('0 23 * * *', async () => {
  console.log('[DropOffEngine] Running nightly risk scoring...');
  try {
    const today = new Date().toISOString().split('T')[0];

    // Rule 1: Lab orders ordered but not collected after 5 days
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const { data: pendingLabs } = await supabase.from('lab_orders')
      .select('patient_id').eq('status', 'ordered').lt('ordered_at', fiveDaysAgo);

    for (const lab of pendingLabs || []) {
      await addToWatchlist(lab.patient_id, 30, 'medium', 'Lab test not collected within 5 days', 'lab_not_collected');
    }

    // Rule 2: Lab report ready but patient did not return (7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: readyReports } = await supabase.from('lab_reports')
      .select('patient_id').eq('status', 'ready').lt('uploaded_at', sevenDaysAgo);

    for (const r of readyReports || []) {
      await addToWatchlist(r.patient_id, 40, 'high', 'Patient did not return after report was ready (7 days)', 'no_return_after_report');
    }

    // Rule 3: Chronic patients with missed follow-ups
    const { data: missedChronicFollowups } = await supabase.from('follow_up_plans')
      .select('patient_id, patients(chronic_disease_tag)')
      .eq('status', 'missed')
      .not('disease_tag', 'is', null);

    for (const f of missedChronicFollowups || []) {
      await addToWatchlist(f.patient_id, 60, 'high', `Chronic patient missed follow-up (${f.disease_tag})`, 'chronic_missed_followup');
    }

    // Rule 4: Multiple missed follow-ups (critical)
    const { data: allMissed } = await supabase.from('follow_up_plans')
      .select('patient_id').eq('status', 'missed');

    const missedCounts = (allMissed || []).reduce((acc, f) => {
      acc[f.patient_id] = (acc[f.patient_id] || 0) + 1;
      return acc;
    }, {});

    for (const [pid, count] of Object.entries(missedCounts)) {
      if (count >= 2) {
        await addToWatchlist(pid, 80, 'critical', `${count} missed follow-ups`, 'missed_followup_critical');
      }
    }

    // Rule 5: Repeated no-shows
    const { data: noShows } = await supabase.from('appointments').select('patient_id').eq('status', 'no_show');
    const noShowCounts = (noShows || []).reduce((acc, a) => {
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
