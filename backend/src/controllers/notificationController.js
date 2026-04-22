const supabase = require('../utils/supabase');
const { auditLog } = require('../middlewares/audit');

// ── Templates ─────────────────────────────────────────────────────────────────
const getTemplates = async (req, res) => {
  try {
    const { channel, event_type } = req.query;
    let query = supabase.from('notification_templates').select('*').eq('is_active', true).order('event_type');
    if (channel) query = query.eq('channel', channel);
    if (event_type) query = query.eq('event_type', event_type);
    const { data, error } = await query;
    if (error) throw error;
    return res.json({ templates: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createTemplate = async (req, res) => {
  try {
    const { data, error } = await supabase.from('notification_templates').insert([{ ...req.body, is_active: true, created_by: req.user.id, created_at: new Date().toISOString() }]).select('*').single();
    if (error) throw error;
    return res.status(201).json({ message: 'Template created', template: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const { data, error } = await supabase.from('notification_templates').update({ ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() }).eq('id', req.params.id).select('*').single();
    if (error) throw error;
    return res.json({ message: 'Template updated', template: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Send Manual Notification ──────────────────────────────────────────────────
const sendNotification = async (req, res) => {
  try {
    const { patient_id, channel, message, subject, event_type, recipient_phone, recipient_email } = req.body;
    if (!message || !channel) return res.status(400).json({ error: 'message and channel are required' });

    const { data: log, error: logErr } = await supabase.from('notification_logs').insert([{
      patient_id: patient_id || null,
      channel,
      event_type: event_type || 'manual',
      subject: subject || null,
      message,
      recipient_phone: recipient_phone || null,
      recipient_email: recipient_email || null,
      status: 'pending',
      sent_by: req.user.id,
      created_at: new Date().toISOString()
    }]).select('*').single();

    if (logErr) throw logErr;

    // Attempt delivery
    let delivered = false;
    try {
      if (channel === 'sms' && recipient_phone) {
        const { sendSMS } = require('../utils/notify');
        await sendSMS(recipient_phone, message);
        delivered = true;
      } else if (channel === 'email' && recipient_email) {
        const { sendEmail } = require('../utils/notify');
        await sendEmail(recipient_email, subject || 'CareOpsX Notification', message);
        delivered = true;
      }
    } catch (deliveryErr) {
      console.error('Delivery error:', deliveryErr.message);
    }

    await supabase.from('notification_logs').update({ status: delivered ? 'sent' : 'failed', sent_at: delivered ? new Date().toISOString() : null }).eq('id', log.id);

    return res.status(201).json({ message: delivered ? 'Notification sent' : 'Notification queued (delivery failed)', log_id: log.id, delivered });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Notification Logs ─────────────────────────────────────────────────────
const getNotificationLogs = async (req, res) => {
  try {
    const { patient_id, status, channel, event_type, page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase.from('notification_logs')
      .select('*, patients(first_name, last_name, patient_uid)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (patient_id) query = query.eq('patient_id', patient_id);
    if (status) query = query.eq('status', status);
    if (channel) query = query.eq('channel', channel);
    if (event_type) query = query.eq('event_type', event_type);

    const { data, error, count } = await query;
    if (error) throw error;
    return res.json({ logs: data, total: count });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Retry Failed Notification ─────────────────────────────────────────────────
const retryNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: log } = await supabase.from('notification_logs').select('*').eq('id', id).single();
    if (!log) return res.status(404).json({ error: 'Notification log not found' });
    if (log.status === 'sent' || log.status === 'delivered') return res.status(400).json({ error: 'Notification already delivered' });

    let delivered = false;
    try {
      if (log.channel === 'sms' && log.recipient_phone) {
        const { sendSMS } = require('../utils/notify');
        await sendSMS(log.recipient_phone, log.message);
        delivered = true;
      } else if (log.channel === 'email' && log.recipient_email) {
        const { sendEmail } = require('../utils/notify');
        await sendEmail(log.recipient_email, log.subject || 'CareOpsX', log.message);
        delivered = true;
      }
    } catch (e) {
      console.error('Retry error:', e.message);
    }

    const retryCount = (log.retry_count || 0) + 1;
    await supabase.from('notification_logs').update({ status: delivered ? 'sent' : 'failed', retry_count: retryCount, last_retry_at: new Date().toISOString() }).eq('id', id);

    return res.json({ message: delivered ? 'Retry successful' : 'Retry failed', delivered });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Internal trigger (used by cron jobs & other modules) ──────────────────────
const triggerEventNotification = async ({ event_type, patient_id, channel, recipient_phone, recipient_email, variables = {} }) => {
  try {
    const { data: template } = await supabase.from('notification_templates').select('*').eq('event_type', event_type).eq('channel', channel).eq('is_active', true).single();
    if (!template) return;

    let message = template.body;
    let subject = template.subject || '';
    Object.keys(variables).forEach(key => {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), variables[key] || '');
      subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), variables[key] || '');
    });

    await supabase.from('notification_logs').insert([{
      patient_id: patient_id || null,
      channel,
      event_type,
      subject,
      message,
      recipient_phone: recipient_phone || null,
      recipient_email: recipient_email || null,
      status: 'pending',
      created_at: new Date().toISOString()
    }]);

    if (channel === 'sms' && recipient_phone) {
      const { sendSMS } = require('../utils/notify');
      await sendSMS(recipient_phone, message);
      await supabase.from('notification_logs').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('patient_id', patient_id).eq('event_type', event_type).eq('status', 'pending');
    }
  } catch (err) {
    console.error('triggerEventNotification error:', err.message);
  }
};

module.exports = { getTemplates, createTemplate, updateTemplate, sendNotification, getNotificationLogs, retryNotification, triggerEventNotification };
