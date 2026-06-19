const db = require('../utils/db');

// Roles: 1=Admin, 2=Doctor, 3=Patient, 5=Receptionist, 6=LabStaff, 7=Pharmacist, 8=Reporting
const ROLES = {
  1: 'Admin', 2: 'Doctor', 3: 'Patient',
  5: 'Receptionist', 6: 'LabStaff', 7: 'Pharmacist', 8: 'Reporting'
};

const auditLog = async ({ user_id, role_id, organization_id, action, module, entity_type, entity_id, old_data, new_data, ip_address, description }) => {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, role_id, role_name, organization_id, action, module, entity_type, entity_id, old_data, new_data, ip_address, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        user_id || null,
        role_id || null,
        ROLES[role_id] || 'Unknown',
        organization_id || null,
        action,
        module,
        entity_type || null,
        entity_id ? String(entity_id) : null,
        old_data || null,
        new_data || null,
        ip_address || null,
        description || null,
        new Date().toISOString()
      ]
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
};

// Middleware factory — auto-logs based on method
const auditMiddleware = (module, action, entityType) => {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 400 && req.user) {
        const entityId = req.params?.id || body?.data?.id || body?.patient?.id
          || body?.appointment?.id || body?.invoice?.id || null;
        auditLog({
          user_id: req.user.id,
          role_id: req.user.role_id,
          organization_id: req.user.organization_id || null,
          action: action || req.method,
          module,
          entity_type: entityType || null,
          entity_id: entityId,
          new_data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : null,
          ip_address: req.ip,
          description: `${req.method} ${req.originalUrl}`
        });
      }
      return originalJson(body);
    };
    next();
  };
};

module.exports = { auditLog, auditMiddleware };
