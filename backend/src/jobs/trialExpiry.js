const cron = require('node-cron');
const supabase = require('../utils/supabase'); // control-plane DB
const { sendEmail } = require('../utils/notify');

const TRIAL_DAYS = 7;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const dayMid = (d) => { const x = new Date(d); return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };

// Find the org admin's email (role_id 1) for an organization
const getOrgAdminEmail = async (organizationId) => {
  const { data } = await supabase
    .from('users')
    .select('email, first_name')
    .eq('organization_id', organizationId)
    .eq('role_id', 1)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  return data || null;
};

const runTrialCheck = async () => {
  try {
    const todayMid = dayMid(new Date());
    // Only orgs still on trial and currently active
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('id, organization_name, created_at, billing_status, status')
      .or('billing_status.eq.trial,billing_status.is.null');
    if (error) throw error;

    for (const org of orgs || []) {
      if (!org.created_at) continue;
      const elapsed   = Math.floor((todayMid - dayMid(org.created_at)) / 86400000);
      const daysLeft  = TRIAL_DAYS - elapsed;

      // ── Expired → pause access (org + all its users blocked via ensureOrganizationOperational) ──
      if (daysLeft <= 0) {
        if (org.status !== 'paused') {
          await supabase.from('organizations')
            .update({ status: 'paused', payment_status: 'pending', paused_at: new Date().toISOString() })
            .eq('id', org.id);

          const admin = await getOrgAdminEmail(org.id);
          if (admin?.email) {
            await sendEmail(
              admin.email,
              'Your CareOpsX free trial has ended',
              `Hi ${admin.first_name || 'Admin'},\n\nYour 7-day free trial for "${org.organization_name}" has ended and access is now paused.\n\nTo restore access, please upgrade to a paid plan:\n${FRONTEND_URL}/admin/setup\n\nNeed help? Reply to this email.\n\nCareOpsX`
            ).catch(() => {});
          }
          console.log(`[trialExpiry] Paused expired org: ${org.organization_name} (${org.id})`);
        }
        continue;
      }

      // ── 2 or 1 days left → reminder email ──
      if (daysLeft === 2 || daysLeft === 1) {
        const admin = await getOrgAdminEmail(org.id);
        if (admin?.email) {
          await sendEmail(
            admin.email,
            `Your CareOpsX trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
            `Hi ${admin.first_name || 'Admin'},\n\nYour free trial for "${org.organization_name}" ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.\n\nUpgrade now to avoid interruption:\n${FRONTEND_URL}/admin/setup\n\nCareOpsX`
          ).catch(() => {});
          console.log(`[trialExpiry] Reminder sent (${daysLeft}d) to ${org.organization_name}`);
        }
      }
    }
  } catch (err) {
    console.error('[trialExpiry] error:', err.message);
  }
};

// Run daily at 08:00 server time
cron.schedule('0 8 * * *', runTrialCheck);

// Also run once shortly after startup so a restarted server catches up
setTimeout(runTrialCheck, 15000);

module.exports = { runTrialCheck };
