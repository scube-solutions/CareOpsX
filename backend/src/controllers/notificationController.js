const db = require('../utils/db');
const { auditLog } = require('../middlewares/audit');

// ── Templates ─────────────────────────────────────────────────────────────────
const getTemplates = async (req, res) => {
  try {
    const organizationId = req.user?.organization_id ?? null;
    const { channel, event_type } = req.query;

    const params = [true];
    const where = [`is_active = $1`];
    if (organizationId) { params.push(organizationId); where.push(`organization_id = $${params.length}`); }
    if (channel)        { params.push(channel);        where.push(`channel = $${params.length}`); }
    if (event_type)     { params.push(event_type);     where.push(`event_type = $${params.length}`); }

    const result = await req.db.query(
      `SELECT * FROM notification_templates WHERE ${where.join(' AND ')} ORDER BY event_type`,
      params
    );
    return res.json({ templates: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createTemplate = async (req, res) => {
  try {
    const organizationId = req.user?.organization_id ?? null;
    const body = req.body;
    const keys = Object.keys(body);
    const allKeys = [...keys, 'organization_id', 'is_active', 'created_by', 'created_at'];
    const allVals = [...keys.map(k => body[k]), organizationId, true, req.user.id, new Date().toISOString()];
    const cols = allKeys.join(', ');
    const placeholders = allKeys.map((_, i) => `$${i + 1}`).join(', ');

    const result = await req.db.query(
      `INSERT INTO notification_templates (${cols}) VALUES (${placeholders}) RETURNING *`,
      allVals
    );
    return res.status(201).json({ message: 'Template created', template: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const organizationId = req.user?.organization_id ?? null;
    const body = { ...req.body, updated_by: req.user.id, updated_at: new Date().toISOString() };
    const keys = Object.keys(body);
    const values = Object.values(body);
    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    values.push(req.params.id);
    const idParam = values.length;

    let sql = `UPDATE notification_templates SET ${setClauses} WHERE id = $${idParam}`;
    if (organizationId) { values.push(organizationId); sql += ` AND organization_id = $${values.length}`; }
    sql += ' RETURNING *';

    const result = await req.db.query(sql, values);
    if (!result.rows.length) return res.status(404).json({ error: 'Template not found' });
    return res.json({ message: 'Template updated', template: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Send Manual Notification ──────────────────────────────────────────────────
const sendNotification = async (req, res) => {
  try {
    const reqDb = req.db;
    const { patient_id, channel, message, subject, event_type, recipient_phone, recipient_email } = req.body;
    if (!message || !channel) return res.status(400).json({ error: 'message and channel are required' });

    const logRes = await reqDb.query(
      `INSERT INTO notification_logs
         (patient_id, channel, event_type, subject, message, recipient_phone, recipient_email,
          status, organization_id, sent_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10)
       RETURNING *`,
      [
        patient_id || null, channel, event_type || 'manual', subject || null, message,
        recipient_phone || null, recipient_email || null,
        req.user?.organization_id ?? null, req.user.id, new Date().toISOString()
      ]
    );
    const log = logRes.rows[0];

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

    await reqDb.query(
      `UPDATE notification_logs SET status=$1, sent_at=$2 WHERE id=$3`,
      [delivered ? 'sent' : 'failed', delivered ? new Date().toISOString() : null, log.id]
    );

    return res.status(201).json({ message: delivered ? 'Notification sent' : 'Notification queued (delivery failed)', log_id: log.id, delivered });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Get Notification Logs ─────────────────────────────────────────────────────
const getNotificationLogs = async (req, res) => {
  try {
    const reqDb = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const { patient_id, status, channel, event_type, page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const params = [];
    const where = [];
    if (organizationId) { params.push(organizationId); where.push(`nl.organization_id = $${params.length}`); }
    if (patient_id)     { params.push(patient_id);     where.push(`nl.patient_id = $${params.length}`); }
    if (status)         { params.push(status);         where.push(`nl.status = $${params.length}`); }
    if (channel)        { params.push(channel);        where.push(`nl.channel = $${params.length}`); }
    if (event_type)     { params.push(event_type);     where.push(`nl.event_type = $${params.length}`); }

    params.push(parseInt(limit));
    params.push(offset);

    const countResult = await reqDb.query(
      `SELECT COUNT(*) FROM notification_logs nl${where.length ? ' WHERE ' + where.join(' AND ') : ''}`,
      params.slice(0, -2)
    );

    const result = await reqDb.query(
      `SELECT nl.*,
              p.first_name AS patient_first_name, p.last_name AS patient_last_name, p.patient_uid
       FROM notification_logs nl
       LEFT JOIN patients p ON p.id = nl.patient_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY nl.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const logs = result.rows.map(row => ({
      ...row,
      patients: row.patient_first_name ? {
        first_name: row.patient_first_name,
        last_name: row.patient_last_name,
        patient_uid: row.patient_uid
      } : null
    }));

    return res.json({ logs, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Retry Failed Notification ─────────────────────────────────────────────────
const retryNotification = async (req, res) => {
  try {
    const reqDb = req.db;
    const organizationId = req.user?.organization_id ?? null;
    const { id } = req.params;

    const params = [id];
    let orgClause = '';
    if (organizationId) { params.push(organizationId); orgClause = ` AND organization_id = $${params.length}`; }

    const logResult = await reqDb.query(
      `SELECT * FROM notification_logs WHERE id = $1${orgClause}`,
      params
    );
    const log = logResult.rows[0];
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
    await reqDb.query(
      `UPDATE notification_logs SET status=$1, retry_count=$2, last_retry_at=$3 WHERE id=$4`,
      [delivered ? 'sent' : 'failed', retryCount, new Date().toISOString(), id]
    );

    return res.json({ message: delivered ? 'Retry successful' : 'Retry failed', delivered });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Internal trigger (used by cron jobs & other modules) ──────────────────────
const triggerEventNotification = async ({ event_type, patient_id, channel, recipient_phone, recipient_email, variables = {} }) => {
  try {
    const templateRes = await db.query(
      `SELECT * FROM notification_templates
       WHERE event_type = $1 AND channel = $2 AND is_active = true
       LIMIT 1`,
      [event_type, channel]
    );
    const template = templateRes.rows[0];
    if (!template) return;

    let message = template.body;
    let subject = template.subject || '';
    Object.keys(variables).forEach(key => {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), variables[key] || '');
      subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), variables[key] || '');
    });

    const logRes = await db.query(
      `INSERT INTO notification_logs
         (patient_id, channel, event_type, subject, message, recipient_phone, recipient_email, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)
       RETURNING id`,
      [patient_id || null, channel, event_type, subject, message, recipient_phone || null, recipient_email || null, new Date().toISOString()]
    );
    const logId = logRes.rows[0]?.id;

    if (channel === 'sms' && recipient_phone) {
      const { sendSMS } = require('../utils/notify');
      await sendSMS(recipient_phone, message);
      if (logId) {
        await db.query(
          `UPDATE notification_logs SET status='sent', sent_at=$1 WHERE id=$2`,
          [new Date().toISOString(), logId]
        );
      }
    }
  } catch (err) {
    console.error('triggerEventNotification error:', err.message);
  }
};

module.exports = { getTemplates, createTemplate, updateTemplate, sendNotification, getNotificationLogs, retryNotification, triggerEventNotification };
