const supabase = require('../utils/supabase');

// Roles: 1=Admin, 2=Doctor, 3=Patient, 5=Receptionist, 6=LabStaff, 7=Pharmacist, 8=Reporting
const ROLES = {
  1: 'Admin', 2: 'Doctor', 3: 'Patient',
  5: 'Receptionist', 6: 'LabStaff', 7: 'Pharmacist', 8: 'Reporting'
};

const auditLog = async ({ user_id, role_id, action, module, entity_type, entity_id, old_data, new_data, ip_address, description }) => {
  try {
    await supabase.from('audit_logs').insert([{
      user_id: user_id || null,
      role_id: role_id || null,
      role_name: ROLES[role_id] || 'Unknown',
      action,
      module,
      entity_type: entity_type || null,
      entity_id: entity_id ? String(entity_id) : null,
      old_data: old_data || null,
      new_data: new_data || null,
      ip_address: ip_address || null,
      description: description || null,
      created_at: new Date().toISOString()
    }]);
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
